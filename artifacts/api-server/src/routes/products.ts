import { Router } from "express";
import { db, productsTable, sellersTable, categoriesTable, reviewsTable, usersTable, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole, optionalUser } from "../lib/auth";
import { approvedSellerProducts, getSellerForUser, productVisibility } from "../lib/product-visibility";
import { uniqueProductSlug } from "../lib/slug";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  GetTrendingProductsQueryParams,
  GetFreshPicksQueryParams,
  CreateReviewBody,
} from "@workspace/api-zod";

const router = Router();

// Admin may change any product; a seller only products of their own sellers row.
async function canManageProduct(user: { id: number; role: string }, productId: number): Promise<boolean> {
  const [product] = await db.select({ sellerId: productsTable.sellerId }).from(productsTable)
    .where(eq(productsTable.id, productId));
  if (!product) return false;
  if (user.role === "admin") return true;
  const seller = await getSellerForUser(user.id);
  return seller?.id === product.sellerId;
}

const NOT_APPROVED = "Your seller account is awaiting approval";

async function enrichProduct(product: typeof productsTable.$inferSelect) {
  const [seller] = await db.select({ storeName: sellersTable.storeName, city: sellersTable.city })
    .from(sellersTable).where(eq(sellersTable.id, product.sellerId));
  const [category] = await db.select({ name: categoriesTable.name })
    .from(categoriesTable).where(eq(categoriesTable.id, product.categoryId));
  return {
    ...product,
    sellerName: seller?.storeName ?? null,
    sellerCity: seller?.city ?? null,
    categoryName: category?.name ?? null,
  };
}

router.get("/products/trending", async (req, res): Promise<void> => {
  const parsed = GetTrendingProductsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;
  const products = await db.select().from(productsTable)
    .where(and(gte(productsTable.stock, 1), approvedSellerProducts()))
    .orderBy(desc(productsTable.orderCount)).limit(limit);
  res.json(await Promise.all(products.map(enrichProduct)));
});

router.get("/products/fresh-picks", async (req, res): Promise<void> => {
  const parsed = GetFreshPicksQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;
  const products = await db.select().from(productsTable)
    .where(and(eq(productsTable.isFresh, true), gte(productsTable.stock, 1), approvedSellerProducts()))
    .orderBy(desc(productsTable.createdAt)).limit(limit);
  res.json(await Promise.all(products.map(enrichProduct)));
});

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { category, search, sellerId, page = 1, limit = 20, minPrice, maxPrice, inStock } = parsed.data;
  const conditions = [];
  const visibility = await productVisibility(optionalUser(req));
  if (visibility) conditions.push(visibility);
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (sellerId) conditions.push(eq(productsTable.sellerId, sellerId));
  if (minPrice !== undefined) conditions.push(gte(productsTable.price, minPrice));
  if (maxPrice !== undefined) conditions.push(lte(productsTable.price, maxPrice));
  if (inStock) conditions.push(gte(productsTable.stock, 1));
  if (category) {
    const [found] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
      .where(eq(categoriesTable.slug, category));
    if (found) conditions.push(eq(productsTable.categoryId, found.id));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * limit;
  const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(where);
  const products = await db.select().from(productsTable).where(where)
    .orderBy(desc(productsTable.createdAt)).limit(limit).offset(offset);
  res.json({ products: await Promise.all(products.map(enrichProduct)), total: total?.count ?? 0, page, limit });
});

router.post("/products", requireAuth, requireRole("seller", "admin"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number; role: string } }).user;
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [seller] = await db.select().from(sellersTable).where(eq(sellersTable.userId, user.id));
  if (!seller) {
    res.status(403).json({ error: "Seller profile not found" });
    return;
  }
  if (user.role !== "admin" && seller.status !== "approved") {
    res.status(403).json({ error: NOT_APPROVED });
    return;
  }
  const slug = await uniqueProductSlug(parsed.data.name);
  const [product] = await db.insert(productsTable).values({ ...parsed.data, slug, sellerId: seller.id }).returning();
  res.status(201).json(await enrichProduct(product));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const parsed = GetProductParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.id, parsed.data.id), await productVisibility(optionalUser(req))));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(await enrichProduct(product));
});

router.patch("/products/:id", requireAuth, requireRole("seller", "admin"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number; role: string } }).user;
  const params = UpdateProductParams.safeParse(req.params);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await canManageProduct(user, params.data.id))) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (user.role !== "admin" && (await getSellerForUser(user.id))?.status !== "approved") {
    res.status(403).json({ error: NOT_APPROVED });
    return;
  }
  const [product] = await db.update(productsTable).set(parsed.data)
    .where(eq(productsTable.id, params.data.id)).returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(await enrichProduct(product));
});

router.delete("/products/:id", requireAuth, requireRole("seller", "admin"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number; role: string } }).user;
  const parsed = DeleteProductParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await canManageProduct(user, parsed.data.id))) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, parsed.data.id));
  res.sendStatus(204);
});

// Path ids must be plain positive integers ("12abc" -> 400, not a DB error).
function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }
  const rows = await db.select({
    id: reviewsTable.id,
    productId: reviewsTable.productId,
    userId: reviewsTable.userId,
    rating: reviewsTable.rating,
    comment: reviewsTable.comment,
    createdAt: reviewsTable.createdAt,
    userName: usersTable.name,
    userAvatar: usersTable.avatar,
  }).from(reviewsTable).leftJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
    .where(eq(reviewsTable.productId, id)).orderBy(desc(reviewsTable.createdAt));
  res.json(rows);
});

router.post("/products/:id/reviews", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number; role: string } }).user;
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }
  const [product] = await db.select({ id: productsTable.id }).from(productsTable)
    .where(and(eq(productsTable.id, id), approvedSellerProducts()));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success || !Number.isInteger(parsed.data.rating)) {
    res.status(400).json({ error: "Rating must be a whole number from 1 to 5" });
    return;
  }
  const { rating, comment } = parsed.data;
  // Only buyers with a delivered order containing this product may review.
  const [purchase] = await db.select({ id: ordersTable.id }).from(ordersTable)
    .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(and(eq(ordersTable.userId, user.id), eq(ordersTable.status, "delivered"), eq(orderItemsTable.productId, id)))
    .limit(1);
  if (user.role !== "buyer" || !purchase) {
    res.status(403).json({ error: "Only buyers who received this product can review it" });
    return;
  }
  const review = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(reviewsTable).values({ productId: id, userId: user.id, rating, comment })
      .onConflictDoNothing({ target: [reviewsTable.productId, reviewsTable.userId] }).returning();
    if (!inserted) return null;
    const [stats] = await tx.select({ avg: sql<number>`avg(${reviewsTable.rating})::float8`, count: sql<number>`count(*)::int` })
      .from(reviewsTable).where(eq(reviewsTable.productId, id));
    await tx.update(productsTable).set({ rating: stats.avg, reviewCount: stats.count }).where(eq(productsTable.id, id));
    return inserted;
  });
  if (!review) {
    res.status(409).json({ error: "You have already reviewed this product" });
    return;
  }
  const [author] = await db.select({ name: usersTable.name, avatar: usersTable.avatar })
    .from(usersTable).where(eq(usersTable.id, user.id));
  res.status(201).json({ ...review, userName: author?.name ?? null, userAvatar: author?.avatar ?? null });
});

export default router;