import { connectDB, User, Seller, Category, Product } from "@workspace/db";
import bcrypt from "bcryptjs";

async function seed() {
  await connectDB();
  console.log("🌱 Seeding database...\n");

  const [adminPw, s1Pw, s2Pw, s3Pw, buyerPw] = await Promise.all([
    bcrypt.hash("admin123", 10),
    bcrypt.hash("seller123", 10),
    bcrypt.hash("seller123", 10),
    bcrypt.hash("seller123", 10),
    bcrypt.hash("buyer123", 10),
  ]);

  const admin = await User.findOneAndUpdate(
    { email: "admin@instaveg.com" },
    { name: "Admin User", email: "admin@instaveg.com", password: adminPw, role: "admin", phone: "+91 9876543210" },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  console.log("Admin:", admin._id);

  const s1User = await User.findOneAndUpdate(
    { email: "ramesh@instaveg.com" },
    { name: "Ramesh Kumar", email: "ramesh@instaveg.com", password: s1Pw, role: "seller", phone: "+91 9001234567" },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const s2User = await User.findOneAndUpdate(
    { email: "priya@instaveg.com" },
    { name: "Priya Nair", email: "priya@instaveg.com", password: s2Pw, role: "seller", phone: "+91 9009876543" },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const s3User = await User.findOneAndUpdate(
    { email: "arjun@instaveg.com" },
    { name: "Arjun Singh", email: "arjun@instaveg.com", password: s3Pw, role: "seller", phone: "+91 9887766554" },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await User.findOneAndUpdate(
    { email: "buyer@instaveg.com" },
    { name: "Demo Buyer", email: "buyer@instaveg.com", password: buyerPw, role: "buyer", phone: "+91 9988776655" },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const s1 = await Seller.findOneAndUpdate(
    { userId: s1User._id },
    { userId: s1User._id, storeName: "Ramesh Fresh Farm", description: "Daily fresh vegetables from our 20-acre farm in Pune.", city: "Pune", address: "Village Road, Hadapsar, Pune", status: "approved", isVerified: true, rating: 4.8, phone: "+91 9001234567" },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const s2 = await Seller.findOneAndUpdate(
    { userId: s2User._id },
    { userId: s2User._id, storeName: "Priya Organic Greens", description: "Certified organic produce. NPOP certified farm in Kothrud.", city: "Pune", address: "Organic Farm Lane, Kothrud, Pune", status: "approved", isVerified: true, rating: 4.7, phone: "+91 9009876543" },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const s3 = await Seller.findOneAndUpdate(
    { userId: s3User._id },
    { userId: s3User._id, storeName: "Arjun Exotic Harvest", description: "Exotic vegetables, tropical fruits, and rare herbs from across India.", city: "Pune", address: "Market Yard, Gultekdi, Pune", status: "approved", isVerified: true, rating: 4.5, phone: "+91 9887766554" },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log("Sellers:", s1!._id, s2!._id, s3!._id);

  const catDefs = [
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
  for (const cat of catDefs) {
    const c = await Category.findOneAndUpdate(
      { slug: cat.slug },
      cat,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    catMap[cat.slug] = c!._id;
  }
  console.log("Categories seeded:", Object.keys(catMap).length);

  console.log("\n✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
