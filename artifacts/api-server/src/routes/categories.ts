import { Router } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { CreateCategoryBody, GetCategoryParams } from "@workspace/api-zod";

const router = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  const withCount = await Promise.all(rows.map(async (cat) => {
    const [count] = await db.select({ count: sql<number>`count(*)::int` })
      .from(productsTable).where(eq(productsTable.categoryId, cat.id));
    return { ...cat, productCount: count?.count ?? 0 };
  }));
  res.json(withCount);
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
    .from(productsTable).where(eq(productsTable.categoryId, category.id));
  res.json({ ...category, productCount: count?.count ?? 0 });
});

export default router;