import { Router } from "express";
import { db, usersTable, sellersTable, productsTable, ordersTable, orderItemsTable } from "@workspace/db";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import {
  AdminListUsersQueryParams, AdminUpdateUserBody, AdminUpdateUserParams,
  AdminApproveSellerParams, AdminApproveSellerBody, AdminListOrdersQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/admin/stats", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [sellerCount] = await db.select({ count: sql<number>`count(*)::int` }).from(sellersTable).where(eq(sellersTable.status, "approved"));
  const [productCount] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable);
  const [orderCount] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable);
  const [pendingCount] = await db.select({ count: sql<number>`count(*)::int` }).from(sellersTable).where(eq(sellersTable.status, "pending"));
  const [activeOrderCount] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "confirmed"));
  const orders = await db.select({
    total: ordersTable.total,
    paymentStatus: ordersTable.paymentStatus,
    status: ordersTable.status,
    createdAt: ordersTable.createdAt,
  }).from(ordersTable);
  const totalRevenue = orders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0);
  const revenueByDay: { date: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const date = day.toISOString().slice(0, 10);
    revenueByDay.push({
      date,
      revenue: orders.filter((order) => order.paymentStatus === "paid" && order.createdAt.toISOString().slice(0, 10) === date)
        .reduce((sum, order) => sum + order.total, 0),
    });
  }
  const statusCounts: Record<string, number> = {};
  orders.forEach((order) => { statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1; });
  res.json({
    totalUsers: userCount?.count ?? 0,
    totalSellers: sellerCount?.count ?? 0,
    totalProducts: productCount?.count ?? 0,
    totalOrders: orderCount?.count ?? 0,
    totalRevenue,
    pendingSellerApprovals: pendingCount?.count ?? 0,
    activeOrders: activeOrderCount?.count ?? 0,
    revenueByDay,
    ordersByStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
  });
});

router.get("/admin/users", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = AdminListUsersQueryParams.safeParse(req.query);
  const { role, page = 1, search } = parsed.success ? parsed.data : {};
  const conditions = [];
  if (role) conditions.push(eq(usersTable.role, role));
  if (search) conditions.push(ilike(usersTable.name, `%${search}%`));
  const rows = await db.select().from(usersTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(usersTable.createdAt)).limit(50).offset(((page ?? 1) - 1) * 50);
  res.json(rows.map(({ password: _pw, ...user }) => user));
});

router.patch("/admin/users/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = AdminUpdateUserParams.safeParse(req.params);
  const parsed = AdminUpdateUserBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { password: _pw, ...safeUser } = user;
  res.json(safeUser);
});

router.get("/admin/sellers/pending", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(sellersTable).where(eq(sellersTable.status, "pending")).orderBy(desc(sellersTable.createdAt));
  const enriched = await Promise.all(rows.map(async (seller) => {
    const [owner] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, seller.userId));
    return { ...seller, ownerName: owner?.name ?? null, createdAt: seller.createdAt.toISOString() };
  }));
  res.json(enriched);
});

router.patch("/admin/sellers/:id/approve", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = AdminApproveSellerParams.safeParse(req.params);
  const parsed = AdminApproveSellerBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [seller] = await db.update(sellersTable).set({
    status: parsed.data.status,
    isVerified: parsed.data.status === "approved",
  }).where(eq(sellersTable.id, params.data.id)).returning();
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  const [owner] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, seller.userId));
  res.json({ ...seller, ownerName: owner?.name ?? null, createdAt: seller.createdAt.toISOString() });
});

router.get("/admin/orders", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = AdminListOrdersQueryParams.safeParse(req.query);
  const { status, page = 1 } = parsed.success ? parsed.data : {};
  const rows = await db.select().from(ordersTable)
    .where(status ? eq(ordersTable.status, status) : undefined)
    .orderBy(desc(ordersTable.createdAt)).limit(50).offset(((page ?? 1) - 1) * 50);
  const enriched = await Promise.all(rows.map(async (order) => {
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, order.userId));
    const [seller] = order.sellerId
      ? await db.select({ storeName: sellersTable.storeName }).from(sellersTable).where(eq(sellersTable.id, order.sellerId))
      : [null];
    return {
      ...order,
      items,
      buyerName: buyer?.name ?? null,
      sellerName: seller?.storeName ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }));
  res.json(enriched);
});

export default router;