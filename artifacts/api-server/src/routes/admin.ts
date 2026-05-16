import { Router } from "express";
import { db, usersTable, sellersTable, productsTable, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, desc, ilike, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import {
  AdminListUsersQueryParams,
  AdminUpdateUserBody,
  AdminUpdateUserParams,
  AdminApproveSellerParams,
  AdminApproveSellerBody,
  AdminListOrdersQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/admin/stats", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [sellerCount] = await db.select({ count: sql<number>`count(*)::int` }).from(sellersTable)
    .where(eq(sellersTable.status, "approved"));
  const [productCount] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable);
  const [orderCount] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable);
  const [pendingCount] = await db.select({ count: sql<number>`count(*)::int` }).from(sellersTable)
    .where(eq(sellersTable.status, "pending"));
  const [activeOrderCount] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable)
    .where(eq(ordersTable.status, "confirmed"));

  const allOrders = await db.select({ total: ordersTable.total, paymentStatus: ordersTable.paymentStatus, status: ordersTable.status, createdAt: ordersTable.createdAt })
    .from(ordersTable);
  const totalRevenue = allOrders.filter((o) => o.paymentStatus === "paid").reduce((sum, o) => sum + o.total, 0);

  // Revenue by day (last 7 days)
  const revenueByDay: { date: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayRevenue = allOrders
      .filter((o) => o.paymentStatus === "paid" && o.createdAt.toISOString().slice(0, 10) === dateStr)
      .reduce((sum, o) => sum + o.total, 0);
    revenueByDay.push({ date: dateStr, revenue: dayRevenue });
  }

  const statusCounts: Record<string, number> = {};
  allOrders.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  });
  const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  res.json({
    totalUsers: userCount?.count ?? 0,
    totalSellers: sellerCount?.count ?? 0,
    totalProducts: productCount?.count ?? 0,
    totalOrders: orderCount?.count ?? 0,
    totalRevenue,
    pendingSellerApprovals: pendingCount?.count ?? 0,
    activeOrders: activeOrderCount?.count ?? 0,
    revenueByDay,
    ordersByStatus,
  });
});

router.get("/admin/users", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = AdminListUsersQueryParams.safeParse(req.query);
  const { role, page = 1, search } = params.success ? params.data : {};

  const conditions = [];
  if (role) conditions.push(eq(usersTable.role, role));
  if (search) conditions.push(ilike(usersTable.name, `%${search}%`));

  const { and } = await import("drizzle-orm");
  const rows = await db.select().from(usersTable)
    .where(conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined)
    .orderBy(desc(usersTable.createdAt))
    .limit(50).offset(((page ?? 1) - 1) * 50);

  res.json(rows.map(({ password: _pw, ...u }) => u));
});

router.patch("/admin/users/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = AdminUpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AdminUpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.update(usersTable).set(parsed.data)
    .where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { password: _pw, ...safeUser } = user;
  res.json(safeUser);
});

router.get("/admin/sellers/pending", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(sellersTable)
    .where(eq(sellersTable.status, "pending"))
    .orderBy(desc(sellersTable.createdAt));

  const enriched = await Promise.all(rows.map(async (seller) => {
    const [owner] = await db.select({ name: usersTable.name }).from(usersTable)
      .where(eq(usersTable.id, seller.userId));
    return { ...seller, ownerName: owner?.name ?? null, createdAt: seller.createdAt.toISOString() };
  }));

  res.json(enriched);
});

router.patch("/admin/sellers/:id/approve", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = AdminApproveSellerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AdminApproveSellerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const isApproved = parsed.data.status === "approved";
  const [seller] = await db.update(sellersTable).set({
    status: parsed.data.status,
    isVerified: isApproved,
  }).where(eq(sellersTable.id, params.data.id)).returning();

  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  const [owner] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, seller.userId));
  res.json({ ...seller, ownerName: owner?.name ?? null, createdAt: seller.createdAt.toISOString() });
});

router.get("/admin/orders", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = AdminListOrdersQueryParams.safeParse(req.query);
  const { status, page = 1 } = params.success ? params.data : {};

  const conditions = [];
  if (status) conditions.push(eq(ordersTable.status, status));

  const { and } = await import("drizzle-orm");
  const rows = await db.select().from(ordersTable)
    .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(50).offset(((page ?? 1) - 1) * 50);

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
