import { Router } from "express";
import { User, Address, Product, Wishlist } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  UpdateUserProfileBody,
  AddAddressBody,
  UpdateAddressParams,
  UpdateAddressBody,
  DeleteAddressParams,
  AddToWishlistParams,
  RemoveFromWishlistParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as typeof req & { user: { id: number } }).user;
  const user = await User.findById(authUser.id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { password: _pw, ...safeUser } = user.toJSON() as Record<string, unknown>;
  res.json(safeUser);
});

router.patch("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as typeof req & { user: { id: number } }).user;
  const parsed = UpdateUserProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await User.findByIdAndUpdate(authUser.id, parsed.data, { new: true });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { password: _pw, ...safeUser } = user.toJSON() as Record<string, unknown>;
  res.json(safeUser);
});

router.get("/users/addresses", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as typeof req & { user: { id: number } }).user;
  const rows = await Address.find({ userId: authUser.id });
  res.json(rows.map((a) => a.toJSON()));
});

router.post("/users/addresses", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as typeof req & { user: { id: number } }).user;
  const parsed = AddAddressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.isDefault) {
    await Address.updateMany({ userId: authUser.id }, { isDefault: false });
  }
  const addr = new Address({ ...parsed.data, userId: authUser.id });
  await addr.save();
  res.status(201).json(addr.toJSON());
});

router.patch("/users/addresses/:id", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as typeof req & { user: { id: number } }).user;
  const params = UpdateAddressParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAddressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.isDefault) {
    await Address.updateMany({ userId: authUser.id }, { isDefault: false });
  }
  const addr = await Address.findOneAndUpdate(
    { _id: params.data.id, userId: authUser.id },
    parsed.data,
    { new: true },
  );
  if (!addr) {
    res.status(404).json({ error: "Address not found" });
    return;
  }
  res.json(addr.toJSON());
});

router.delete("/users/addresses/:id", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as typeof req & { user: { id: number } }).user;
  const params = DeleteAddressParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await Address.findOneAndDelete({ _id: params.data.id, userId: authUser.id });
  res.sendStatus(204);
});

router.get("/wishlist", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as typeof req & { user: { id: number } }).user;
  const wishlists = await Wishlist.find({ userId: authUser.id });
  const products = await Promise.all(
    wishlists.map(async (w) => {
      const p = await Product.findById(w.productId);
      if (!p) return null;
      return { ...p.toJSON(), sellerName: null, sellerCity: null, categoryName: null };
    }),
  );
  res.json(products.filter(Boolean));
});

router.post("/wishlist/:productId", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as typeof req & { user: { id: number } }).user;
  const params = AddToWishlistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await Wishlist.findOne({ userId: authUser.id, productId: params.data.productId });
  if (!existing) {
    const w = new Wishlist({ userId: authUser.id, productId: params.data.productId });
    await w.save();
  }
  res.json({ added: true });
});

router.delete("/wishlist/:productId", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as typeof req & { user: { id: number } }).user;
  const params = RemoveFromWishlistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await Wishlist.findOneAndDelete({ userId: authUser.id, productId: params.data.productId });
  res.json({ removed: true });
});

export default router;
