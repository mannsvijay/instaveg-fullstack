import bcrypt from "bcryptjs";
import { db, usersTable, sellersTable, categoriesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

const categoryDefinitions = [
  { name: "Leafy Vegetables", slug: "leafy-vegetables", description: "Spinach, kale, lettuce and more", image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400" },
  { name: "Root Vegetables", slug: "root-vegetables", description: "Carrots, potatoes, beets and more", image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400" },
  { name: "Fruits", slug: "fruits", description: "Fresh seasonal fruits", image: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400" },
  { name: "Exotic Vegetables", slug: "exotic-vegetables", description: "Broccoli, avocado, zucchini and more", image: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400" },
  { name: "Herbs & Spices", slug: "herbs", description: "Fresh culinary herbs and aromatics", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400" },
  { name: "Gourds", slug: "gourds", description: "Bottle gourd, bitter gourd and more", image: "https://images.unsplash.com/photo-1606483956061-46a898dce538?w=400" },
  { name: "Organic Produce", slug: "organic-produce", description: "Certified organic fruits and vegetables", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400" },
  { name: "Seasonal Specials", slug: "seasonal", description: "Best of the current season", image: "https://images.unsplash.com/photo-1467453678174-768ec283a940?w=400" },
];

export async function seedIfEmpty(): Promise<void> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  if (Number(count) > 0) {
    logger.info({ userCount: count }, "Database already has data — skipping startup seed");
    return;
  }

  logger.info("Database is empty — running startup seed");
  const [adminPw, sellerPw, buyerPw] = await Promise.all([
    bcrypt.hash("admin123", 10),
    bcrypt.hash("seller123", 10),
    bcrypt.hash("buyer123", 10),
  ]);

  const users = await db.insert(usersTable).values([
    { name: "Admin User", email: "admin@instaveg.com", password: adminPw, role: "admin", phone: "+91 9876543210" },
    { name: "Ramesh Kumar", email: "ramesh@instaveg.com", password: sellerPw, role: "seller", phone: "+91 9001234567" },
    { name: "Priya Nair", email: "priya@instaveg.com", password: sellerPw, role: "seller", phone: "+91 9009876543" },
    { name: "Arjun Singh", email: "arjun@instaveg.com", password: sellerPw, role: "seller", phone: "+91 9887766554" },
    { name: "Demo Buyer", email: "buyer@instaveg.com", password: buyerPw, role: "buyer", phone: "+91 9988776655" },
  ]).returning({ id: usersTable.id, email: usersTable.email });
  const userByEmail = new Map(users.map((user) => [user.email, user.id]));

  await db.insert(sellersTable).values([
    { userId: userByEmail.get("ramesh@instaveg.com")!, storeName: "Ramesh Fresh Farm", description: "Daily fresh vegetables from our 20-acre farm in Pune. Harvested every morning.", city: "Pune", address: "Village Road, Hadapsar, Pune", status: "approved", isVerified: true, rating: 4.8, phone: "+91 9001234567" },
    { userId: userByEmail.get("priya@instaveg.com")!, storeName: "Priya Organic Greens", description: "Certified organic produce grown without chemicals. NPOP certified farm in Kothrud.", city: "Pune", address: "Organic Farm Lane, Kothrud, Pune", status: "approved", isVerified: true, rating: 4.7, phone: "+91 9009876543" },
    { userId: userByEmail.get("arjun@instaveg.com")!, storeName: "Arjun Exotic Harvest", description: "Specialising in exotic vegetables, tropical fruits, and rare herbs sourced from across India.", city: "Pune", address: "Market Yard, Gultekdi, Pune", status: "approved", isVerified: true, rating: 4.5, phone: "+91 9887766554" },
  ]);
  await db.insert(categoriesTable).values(categoryDefinitions).onConflictDoNothing({ target: categoriesTable.slug });
  logger.info("Startup seed complete — 5 users, 3 sellers, 8 categories, 0 products");
}