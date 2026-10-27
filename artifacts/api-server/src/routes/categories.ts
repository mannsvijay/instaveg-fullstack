import { Router } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { approvedSellerProducts } from "../lib/product-visibility";
import { CreateCategoryBody, GetCategoryParams } from "@workspace/api-zod";

const router = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  // One grouped count instead of one query per category (M9).
  const [rows, counts] = await Promise.all([
    db.select().from(categoriesTable).orderBy(categoriesTable.name),
    db.select({ categoryId: productsTable.categoryId, count: sql<number>`count(*)::int` })
      .from(productsTable).where(approvedSellerProducts()).groupBy(productsTable.categoryId),
  ]);
  const countByCategory = new Map(counts.map((row) => [row.categoryId, row.count]));
  res.json(rows.map((cat) => ({ ...cat, productCount: countByCategory.get(cat.id) ?? 0 })));
});

router.post("/categories", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db.insert(categoriesTable).values(parsed.data).returning();
  res.status(201).json({ ...category, productCount: 0 });
});

router.get("/categories/:id", async (req, res): Promise<void> => {
  const parsed = GetCategoryParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, parsed.data.id));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const [count] = await db.select({ count: sql<number>`count(*)::int` })
    .from(productsTable).where(and(eq(productsTable.categoryId, category.id), approvedSellerProducts()));
  res.json({ ...category, productCount: count?.count ?? 0 });
});

export default router;