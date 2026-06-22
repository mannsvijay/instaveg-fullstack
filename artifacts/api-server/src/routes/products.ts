import { Router } from "express";
import { Product, Seller, Category, Review, User } from "@workspace/db";
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

async function enrichProduct(product: Record<string, unknown>) {
  const seller = await Seller.findById(product.sellerId);
  const cat = await Category.findById(product.categoryId);
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
  const rows = await Product.find({ stock: { $gte: 1 } })
    .sort({ orderCount: -1 })
    .limit(limit);
  const enriched = await Promise.all(rows.map((p) => enrichProduct(p.toJSON())));
  res.json(enriched);
});

router.get("/products/fresh-picks", async (req, res): Promise<void> => {
  const params = GetFreshPicksQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 10) : 10;
  const rows = await Product.find({ isFresh: true, stock: { $gte: 1 } })
    .sort({ createdAt: -1 })
    .limit(limit);
  const enriched = await Promise.all(rows.map((p) => enrichProduct(p.toJSON())));
  res.json(enriched);
});

router.get("/products", async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { category, search, sellerId, page = 1, limit = 20, minPrice, maxPrice, inStock } = params.data;

  const filter: Record<string, unknown> = {};
  if (search) filter.name = { $regex: search, $options: "i" };
  if (sellerId) filter.sellerId = sellerId;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) (filter.price as Record<string, number>).$gte = minPrice;
    if (maxPrice !== undefined) (filter.price as Record<string, number>).$lte = maxPrice;
  }
  if (inStock) filter.stock = { $gte: 1 };

  if (category) {
    const cat = await Category.findOne({ slug: category });
    if (cat) filter.categoryId = cat._id;
  }

  const offset = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter).sort({ createdAt: -1 }).limit(limit).skip(offset),
  ]);

  const enriched = await Promise.all(rows.map((p) => enrichProduct(p.toJSON())));
  res.json({ products: enriched, total, page, limit });
});

router.post("/products", requireAuth, requireRole("seller", "admin"), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const seller = await Seller.findOne({ userId: user.id });
  if (!seller) {
    res.status(403).json({ error: "Seller profile not found" });
    return;
  }

  const product = new Product({ ...parsed.data, sellerId: seller._id });
  await product.save();
  res.status(201).json(await enrichProduct(product.toJSON()));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const product = await Product.findById(params.data.id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(await enrichProduct(product.toJSON()));
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
  const product = await Product.findByIdAndUpdate(params.data.id, parsed.data, { new: true });
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(await enrichProduct(product.toJSON()));
});

router.delete("/products/:id", requireAuth, requireRole("seller", "admin"), async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await Product.findByIdAndDelete(params.data.id);
  res.sendStatus(204);
});

router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const reviews = await Review.find({ productId: id }).sort({ createdAt: -1 });
  const enriched = await Promise.all(
    reviews.map(async (r) => {
      const user = await User.findById(r.userId).select("name avatar");
      return { ...r.toJSON(), userName: user?.name ?? null, userAvatar: user?.avatar ?? null };
    }),
  );
  res.json(enriched);
});

router.post("/products/:id/reviews", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as typeof req & { user: { id: number } }).user;
  const id = parseInt(req.params.id as string, 10);
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be 1-5" });
    return;
  }

  const review = new Review({ productId: id, userId: authUser.id, rating, comment });
  await review.save();

  const allReviews = await Review.find({ productId: id });
  const avg = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;
  await Product.findByIdAndUpdate(id, { rating: avg, reviewCount: allReviews.length });

  const user = await User.findById(authUser.id).select("name avatar");
  res.status(201).json({ ...review.toJSON(), userName: user?.name ?? null, userAvatar: user?.avatar ?? null });
});

export default router;
