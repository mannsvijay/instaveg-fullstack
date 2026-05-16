import { Router } from "express";
import { db, ordersTable, orderItemsTable, cartItemsTable, cartsTable, productsTable, addressesTable, usersTable, sellersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import {
  CreateOrderBody,
  GetOrderParams,
  ListOrdersQueryParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  CreatePaymentParams,
  VerifyPaymentParams,
  VerifyPaymentBody,
} from "@workspace/api-zod";
import crypto from "crypto";

const router = Router();

const PLATFORM_FEE = 5;
const DELIVERY_FEE = 40;

async function enrichOrder(order: typeof ordersTable.$inferSelect) {
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const [seller] = order.sellerId
    ? await db.select({ storeName: sellersTable.storeName }).from(sellersTable).where(eq(sellersTable.id, order.sellerId))
    : [null];
  const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, order.userId));
  return {
    ...order,
    items,
    sellerName: seller?.storeName ?? null,
    buyerName: buyer?.name ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number; role: string } }).user;
  const params = ListOrdersQueryParams.safeParse(req.query);
  const { status, page = 1, limit = 20 } = params.success ? params.data : {};

  let query = db.select().from(ordersTable).$dynamic();
  const conditions = [];

  if (user.role === "buyer") {
    conditions.push(eq(ordersTable.userId, user.id));
  }
  if (status) {
    const { sql, eq: eqFn } = await import("drizzle-orm");
    conditions.push(eqFn(ordersTable.status, status));
  }

  const offset = ((page ?? 1) - 1) * (limit ?? 20);
  const rows = await db.select().from(ordersTable)
    .where(conditions.length === 1 ? conditions[0] : conditions.length > 1 ? (await import("drizzle-orm")).and(...conditions) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit ?? 20).offset(offset);

  const enriched = await Promise.all(rows.map(enrichOrder));
  res.json(enriched);
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { addressId, paymentMethod, notes } = parsed.data;

  // Get cart
  const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, user.id));
  if (!cart) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  const cartItems = await db.select({
    id: cartItemsTable.id,
    productId: cartItemsTable.productId,
    quantity: cartItemsTable.quantity,
    price: cartItemsTable.price,
    name: productsTable.name,
    images: productsTable.images,
    unit: productsTable.unit,
    sellerId: productsTable.sellerId,
  }).from(cartItemsTable)
    .leftJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.cartId, cart.id));

  if (cartItems.length === 0) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  const [address] = await db.select().from(addressesTable).where(eq(addressesTable.id, addressId));
  const addressSnapshot = address ? JSON.stringify(address) : null;

  const subtotal = cartItems.reduce((sum, i) => sum + (i.price / 100) * i.quantity, 0);
  const total = subtotal + DELIVERY_FEE + PLATFORM_FEE;

  const firstSellerId = cartItems[0]?.sellerId ?? null;

  const [order] = await db.insert(ordersTable).values({
    userId: user.id,
    sellerId: firstSellerId,
    status: "pending",
    paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
    paymentMethod,
    addressId,
    addressSnapshot,
    subtotal,
    deliveryFee: DELIVERY_FEE,
    platformFee: PLATFORM_FEE,
    total,
    notes,
  }).returning();

  await db.insert(orderItemsTable).values(
    cartItems.map((item) => ({
      orderId: order.id,
      productId: item.productId!,
      quantity: item.quantity,
      price: item.price / 100,
      productName: item.name ?? null,
      productImage: Array.isArray(item.images) ? (item.images[0] ?? null) : null,
      productUnit: item.unit ?? null,
    }))
  );

  // Update seller stats
  if (firstSellerId) {
    const [seller] = await db.select({ totalOrders: sellersTable.totalOrders }).from(sellersTable)
      .where(eq(sellersTable.id, firstSellerId));
    if (seller) {
      await db.update(sellersTable).set({ totalOrders: (seller.totalOrders ?? 0) + 1 })
        .where(eq(sellersTable.id, firstSellerId));
    }
  }

  // Clear cart
  await db.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));

  res.status(201).json(await enrichOrder(order));
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(await enrichOrder(order));
});

router.patch("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, string> = { status: parsed.data.status };
  if (parsed.data.eta) updateData.eta = parsed.data.eta;

  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, params.data.id)).returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(await enrichOrder(order));
});

// Payment
router.post("/orders/:id/payment/create", requireAuth, async (req, res): Promise<void> => {
  const params = CreatePaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? "rzp_test_demo";
  const razorpayOrderId = `order_${Date.now()}_${order.id}`;

  await db.update(ordersTable).set({ razorpayOrderId }).where(eq(ordersTable.id, order.id));

  res.json({
    razorpayOrderId,
    amount: Math.round(order.total * 100),
    currency: "INR",
    keyId: razorpayKeyId,
  });
});

router.post("/orders/:id/payment/verify", requireAuth, async (req, res): Promise<void> => {
  const params = VerifyPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = VerifyPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "demo_secret";

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const isValid = expectedSig === razorpaySignature;

  const [order] = await db.update(ordersTable).set({
    paymentStatus: isValid ? "paid" : "failed",
    status: isValid ? "confirmed" : "pending",
  }).where(eq(ordersTable.id, params.data.id)).returning();

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(await enrichOrder(order));
});

export default router;
