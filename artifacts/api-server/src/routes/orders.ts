import { Router } from "express";
import { db, ordersTable, orderItemsTable, cartItemsTable, cartsTable, productsTable, addressesTable, usersTable, sellersTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  CreateOrderBody, GetOrderParams, ListOrdersQueryParams, UpdateOrderStatusParams,
  UpdateOrderStatusBody, CreatePaymentParams, VerifyPaymentParams, VerifyPaymentBody,
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
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  const { status, page = 1, limit = 20 } = parsed.success ? parsed.data : {};
  const conditions = [];
  if (user.role === "buyer") conditions.push(eq(ordersTable.userId, user.id));
  if (status) conditions.push(eq(ordersTable.status, status));
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db.select().from(ordersTable).where(where)
    .orderBy(desc(ordersTable.createdAt)).limit(limit ?? 20).offset(((page ?? 1) - 1) * (limit ?? 20));
  res.json(await Promise.all(rows.map(enrichOrder)));
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { addressId, paymentMethod, notes } = parsed.data;
  const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, user.id));
  if (!cart) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }
  const cartItems = await db.select({
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

  const [address] = addressId
    ? await db.select().from(addressesTable).where(eq(addressesTable.id, addressId))
    : [null];
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price / 100) * item.quantity, 0);
  const firstSellerId = cartItems[0]?.sellerId ?? null;
  const [order] = await db.insert(ordersTable).values({
    userId: user.id,
    sellerId: firstSellerId,
    status: "pending",
    paymentStatus: "pending",
    paymentMethod,
    addressId,
    addressSnapshot: address ? JSON.stringify(address) : null,
    subtotal,
    deliveryFee: DELIVERY_FEE,
    platformFee: PLATFORM_FEE,
    total: subtotal + DELIVERY_FEE + PLATFORM_FEE,
    notes,
  }).returning();

  await db.insert(orderItemsTable).values(cartItems.map((item) => ({
    orderId: order.id,
    productId: item.productId,
    quantity: item.quantity,
    price: item.price / 100,
    productName: item.name ?? null,
    productImage: Array.isArray(item.images) ? (item.images[0] ?? null) : null,
    productUnit: item.unit ?? null,
  })));
  if (firstSellerId) {
    const [seller] = await db.select({ totalOrders: sellersTable.totalOrders }).from(sellersTable).where(eq(sellersTable.id, firstSellerId));
    if (seller) {
      await db.update(sellersTable).set({ totalOrders: (seller.totalOrders ?? 0) + 1 }).where(eq(sellersTable.id, firstSellerId));
    }
  }
  await db.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
  res.status(201).json(await enrichOrder(order));
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetOrderParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(await enrichOrder(order));
});

router.patch("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db.update(ordersTable).set({
    status: parsed.data.status,
    ...(parsed.data.eta ? { eta: parsed.data.eta } : {}),
  }).where(eq(ordersTable.id, params.data.id)).returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(await enrichOrder(order));
});

router.post("/orders/:id/payment/create", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePaymentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const razorpayOrderId = `order_${Date.now()}_${order.id}`;
  await db.update(ordersTable).set({ razorpayOrderId }).where(eq(ordersTable.id, order.id));
  res.json({
    razorpayOrderId,
    amount: Math.round(order.total * 100),
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID ?? "rzp_test_demo",
  });
});

router.post("/orders/:id/payment/verify", requireAuth, async (req, res): Promise<void> => {
  const params = VerifyPaymentParams.safeParse(req.params);
  const parsed = VerifyPaymentBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;
  const expectedSig = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "demo_secret")
    .update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  const [order] = await db.update(ordersTable).set({
    paymentStatus: expectedSig === razorpaySignature ? "paid" : "failed",
    status: expectedSig === razorpaySignature ? "confirmed" : "pending",
  }).where(eq(ordersTable.id, params.data.id)).returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(await enrichOrder(order));
});

export default router;