import { pgTable, text, serial, timestamp, boolean, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sellersTable } from "./sellers";
import { categoriesTable } from "./categories";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: doublePrecision("price").notNull(),
  mrp: doublePrecision("mrp"),
  unit: text("unit").notNull().default("kg"), // kg | g | piece | bunch | litre
  images: text("images").array().notNull().default([]),
  stock: integer("stock").notNull().default(0),
  sellerId: integer("seller_id").notNull().references(() => sellersTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  rating: doublePrecision("rating").default(0),
  reviewCount: integer("review_count").notNull().default(0),
  isFresh: boolean("is_fresh").notNull().default(true),
  isOrganic: boolean("is_organic").notNull().default(false),
  nutritionInfo: text("nutrition_info"),
  tags: text("tags").array().notNull().default([]),
  orderCount: integer("order_count").notNull().default(0), // for trending
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
