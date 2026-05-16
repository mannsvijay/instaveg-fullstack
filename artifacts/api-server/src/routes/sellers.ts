import { Router } from "express";
import { db, sellersTable, usersTable, ordersTable, productsTable, orderItemsTable } from "@workspace/db";
import { eq, desc, gte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import {
  ListSellersQueryParams,
  GetSellerParams,
  UpdateSellerProfileBody,
  GetSellerOrdersQueryParams,
} from "@workspace/api-zod";

const router = Router();

async function enrichSeller(seller: typeof sellersTable.$inferSelect) {
  const [owner] = await db.select({ name: usersTable.name }).from(usersTable)
    .where(eq(usersTable.id, seller.userId));
  return {
    ...seller,
    ownerName: owner?.name ?? null,
    createdAt: seller.createdAt.toISOString(),
  };
}

router.get("/sellers", async (req, res): Promise<void> => {
  const params = ListSellersQueryParams.safeParse(req.query);
  const { page = 1, limit = 20 } = params.success ? params.data : {};

  const rows = await db.select().from(sellersTable)
    .where(eq(sellersTable.status, "approved"))
    .orderBy(desc(sellersTable.rating))
    .limit(limit ?? 20).offset(((page ?? 1) - 1) * (limit ?? 20));

  const enriched = await Promise.all(rows.map(enrichSeller));
  res.json(enriched);
});

router.get("/sellers/dashboard/stats", requireAuth, requireRole("seller"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const [seller] = await db.select().from(sellersTable).where(eq(sellersTable.userId, user.id));
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  const products = await db.select().from(productsTable).where(eq(productsTable.sellerId, seller.id));
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.sellerId, seller.id));
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "confirmed");
  const totalRevenue = orders.filter((o) => o.paymentStatus === "paid").reduce((sum, o) => sum + o.total, 0);
  const lowStockProducts = products.filter((p) => p.stock < 10).length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentOrders = orders.filter((o) => new Date(o.createdAt) >= sevenDaysAgo && o.paymentStatus === "paid");
  const recentRevenue = recentOrders.reduce((sum, o) => sum + o.total, 0);

  // Revenue by day (last 7 days)
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
  orders.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  });
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
  const [seller] = await db.select().from(sellersTable).where(eq(sellersTable.userId, user.id));
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  const params = GetSellerOrdersQueryParams.safeParse(req.query);
  const { status, page = 1 } = params.success ? params.data : {};

  const rows = await db.select().from(ordersTable)
    .where(eq(ordersTable.sellerId, seller.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(20).offset(((page ?? 1) - 1) * 20);

  const enriched = await Promise.all(
    rows.map(async (order) => {
      const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
      const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, order.userId));
      return {
        ...order,
        items,
        buyerName: buyer?.name ?? null,
        sellerName: seller.storeName,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      };
    })
  );

  res.json(enriched);
});

router.get("/sellers/profile", requireAuth, requireRole("seller"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const [seller] = await db.select().from(sellersTable).where(eq(sellersTable.userId, user.id));
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  res.json(await enrichSeller(seller));
});

router.patch("/sellers/profile", requireAuth, requireRole("seller"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = UpdateSellerProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [seller] = await db.update(sellersTable).set(parsed.data)
    .where(eq(sellersTable.userId, user.id)).returning();
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  res.json(await enrichSeller(seller));
});

router.get("/sellers/:id", async (req, res): Promise<void> => {
  const params = GetSellerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [seller] = await db.select().from(sellersTable).where(eq(sellersTable.id, params.data.id));
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  res.json(await enrichSeller(seller));
});

export default router;
