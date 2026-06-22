import { Router } from "express";
import { Cart, Product, Seller } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { AddToCartBody, UpdateCartItemBody, UpdateCartItemParams, RemoveFromCartParams } from "@workspace/api-zod";

const router = Router();

const DELIVERY_FEE = 40;

async function getOrCreateCart(userId: number) {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = new Cart({ userId, items: [] });
    await cart.save();
  }
  return cart;
}

async function buildCartResponse(cart: Awaited<ReturnType<typeof getOrCreateCart>>) {
  const items = await Promise.all(
    cart.items.map(async (item) => {
      const product = await Product.findById(item.productId);
      const seller = product ? await Seller.findById(product.sellerId) : null;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: item.price / 100,
        productName: product?.name ?? null,
        productImage: product?.images?.[0] ?? null,
        productUnit: product?.unit ?? null,
        sellerId: product?.sellerId ?? null,
        sellerName: seller?.storeName ?? null,
        stock: product?.stock ?? 0,
      };
    }),
  );

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = items.length > 0 ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;

  return {
    id: cart._id,
    userId: cart.userId,
    items,
    updatedAt: cart.updatedAt.toISOString(),
    subtotal,
    deliveryFee,
    total,
  };
}

router.get("/cart", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const cart = await getOrCreateCart(user.id);
  res.json(await buildCartResponse(cart));
});

router.post("/cart/items", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = AddToCartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { productId, quantity } = parsed.data;

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const cart = await getOrCreateCart(user.id);
  const existingIdx = cart.items.findIndex((i) => i.productId === productId);

  if (existingIdx >= 0) {
    cart.items[existingIdx].quantity += quantity;
  } else {
    cart.items.push({ productId, quantity, price: Math.round(product.price * 100) });
  }

  cart.updatedAt = new Date();
  await cart.save();
  res.json(await buildCartResponse(cart));
});

router.patch("/cart/items/:productId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const params = UpdateCartItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCartItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cart = await getOrCreateCart(user.id);

  if (parsed.data.quantity <= 0) {
    cart.items = cart.items.filter((i) => i.productId !== params.data.productId);
  } else {
    const idx = cart.items.findIndex((i) => i.productId === params.data.productId);
    if (idx >= 0) cart.items[idx].quantity = parsed.data.quantity;
  }

  cart.updatedAt = new Date();
  await cart.save();
  res.json(await buildCartResponse(cart));
});

router.delete("/cart/items/:productId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const params = RemoveFromCartParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const cart = await getOrCreateCart(user.id);
  cart.items = cart.items.filter((i) => i.productId !== params.data.productId);
  cart.updatedAt = new Date();
  await cart.save();
  res.json(await buildCartResponse(cart));
});

router.delete("/cart", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const cart = await getOrCreateCart(user.id);
  cart.items = [];
  cart.updatedAt = new Date();
  await cart.save();
  res.sendStatus(204);
});

export default router;
