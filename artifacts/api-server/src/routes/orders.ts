import { Router } from "express";
import { db, ordersTable, orderItemsTable, cartItemsTable, cartsTable, productsTable, addressesTable, usersTable, sellersTable } from "@workspace/db";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { priceCart } from "../lib/pricing";
import { orderFields } from "../lib/order-fields";
import {
  CreateOrderBody, GetOrderParams, ListOrdersQueryParams, UpdateOrderStatusParams,
  UpdateOrderStatusBody,
} from "@workspace/api-zod";

const router = Router();

type AuthUser = { id: number; role: string };

// Checkout problems the buyer can fix (empty cart, unavailable or out-of-stock items) -> 400.
class CheckoutError extends Error {}

// Forward-only, one step at a time. delivered and cancelled are final.
const NEXT_STATUS: Record<string, string> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "dispatched",
  dispatched: "delivered",
};
const CANCELLABLE = ["pending", "confirmed"];

// Sellers act through their sellers row, not their user id.
async function getSellerIdForUser(userId: number): Promise<number | null> {
  const [seller] = await db.select({ id: sellersTable.id }).from(sellersTable).where(eq(sellersTable.userId, userId));
  return seller?.id ?? null;
}

// Buyer who placed the order, the seller it belongs to, or admin.
async function canAccessOrder(user: AuthUser, order: typeof ordersTable.$inferSelect): Promise<boolean> {
  if (user.role === "admin" || order.userId === user.id) return true;
  if (user.role === "seller" && order.sellerId !== null) {
    return (await getSellerIdForUser(user.id)) === order.sellerId;
  }
  return false;
}

async function enrichOrder(order: typeof ordersTable.$inferSelect) {
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const [seller] = order.sellerId
    ? await db.select({ storeName: sellersTable.storeName }).from(sellersTable).where(eq(sellersTable.id, order.sellerId))
    : [null];
  const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, order.userId));
  return {
    ...orderFields(order),
    items,
    sellerName: seller?.storeName ?? null,
    buyerName: buyer?.name ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthUser }).user;
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  const { status, page = 1, limit = 20 } = parsed.success ? parsed.data : {};
  const conditions = [];
  if (user.role === "seller") {
    const sellerId = await getSellerIdForUser(user.id);
    if (sellerId === null) {
      res.json([]);
      return;
    }
    conditions.push(eq(ordersTable.sellerId, sellerId));
  } else if (user.role !== "admin") {
    conditions.push(eq(ordersTable.userId, user.id));
  }
  if (status) conditions.push(eq(ordersTable.status, status));
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db.select().from(ordersTable).where(where)
    .orderBy(desc(ordersTable.createdAt)).limit(limit ?? 20).offset(((page ?? 1) - 1) * (limit ?? 20));
  res.json(await Promise.all(rows.map(enrichOrder)));
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // paymentMethod is validated as "cod" by the schema: COD-only by design (H4).
  const { addressId, paymentMethod, notes } = parsed.data;
  const [address] = await db.select().from(addressesTable)
    .where(and(eq(addressesTable.id, addressId), eq(addressesTable.userId, user.id)));
  if (!address) {
    res.status(400).json({ error: "Address not found" });
    return;
  }

  let orders: (typeof ordersTable.$inferSelect)[];
  try {
    // Whole checkout is atomic (M2): any failure rolls back every write.
    orders = await db.transaction(async (tx) => {
      const [cart] = await tx.select().from(cartsTable).where(eq(cartsTable.userId, user.id));
      const cartLines = cart
        ? await tx.select({ productId: cartItemsTable.productId, quantity: cartItemsTable.quantity })
          .from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id))
        : [];
      if (!cart || cartLines.length === 0) throw new CheckoutError("Cart is empty");

      // Lock the products (in id order) so stock and price can't change underneath us.
      const products = await tx.select({
        id: productsTable.id, name: productsTable.name, price: productsTable.price, stock: productsTable.stock,
        images: productsTable.images, unit: productsTable.unit, sellerId: productsTable.sellerId,
        sellerStatus: sellersTable.status,
      }).from(productsTable)
        .innerJoin(sellersTable, eq(productsTable.sellerId, sellersTable.id))
        .where(inArray(productsTable.id, cartLines.map((line) => line.productId)))
        .orderBy(productsTable.id)
        .for("update", { of: productsTable });
      const productById = new Map(products.map((product) => [product.id, product]));
      const unavailable = cartLines.filter((line) => productById.get(line.productId)?.sellerStatus !== "approved");
      if (unavailable.length > 0) {
        throw new CheckoutError("Some items in your cart are no longer available; please remove them and try again");
      }

      // Current product price, never the price stored in the cart (H8).
      const lines = cartLines
        .map((line) => ({ ...line, product: productById.get(line.productId)!, price: productById.get(line.productId)!.price }))
        .sort((a, b) => a.productId - b.productId);
      const cartPrice = priceCart(lines);

      // One order per seller (H7). Fees are charged once, on the first order,
      // so the order totals add up to the cart total (H10).
      const sellerIds = [...new Set(lines.map((line) => line.product.sellerId))].sort((a, b) => a - b);
      const created: (typeof ordersTable.$inferSelect)[] = [];
      for (const [index, sellerId] of sellerIds.entries()) {
        const sellerLines = lines.filter((line) => line.product.sellerId === sellerId);
        const { subtotal } = priceCart(sellerLines);
        const deliveryFee = index === 0 ? cartPrice.deliveryFee : 0;
        const platformFee = index === 0 ? cartPrice.platformFee : 0;
        const [order] = await tx.insert(ordersTable).values({
          userId: user.id,
          sellerId,
          status: "pending",
          paymentStatus: "pending",
          paymentMethod,
          addressId,
          addressSnapshot: JSON.stringify(address),
          subtotal,
          deliveryFee,
          platformFee,
          total: Math.round((subtotal + deliveryFee + platformFee) * 100) / 100,
          notes,
        }).returning();
        await tx.insert(orderItemsTable).values(sellerLines.map((line) => ({
          orderId: order.id,
          productId: line.productId,
          quantity: line.quantity,
          price: line.price,
          productName: line.product.name,
          productImage: line.product.images[0] ?? null,
          productUnit: line.product.unit,
        })));
        await tx.update(sellersTable).set({ totalOrders: sql`${sellersTable.totalOrders} + 1` })
          .where(eq(sellersTable.id, sellerId));
        created.push(order);
      }

      // Decrement stock only if enough is left; otherwise roll everything back.
      for (const line of lines) {
        const [updated] = await tx.update(productsTable)
          .set({ stock: sql`${productsTable.stock} - ${line.quantity}` })
          .where(and(eq(productsTable.id, line.productId), gte(productsTable.stock, line.quantity)))
          .returning({ id: productsTable.id });
        if (!updated) {
          throw new CheckoutError(`Only ${line.product.stock} left of ${line.product.name}; please update your cart`);
        }
      }

      await tx.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
      return created;
    });
  } catch (err) {
    if (err instanceof CheckoutError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
  res.status(201).json(await Promise.all(orders.map(enrichOrder)));
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthUser }).user;
  const parsed = GetOrderParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.id));
  if (!order || !(await canAccessOrder(user, order))) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(await enrichOrder(order));
});

