import { Router } from "express";
import { User, Seller, Product, Order } from "@workspace/db";
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
  const [totalUsers, totalSellers, totalProducts, totalOrders, pendingSellerApprovals, activeOrders, allOrders] =
    await Promise.all([
      User.countDocuments(),
      Seller.countDocuments({ status: "approved" }),
      Product.countDocuments(),
      Order.countDocuments(),
      Seller.countDocuments({ status: "pending" }),
      Order.countDocuments({ status: "confirmed" }),
      Order.find({}, { total: 1, paymentStatus: 1, status: 1, createdAt: 1 }),
    ]);

  const totalRevenue = allOrders.filter((o) => o.paymentStatus === "paid").reduce((sum, o) => sum + o.total, 0);

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
  allOrders.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1; });
  const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  res.json({
    totalUsers,
    totalSellers,
    totalProducts,
    totalOrders,
    totalRevenue,
    pendingSellerApprovals,
    activeOrders,
    revenueByDay,
    ordersByStatus,
  });
});

router.get("/admin/users", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = AdminListUsersQueryParams.safeParse(req.query);
  const { role, page = 1, search } = params.success ? params.data : {};

  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (search) filter.name = { $regex: search, $options: "i" };

  const rows = await User.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .skip(((page ?? 1) - 1) * 50);

  res.json(rows.map((u) => { const { password: _pw, ...rest } = u.toJSON() as Record<string, unknown>; return rest; }));
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
  const user = await User.findByIdAndUpdate(params.data.id, parsed.data, { new: true });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { password: _pw, ...safeUser } = user.toJSON() as Record<string, unknown>;
  res.json(safeUser);
});

router.get("/admin/sellers/pending", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const rows = await Seller.find({ status: "pending" }).sort({ createdAt: -1 });

  const enriched = await Promise.all(
    rows.map(async (seller) => {
      const owner = await User.findById(seller.userId).select("name");
      const s = seller.toJSON() as Record<string, unknown>;
      return { ...s, ownerName: owner?.name ?? null, createdAt: seller.createdAt.toISOString() };
    }),
  );
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
  const seller = await Seller.findByIdAndUpdate(
    params.data.id,
    { status: parsed.data.status, isVerified: isApproved },
    { new: true },
  );

  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  const owner = await User.findById(seller.userId).select("name");
  const s = seller.toJSON() as Record<string, unknown>;
  res.json({ ...s, ownerName: owner?.name ?? null, createdAt: seller.createdAt.toISOString() });
});

router.get("/admin/orders", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = AdminListOrdersQueryParams.safeParse(req.query);
  const { status, page = 1 } = params.success ? params.data : {};

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const rows = await Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .skip(((page ?? 1) - 1) * 50);

  const enriched = await Promise.all(
    rows.map(async (order) => {
      const buyer = await User.findById(order.userId).select("name");
      const seller = order.sellerId ? await Seller.findById(order.sellerId) : null;
      const o = order.toJSON() as Record<string, unknown>;
      return {
        ...o,
        buyerName: buyer?.name ?? null,
        sellerName: seller?.storeName ?? null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      };
    }),
  );

  res.json(enriched);
});

export default router;
