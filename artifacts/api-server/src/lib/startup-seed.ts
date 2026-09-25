import bcrypt from "bcryptjs";
import { User, Seller, Category, Product } from "@workspace/db";
import { logger } from "./logger";

export async function seedIfEmpty(): Promise<void> {
  try {
    const count = await User.countDocuments();
    if (count > 0) {
      logger.info({ userCount: count }, "Database already has data — skipping startup seed");
      return;
    }
  } catch {
    logger.warn("Could not check user count — skipping startup seed");
    return;
  }

  logger.info("Database is empty — running startup seed");

  const [adminPw, s1Pw, s2Pw, s3Pw, buyerPw] = await Promise.all([
    bcrypt.hash("admin123", 10),
    bcrypt.hash("seller123", 10),
    bcrypt.hash("seller123", 10),
    bcrypt.hash("seller123", 10),
    bcrypt.hash("buyer123", 10),
  ]);

  const admin = new User({ name: "Admin User", email: "admin@instaveg.com", password: adminPw, role: "admin", phone: "+91 9876543210" });
  await admin.save();

  const s1User = new User({ name: "Ramesh Kumar", email: "ramesh@instaveg.com", password: s1Pw, role: "seller", phone: "+91 9001234567" });
  await s1User.save();
  const s2User = new User({ name: "Priya Nair", email: "priya@instaveg.com", password: s2Pw, role: "seller", phone: "+91 9009876543" });
  await s2User.save();
  const s3User = new User({ name: "Arjun Singh", email: "arjun@instaveg.com", password: s3Pw, role: "seller", phone: "+91 9887766554" });
  await s3User.save();
  const buyer = new User({ name: "Demo Buyer", email: "buyer@instaveg.com", password: buyerPw, role: "buyer", phone: "+91 9988776655" });
  await buyer.save();

  const s1 = new Seller({ userId: s1User._id, storeName: "Ramesh Fresh Farm", description: "Daily fresh vegetables from our 20-acre farm in Pune. Harvested every morning.", city: "Pune", address: "Village Road, Hadapsar, Pune", status: "approved", isVerified: true, rating: 4.8, phone: "+91 9001234567" });
  await s1.save();
  const s2 = new Seller({ userId: s2User._id, storeName: "Priya Organic Greens", description: "Certified organic produce grown without chemicals. NPOP certified farm in Kothrud.", city: "Pune", address: "Organic Farm Lane, Kothrud, Pune", status: "approved", isVerified: true, rating: 4.7, phone: "+91 9009876543" });
  await s2.save();
  const s3 = new Seller({ userId: s3User._id, storeName: "Arjun Exotic Harvest", description: "Specialising in exotic vegetables, tropical fruits, and rare herbs sourced from across India.", city: "Pune", address: "Market Yard, Gultekdi, Pune", status: "approved", isVerified: true, rating: 4.5, phone: "+91 9887766554" });
  await s3.save();

  const cats = [
    { name: "Leafy Vegetables", slug: "leafy-vegetables", description: "Spinach, kale, lettuce and more", image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400" },
    { name: "Root Vegetables", slug: "root-vegetables", description: "Carrots, potatoes, beets and more", image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400" },
    { name: "Fruits", slug: "fruits", description: "Fresh seasonal fruits", image: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400" },
    { name: "Exotic Vegetables", slug: "exotic-vegetables", description: "Broccoli, avocado, zucchini and more", image: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400" },
    { name: "Herbs & Spices", slug: "herbs", description: "Fresh culinary herbs and aromatics", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400" },
    { name: "Gourds", slug: "gourds", description: "Bottle gourd, bitter gourd and more", image: "https://images.unsplash.com/photo-1606483956061-46a898dce538?w=400" },
    { name: "Organic Produce", slug: "organic-produce", description: "Certified organic fruits and vegetables", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400" },
    { name: "Seasonal Specials", slug: "seasonal", description: "Best of the current season", image: "https://images.unsplash.com/photo-1467453678174-768ec283a940?w=400" },
  ];

  const catMap: Record<string, number> = {};
  for (const cat of cats) {
    const c = new Category(cat);
    await c.save();
    catMap[cat.slug] = c._id;
  }

  logger.info("Startup seed complete — 5 users, 3 sellers, 8 categories, 0 products");
}