router.patch("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as typeof req & { user: AuthUser }).user;
  const [current] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!current || !(await canAccessOrder(user, current))) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const next = parsed.data.status;
  const isStaff = user.role === "admin"
    || (user.role === "seller" && current.sellerId !== null && (await getSellerIdForUser(user.id)) === current.sellerId);
  if (!isStaff && !(next === "cancelled" && current.status === "pending")) {
    res.status(403).json({ error: "Buyers may only cancel their own pending orders" });
    return;
  }
  const allowed = next === "cancelled" ? CANCELLABLE.includes(current.status) : NEXT_STATUS[current.status] === next;
  if (!allowed) {
    res.status(400).json({ error: `Cannot change order status from ${current.status} to ${next}` });
    return;
  }
  const order = await db.transaction(async (tx) => {
    const [updated] = await tx.update(ordersTable).set({
      status: next,
      ...(isStaff && parsed.data.eta ? { eta: parsed.data.eta } : {}),
    }).where(and(eq(ordersTable.id, current.id), eq(ordersTable.status, current.status))).returning();
    // Cancelling puts the items back in stock, atomically with the status change (H12).
    if (updated && next === "cancelled") {
      const items = await tx.select({ productId: orderItemsTable.productId, quantity: orderItemsTable.quantity })
        .from(orderItemsTable).where(eq(orderItemsTable.orderId, updated.id));
      for (const item of items) {
        await tx.update(productsTable).set({ stock: sql`${productsTable.stock} + ${item.quantity}` })
          .where(eq(productsTable.id, item.productId));
      }
    }
    return updated;
  });
  if (!order) {
    res.status(409).json({ error: "Order status changed concurrently, please retry" });
    return;
  }
  res.json(await enrichOrder(order));
});

export default router;