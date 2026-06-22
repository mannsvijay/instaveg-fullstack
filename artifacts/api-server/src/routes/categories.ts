import { Router } from "express";
import { Category, Product } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { CreateCategoryBody, GetCategoryParams } from "@workspace/api-zod";

const router = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const rows = await Category.find().sort({ name: 1 });
  const withCount = await Promise.all(
    rows.map(async (cat) => {
      const count = await Product.countDocuments({ categoryId: cat._id });
      return { ...cat.toJSON(), productCount: count };
    }),
  );
  res.json(withCount);
});

router.post("/categories", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const cat = new Category(parsed.data);
  await cat.save();
  res.status(201).json({ ...cat.toJSON(), productCount: 0 });
});

router.get("/categories/:id", async (req, res): Promise<void> => {
  const params = GetCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const cat = await Category.findById(params.data.id);
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const count = await Product.countDocuments({ categoryId: cat._id });
  res.json({ ...cat.toJSON(), productCount: count });
});

export default router;
