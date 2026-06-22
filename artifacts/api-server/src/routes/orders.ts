import { Router } from "express";
import { Order, Cart, Product, Address, User, Seller } from "@workspace/db";
import { requireAuth } from "../lib/auth";
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

function enrichOrder(order: Record<string, unknown>, sellerName: string | null, buyerName: string | null) {
  return {
    ...order,
    sellerName,
    buyerName,
    createdAt: (order.createdAt as Date)?.toISOString?.() ?? order.createdAt,
    updatedAt: (order.updatedAt as Date)?.toISOString?.() ?? order.updatedAt,
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number; role: string } }).user;
  const params = ListOrdersQueryParams.safeParse(req.query);
  const { status, page = 1, limit = 20 } = params.success ? params.data : {};

  const filter: Record<string, unknown> = {};
  if (user.role === "buyer") filter.userId = user.id;
  if (status) filter.status = status;

  const offset = ((page ?? 1) - 1) * (limit ?? 20);
  const rows = await Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit ?? 20)
    .skip(offset);

  const enriched = await Promise.all(
    rows.map(async (order) => {
      const o = order.toJSON() as Record<string, unknown>;
      const seller = order.sellerId ? await Seller.findById(order.sellerId) : null;
      const buyer = await User.findById(order.userId);
      return enrichOrder(o, seller?.storeName ?? null, buyer?.name ?? null);
    }),
  );
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

  const cart = await Cart.findOne({ userId: user.id });
  if (!cart || cart.items.length === 0) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  const cartItems = await Promise.all(
    cart.items.map(async (item) => {
      const product = await Product.findById(item.productId);
      return { ...item, product };
    }),
  );

  const address = addressId ? await Address.findById(addressId) : null;
  const addressSnapshot = address ? JSON.stringify(address.toJSON()) : null;

  const subtotal = cartItems.reduce((sum, i) => sum + (i.price / 100) * i.quantity, 0);
  const total = subtotal + DELIVERY_FEE + PLATFORM_FEE;

  const firstSellerId = cartItems[0]?.product?.sellerId ?? null;

  const order = new Order({
    userId: user.id,
    sellerId: firstSellerId,
    status: "pending",
    paymentStatus: "pending",
    paymentMethod,
    addressId,
    addressSnapshot,
    subtotal,
    deliveryFee: DELIVERY_FEE,
    platformFee: PLATFORM_FEE,
    total,
    notes,
    items: cartItems.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      price: i.price / 100,
      productName: i.product?.name ?? null,
      productImage: i.product?.images?.[0] ?? null,
      productUnit: i.product?.unit ?? null,
      sellerId: i.product?.sellerId ?? null,
    })),
  });
  await order.save();

  if (firstSellerId) {
    await Seller.findByIdAndUpdate(firstSellerId, { $inc: { totalOrders: 1 } });
  }

  cart.items = [];
  cart.updatedAt = new Date();
  await cart.save();

  const seller = firstSellerId ? await Seller.findById(firstSellerId) : null;
  const buyer = await User.findById(user.id);
  res.status(201).json(enrichOrder(order.toJSON() as Record<string, unknown>, seller?.storeName ?? null, buyer?.name ?? null));
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const order = await Order.findById(params.data.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const seller = order.sellerId ? await Seller.findById(order.sellerId) : null;
  const buyer = await User.findById(order.userId);
  res.json(enrichOrder(order.toJSON() as Record<string, unknown>, seller?.storeName ?? null, buyer?.name ?? null));
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

  const update: Record<string, string> = { status: parsed.data.status as string };
  if (parsed.data.eta) update.eta = parsed.data.eta;

  const order = await Order.findByIdAndUpdate(params.data.id, update, { new: true });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const seller = order.sellerId ? await Seller.findById(order.sellerId) : null;
  const buyer = await User.findById(order.userId);
  res.json(enrichOrder(order.toJSON() as Record<string, unknown>, seller?.storeName ?? null, buyer?.name ?? null));
});

router.post("/orders/:id/payment/create", requireAuth, async (req, res): Promise<void> => {
  const params = CreatePaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const order = await Order.findById(params.data.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? "rzp_test_demo";
  const razorpayOrderId = `order_${Date.now()}_${order._id}`;
  await Order.findByIdAndUpdate(order._id, { razorpayOrderId });

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

  const order = await Order.findByIdAndUpdate(
    params.data.id,
    { paymentStatus: isValid ? "paid" : "failed", status: isValid ? "confirmed" : "pending" },
    { new: true },
  );

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const seller = order.sellerId ? await Seller.findById(order.sellerId) : null;
  const buyer = await User.findById(order.userId);
  res.json(enrichOrder(order.toJSON() as Record<string, unknown>, seller?.storeName ?? null, buyer?.name ?? null));
});

export default router;
