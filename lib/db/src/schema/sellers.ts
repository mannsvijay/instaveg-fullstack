import { pgTable, text, serial, timestamp, boolean, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const sellersTable = pgTable("sellers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  storeName: text("store_name").notNull(),
  description: text("description"),
  logo: text("logo"),
  address: text("address"),
  city: text("city"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  deliveryRadius: doublePrecision("delivery_radius").default(10),
  rating: doublePrecision("rating").default(0),
  totalOrders: integer("total_orders").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | suspended
  isVerified: boolean("is_verified").notNull().default(false),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSellerSchema = createInsertSchema(sellersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSeller = z.infer<typeof insertSellerSchema>;
export type Seller = typeof sellersTable.$inferSelect;
