import { Router } from "express";
import { db, usersTable, addressesTable, productsTable, wishlistsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  UpdateUserProfileBody, AddAddressBody, UpdateAddressParams, UpdateAddressBody,
  DeleteAddressParams, AddToWishlistParams, RemoveFromWishlistParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const [found] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!found) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { password: _pw, ...safeUser } = found;
  res.json(safeUser);
});

router.patch("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = UpdateUserProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, user.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { password: _pw, ...safeUser } = updated;
  res.json(safeUser);
});

router.get("/users/addresses", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  res.json(await db.select().from(addressesTable).where(eq(addressesTable.userId, user.id)));
});

router.post("/users/addresses", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = AddAddressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.isDefault) {
    await db.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.userId, user.id));
  }
  const [address] = await db.insert(addressesTable).values({ ...parsed.data, userId: user.id }).returning();
  res.status(201).json(address);
});

router.patch("/users/addresses/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const params = UpdateAddressParams.safeParse(req.params);
  const parsed = UpdateAddressBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.isDefault) {
    await db.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.userId, user.id));
  }
  const [address] = await db.update(addressesTable).set(parsed.data)
    .where(and(eq(addressesTable.id, params.data.id), eq(addressesTable.userId, user.id))).returning();
  if (!address) {
    res.status(404).json({ error: "Address not found" });
    return;
  }
  res.json(address);
});

router.delete("/users/addresses/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = DeleteAddressParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.delete(addressesTable).where(and(eq(addressesTable.id, parsed.data.id), eq(addressesTable.userId, user.id)));
  res.sendStatus(204);
});

router.get("/wishlist", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const rows = await db.select({
    id: productsTable.id,
    name: productsTable.name,
    description: productsTable.description,
    price: productsTable.price,
    mrp: productsTable.mrp,
    unit: productsTable.unit,
    images: productsTable.images,
    stock: productsTable.stock,
    sellerId: productsTable.sellerId,
    categoryId: productsTable.categoryId,
    rating: productsTable.rating,
    reviewCount: productsTable.reviewCount,
    isFresh: productsTable.isFresh,
    isOrganic: productsTable.isOrganic,
    nutritionInfo: productsTable.nutritionInfo,
    tags: productsTable.tags,
    orderCount: productsTable.orderCount,
    createdAt: productsTable.createdAt,
    updatedAt: productsTable.updatedAt,
  }).from(wishlistsTable).leftJoin(productsTable, eq(wishlistsTable.productId, productsTable.id))
    .where(eq(wishlistsTable.userId, user.id));
  res.json(rows.filter((row) => row.id !== null).map((row) => ({
    ...row, sellerName: null, sellerCity: null, categoryName: null,
  })));
});

router.post("/wishlist/:productId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = AddToWishlistParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(wishlistsTable)
    .where(and(eq(wishlistsTable.userId, user.id), eq(wishlistsTable.productId, parsed.data.productId)));
  if (existing.length === 0) {
    await db.insert(wishlistsTable).values({ userId: user.id, productId: parsed.data.productId });
  }
  res.json({ added: true });
});

router.delete("/wishlist/:productId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = RemoveFromWishlistParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.delete(wishlistsTable).where(and(eq(wishlistsTable.userId, user.id), eq(wishlistsTable.productId, parsed.data.productId)));
  res.json({ removed: true });
});

export default router;