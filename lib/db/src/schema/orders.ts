import { pgTable, text, serial, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  sellerId: integer("seller_id"),
  status: text("status").notNull().default("pending"), // pending|confirmed|preparing|dispatched|delivered|cancelled
  paymentStatus: text("payment_status").notNull().default("pending"), // pending|paid|failed|refunded
  paymentMethod: text("payment_method"), // razorpay|cod
  razorpayOrderId: text("razorpay_order_id"),
  addressId: integer("address_id"),
  addressSnapshot: text("address_snapshot"), // JSON string of address at order time
  subtotal: doublePrecision("subtotal").notNull().default(0),
  deliveryFee: doublePrecision("delivery_fee").notNull().default(40),
  platformFee: doublePrecision("platform_fee").notNull().default(5),
  total: doublePrecision("total").notNull().default(0),
  eta: text("eta"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  price: doublePrecision("price").notNull(),
  productName: text("product_name"),
  productImage: text("product_image"),
  productUnit: text("product_unit"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
