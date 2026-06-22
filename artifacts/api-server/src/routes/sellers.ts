import { Router } from "express";
import { Seller, User, Order, Product } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import {
  ListSellersQueryParams,
  GetSellerParams,
  UpdateSellerProfileBody,
  GetSellerOrdersQueryParams,
} from "@workspace/api-zod";

const router = Router();

async function enrichSeller(seller: Record<string, unknown>) {
  const owner = await User.findById(seller.userId).select("name");
  return {
    ...seller,
    ownerName: owner?.name ?? null,
    createdAt: (seller.createdAt as Date)?.toISOString?.() ?? seller.createdAt,
  };
}

router.get("/sellers", async (req, res): Promise<void> => {
  const params = ListSellersQueryParams.safeParse(req.query);
  const { page = 1, limit = 20 } = params.success ? params.data : {};

  const rows = await Seller.find({ status: "approved" })
    .sort({ rating: -1 })
    .limit(limit ?? 20)
    .skip(((page ?? 1) - 1) * (limit ?? 20));

  const enriched = await Promise.all(rows.map((s) => enrichSeller(s.toJSON() as Record<string, unknown>)));
  res.json(enriched);
});

router.get("/sellers/dashboard/stats", requireAuth, requireRole("seller"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const seller = await Seller.findOne({ userId: user.id });
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  const [products, orders] = await Promise.all([
    Product.find({ sellerId: seller._id }),
    Order.find({ sellerId: seller._id }),
  ]);

  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "confirmed");
  const totalRevenue = orders.filter((o) => o.paymentStatus === "paid").reduce((sum, o) => sum + o.total, 0);
  const lowStockProducts = products.filter((p) => p.stock < 10).length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentRevenue = orders
    .filter((o) => new Date(o.createdAt) >= sevenDaysAgo && o.paymentStatus === "paid")
    .reduce((sum, o) => sum + o.total, 0);

  const revenueByDay: { date: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayRevenue = orders
      .filter((o) => o.paymentStatus === "paid" && o.createdAt.toISOString().slice(0, 10) === dateStr)
      .reduce((sum, o) => sum + o.total, 0);
    revenueByDay.push({ date: dateStr, revenue: dayRevenue });
  }

  const statusCounts: Record<string, number> = {};
  orders.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1; });
  const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  res.json({
    totalRevenue,
    totalOrders: orders.length,
    totalProducts: products.length,
    pendingOrders: pendingOrders.length,
    lowStockProducts,
    recentRevenue,
    revenueByDay,
    ordersByStatus,
  });
});

router.get("/sellers/dashboard/orders", requireAuth, requireRole("seller"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const seller = await Seller.findOne({ userId: user.id });
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  const params = GetSellerOrdersQueryParams.safeParse(req.query);
  const { page = 1 } = params.success ? params.data : {};

  const rows = await Order.find({ sellerId: seller._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .skip(((page ?? 1) - 1) * 20);

  const enriched = await Promise.all(
    rows.map(async (order) => {
      const buyer = await User.findById(order.userId).select("name");
      const o = order.toJSON() as Record<string, unknown>;
      return {
        ...o,
        buyerName: buyer?.name ?? null,
        sellerName: seller.storeName,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      };
    }),
  );

  res.json(enriched);
});

router.get("/sellers/profile", requireAuth, requireRole("seller"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const seller = await Seller.findOne({ userId: user.id });
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  res.json(await enrichSeller(seller.toJSON() as Record<string, unknown>));
});

router.patch("/sellers/profile", requireAuth, requireRole("seller"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = UpdateSellerProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const seller = await Seller.findOneAndUpdate({ userId: user.id }, parsed.data, { new: true });
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  res.json(await enrichSeller(seller.toJSON() as Record<string, unknown>));
});

router.get("/sellers/:id", async (req, res): Promise<void> => {
  const params = GetSellerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const seller = await Seller.findById(params.data.id);
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  res.json(await enrichSeller(seller.toJSON() as Record<string, unknown>));
});

export default router;
