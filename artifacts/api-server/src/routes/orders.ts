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

type AuthUser = { id: number; role: string };

// Forward-only, one step at a time. delivered and cancelled are final.
const NEXT_STATUS: Record<string, string> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "dispatched",
  dispatched: "delivered",
};
const CANCELLABLE = ["pending", "confirmed"];

// Razorpay is disabled unless both keys are configured (COD-only otherwise).
function razorpayConfig(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return keyId && keySecret ? { keyId, keySecret } : null;
}

// Sellers act through their sellers row, not their user id.
async function getSellerIdForUser(userId: number): Promise<number | null> {
  const [seller] = await db.select({ id: sellersTable.id }).from(sellersTable).where(eq(sellersTable.userId, userId));
  return seller?.id ?? null;
}

// Buyer who placed the order, the seller it belongs to, or admin.
async function canAccessOrder(user: AuthUser, order: typeof ordersTable.$inferSelect): Promise<boolean> {
  if (user.role === "admin" || order.userId === user.id) return true;
  if (user.role === "seller" && order.sellerId !== null) {
    return (await getSellerIdForUser(user.id)) === order.sellerId;
  }
  return false;
}

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
  const user = (req as typeof req & { user: AuthUser }).user;
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  const { status, page = 1, limit = 20 } = parsed.success ? parsed.data : {};
  const conditions = [];
  if (user.role === "seller") {
    const sellerId = await getSellerIdForUser(user.id);
    if (sellerId === null) {
      res.json([]);
      return;
    }
    conditions.push(eq(ordersTable.sellerId, sellerId));
  } else if (user.role !== "admin") {
    conditions.push(eq(ordersTable.userId, user.id));
  }
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
  if (paymentMethod === "razorpay" && !razorpayConfig()) {
    res.status(400).json({ error: "Online payment is not available; please choose Cash on Delivery" });
    return;
  }
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

  const [address] = await db.select().from(addressesTable)
    .where(and(eq(addressesTable.id, addressId), eq(addressesTable.userId, user.id)));
  if (!address) {
    res.status(400).json({ error: "Address not found" });
    return;
  }
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
  const user = (req as typeof req & { user: AuthUser }).user;
  const parsed = GetOrderParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.id));
  if (!order || !(await canAccessOrder(user, order))) {
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
  const user = (req as typeof req & { user: AuthUser }).user;
  const [current] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!current || !(await canAccessOrder(user, current))) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const next = parsed.data.status;
  const isStaff = user.role === "admin"
    || (user.role === "seller" && current.sellerId !== null && (await getSellerIdForUser(user.id)) === current.sellerId);
  if (!isStaff && !(next === "cancelled" && current.status === "pending")) {
    res.status(403).json({ error: "Buyers may only cancel their own pending orders" });
    return;
  }
  const allowed = next === "cancelled" ? CANCELLABLE.includes(current.status) : NEXT_STATUS[current.status] === next;
  if (!allowed) {
    res.status(400).json({ error: `Cannot change order status from ${current.status} to ${next}` });
    return;
  }
  const [order] = await db.update(ordersTable).set({
    status: next,
    ...(isStaff && parsed.data.eta ? { eta: parsed.data.eta } : {}),
  }).where(and(eq(ordersTable.id, current.id), eq(ordersTable.status, current.status))).returning();
  if (!order) {
    res.status(409).json({ error: "Order status changed concurrently, please retry" });
    return;
  }
  res.json(await enrichOrder(order));
});

router.post("/orders/:id/payment/create", requireAuth, async (req, res): Promise<void> => {
  const config = razorpayConfig();
  if (!config) {
    res.status(503).json({ error: "Online payment is not available" });
    return;
  }
  const user = (req as typeof req & { user: AuthUser }).user;
  const parsed = CreatePaymentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.id));
  if (!order || order.userId !== user.id) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.paymentMethod !== "razorpay" || order.paymentStatus === "paid") {
    res.status(400).json({ error: "Order is not awaiting online payment" });
    return;
  }
  const razorpayOrderId = `order_${Date.now()}_${order.id}`;
  await db.update(ordersTable).set({ razorpayOrderId }).where(eq(ordersTable.id, order.id));
  res.json({
    razorpayOrderId,
    amount: Math.round(order.total * 100),
    currency: "INR",
    keyId: config.keyId,
  });
});

router.post("/orders/:id/payment/verify", requireAuth, async (req, res): Promise<void> => {
  const config = razorpayConfig();
  if (!config) {
    res.status(503).json({ error: "Online payment is not available" });
    return;
  }
  const user = (req as typeof req & { user: AuthUser }).user;
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
  const [current] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!current || current.userId !== user.id) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  // Signature must be over the razorpayOrderId we issued for this order.
  if (!current.razorpayOrderId || razorpayOrderId !== current.razorpayOrderId) {
    res.status(400).json({ error: "Payment verification failed" });
    return;
  }
  const expected = Buffer.from(crypto.createHmac("sha256", config.keySecret)
    .update(`${current.razorpayOrderId}|${razorpayPaymentId}`).digest("hex"));
  const received = Buffer.from(razorpaySignature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    res.status(400).json({ error: "Payment verification failed" });
    return;
  }
  const [order] = await db.update(ordersTable).set({ paymentStatus: "paid", status: "confirmed" })
    .where(eq(ordersTable.id, current.id)).returning();
  res.json(await enrichOrder(order));
});

export default router;