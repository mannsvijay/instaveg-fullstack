import { Router } from "express";
import { db, cartsTable, cartItemsTable, productsTable, sellersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { approvedSellerProducts } from "../lib/product-visibility";
import { AddToCartBody, UpdateCartItemBody, UpdateCartItemParams, RemoveFromCartParams } from "@workspace/api-zod";

const router = Router();
const DELIVERY_FEE = 40;

async function getOrCreateCart(userId: number) {
  const [existing] = await db.select().from(cartsTable).where(eq(cartsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db.insert(cartsTable).values({ userId }).returning();
  return created;
}

async function buildCartResponse(cart: { id: number; userId: number; updatedAt: Date }) {
  const items = await db.select({
    id: cartItemsTable.id,
    productId: cartItemsTable.productId,
    quantity: cartItemsTable.quantity,
    price: cartItemsTable.price,
    productName: productsTable.name,
    productImage: productsTable.images,
    productUnit: productsTable.unit,
    sellerId: productsTable.sellerId,
    sellerName: sellersTable.storeName,
    stock: productsTable.stock,
  }).from(cartItemsTable)
    .leftJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .leftJoin(sellersTable, eq(productsTable.sellerId, sellersTable.id))
    .where(eq(cartItemsTable.cartId, cart.id));

  const formattedItems = items.map((item) => ({
    ...item,
    price: item.price / 100,
    productImage: Array.isArray(item.productImage) ? (item.productImage[0] ?? null) : null,
    sellerName: item.sellerName ?? null,
  }));
  const subtotal = formattedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = formattedItems.length > 0 ? DELIVERY_FEE : 0;

  return {
    id: cart.id,
    userId: cart.userId,
    items: formattedItems,
    updatedAt: cart.updatedAt.toISOString(),
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
  };
}

router.get("/cart", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  res.json(await buildCartResponse(await getOrCreateCart(user.id)));
});

router.post("/cart/items", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = AddToCartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { productId, quantity } = parsed.data;
  if (!Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ error: "Quantity must be a whole number of at least 1" });
    return;
  }
  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.id, productId), approvedSellerProducts()));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const cart = await getOrCreateCart(user.id);
  const [existing] = await db.select().from(cartItemsTable)
    .where(and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.productId, productId)));
  const newQuantity = (existing?.quantity ?? 0) + quantity;
  if (newQuantity > product.stock) {
    res.status(400).json({ error: `Only ${product.stock} in stock` });
    return;
  }
  if (existing) {
    await db.update(cartItemsTable).set({ quantity: newQuantity })
      .where(eq(cartItemsTable.id, existing.id));
  } else {
    await db.insert(cartItemsTable).values({ cartId: cart.id, productId, quantity, price: Math.round(product.price * 100) });
  }
  res.json(await buildCartResponse(cart));
});

router.patch("/cart/items/:productId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const params = UpdateCartItemParams.safeParse(req.params);
  const parsed = UpdateCartItemBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { quantity } = parsed.data;
  // 0 removes the line; otherwise a whole number not above stock (H8).
  if (!Number.isInteger(quantity) || quantity < 0) {
    res.status(400).json({ error: "Quantity must be a whole number of 0 or more" });
    return;
  }
  if (quantity > 0) {
    const [product] = await db.select({ stock: productsTable.stock }).from(productsTable)
      .where(eq(productsTable.id, params.data.productId));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    if (quantity > product.stock) {
      res.status(400).json({ error: `Only ${product.stock} in stock` });
      return;
    }
  }
  const cart = await getOrCreateCart(user.id);
  const condition = and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.productId, params.data.productId));
  if (quantity === 0) {
    await db.delete(cartItemsTable).where(condition);
  } else {
    await db.update(cartItemsTable).set({ quantity: parsed.data.quantity }).where(condition);
  }
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
  await db.delete(cartItemsTable).where(and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.productId, params.data.productId)));
  res.json(await buildCartResponse(cart));
});

router.delete("/cart", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const cart = await getOrCreateCart(user.id);
  await db.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
  res.sendStatus(204);
});

export default router;