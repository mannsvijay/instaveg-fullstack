import { Router } from "express";
import { db, productsTable, sellersTable, categoriesTable, reviewsTable, usersTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  GetTrendingProductsQueryParams,
  GetFreshPicksQueryParams,
} from "@workspace/api-zod";

const router = Router();

async function enrichProduct(product: typeof productsTable.$inferSelect) {
  const [seller] = await db.select({ storeName: sellersTable.storeName, city: sellersTable.city })
    .from(sellersTable).where(eq(sellersTable.id, product.sellerId));
  const [cat] = await db.select({ name: categoriesTable.name })
    .from(categoriesTable).where(eq(categoriesTable.id, product.categoryId));
  return {
    ...product,
    sellerName: seller?.storeName ?? null,
    sellerCity: seller?.city ?? null,
    categoryName: cat?.name ?? null,
  };
}

router.get("/products/trending", async (req, res): Promise<void> => {
  const params = GetTrendingProductsQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 10) : 10;
  const rows = await db.select().from(productsTable)
    .where(gte(productsTable.stock, 1))
    .orderBy(desc(productsTable.orderCount))
    .limit(limit);
  const enriched = await Promise.all(rows.map(enrichProduct));
  res.json(enriched);
});

router.get("/products/fresh-picks", async (req, res): Promise<void> => {
  const params = GetFreshPicksQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 10) : 10;
  const rows = await db.select().from(productsTable)
    .where(and(eq(productsTable.isFresh, true), gte(productsTable.stock, 1)))
    .orderBy(desc(productsTable.createdAt))
    .limit(limit);
  const enriched = await Promise.all(rows.map(enrichProduct));
  res.json(enriched);
});

router.get("/products", async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { category, search, sellerId, page = 1, limit = 20, minPrice, maxPrice, inStock } = params.data;

  const conditions = [];

  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (sellerId) conditions.push(eq(productsTable.sellerId, sellerId));
  if (minPrice !== undefined) conditions.push(gte(productsTable.price, minPrice));
  if (maxPrice !== undefined) conditions.push(lte(productsTable.price, maxPrice));
  if (inStock) conditions.push(gte(productsTable.stock, 1));

  if (category) {
    const [cat] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
      .where(eq(categoriesTable.slug, category));
    if (cat) conditions.push(eq(productsTable.categoryId, cat.id));
  }

  const offset = (page - 1) * limit;
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(where);
  const rows = await db.select().from(productsTable)
    .where(where)
    .orderBy(desc(productsTable.createdAt))
    .limit(limit).offset(offset);

  const enriched = await Promise.all(rows.map(enrichProduct));
  res.json({ products: enriched, total: totalRow?.count ?? 0, page, limit });
});

router.post("/products", requireAuth, requireRole("seller", "admin"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
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

  const [product] = await db.insert(productsTable).values({
    ...parsed.data,
    sellerId: seller.id,
  }).returning();

  res.status(201).json(await enrichProduct(product));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(await enrichProduct(product));
});

router.patch("/products/:id", requireAuth, requireRole("seller", "admin"), async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, params.data.id));
  res.sendStatus(204);
});

// Reviews
router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const rows = await db.select({
    id: reviewsTable.id,
    productId: reviewsTable.productId,
    userId: reviewsTable.userId,
    rating: reviewsTable.rating,
    comment: reviewsTable.comment,
    createdAt: reviewsTable.createdAt,
    userName: usersTable.name,
    userAvatar: usersTable.avatar,
  }).from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
    .where(eq(reviewsTable.productId, id))
    .orderBy(desc(reviewsTable.createdAt));
  res.json(rows);
});

router.post("/products/:id/reviews", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be 1-5" });
    return;
  }

  const [review] = await db.insert(reviewsTable).values({
    productId: id,
    userId: user.id,
    rating,
    comment,
  }).returning();

  // Update product average rating
  const allReviews = await db.select({ rating: reviewsTable.rating }).from(reviewsTable)
    .where(eq(reviewsTable.productId, id));
  const avg = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;
  await db.update(productsTable).set({ rating: avg, reviewCount: allReviews.length })
    .where(eq(productsTable.id, id));

  const [userData] = await db.select({ name: usersTable.name, avatar: usersTable.avatar })
    .from(usersTable).where(eq(usersTable.id, user.id));

  res.status(201).json({ ...review, userName: userData?.name ?? null, userAvatar: userData?.avatar ?? null });
});

export default router;
