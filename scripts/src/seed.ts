import { db, usersTable, sellersTable, categoriesTable, productsTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Admin
  const adminPw = await bcrypt.hash("admin123", 10);
  const [admin] = await db
    .insert(usersTable)
    .values({ name: "Admin User", email: "admin@instaveg.com", password: adminPw, role: "admin", phone: "+91 9876543210" })
    .onConflictDoUpdate({ target: usersTable.email, set: { role: "admin" } })
    .returning();
  console.log("Admin:", admin.id);

  // Sellers
  const seller1Pw = await bcrypt.hash("seller123", 10);
  const [seller1User] = await db
    .insert(usersTable)
    .values({ name: "Ramesh Kumar", email: "ramesh@instaveg.com", password: seller1Pw, role: "seller", phone: "+91 9001234567" })
    .onConflictDoUpdate({ target: usersTable.email, set: { role: "seller" } })
    .returning();

  const seller2Pw = await bcrypt.hash("seller123", 10);
  const [seller2User] = await db
    .insert(usersTable)
    .values({ name: "Priya Nair", email: "priya@instaveg.com", password: seller2Pw, role: "seller", phone: "+91 9009876543" })
    .onConflictDoUpdate({ target: usersTable.email, set: { role: "seller" } })
    .returning();

  // Buyer
  const buyerPw = await bcrypt.hash("buyer123", 10);
  await db
    .insert(usersTable)
    .values({ name: "Demo Buyer", email: "buyer@instaveg.com", password: buyerPw, role: "buyer", phone: "+91 9988776655" })
    .onConflictDoUpdate({ target: usersTable.email, set: { role: "buyer" } });

  // Seller profiles
  const [seller1] = await db
    .insert(sellersTable)
    .values({
      userId: seller1User.id,
      storeName: "Ramesh Fresh Farm",
      description: "Daily fresh vegetables from our farm in Pune. Harvested every morning.",
      city: "Pune",
      address: "Village Road, Hadapsar, Pune",
      status: "approved",
      isVerified: true,
      rating: 4.8,
      phone: "+91 9001234567",
    })
    .onConflictDoUpdate({ target: sellersTable.userId, set: { status: "approved", isVerified: true } })
    .returning();

  const [seller2] = await db
    .insert(sellersTable)
    .values({
      userId: seller2User.id,
      storeName: "Priya Organic Greens",
      description: "Certified organic produce delivered fresh daily. No chemicals, ever.",
      city: "Pune",
      address: "Organic Farm Lane, Kothrud, Pune",
      status: "approved",
      isVerified: true,
      rating: 4.6,
      phone: "+91 9009876543",
    })
    .onConflictDoUpdate({ target: sellersTable.userId, set: { status: "approved", isVerified: true } })
    .returning();

  console.log("Sellers:", seller1.id, seller2.id);

  // Categories
  const catData = [
    { name: "Leafy Vegetables", slug: "leafy-vegetables", description: "Fresh green leafy vegetables", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400" },
    { name: "Root Vegetables", slug: "root-vegetables", description: "Carrots, potatoes, beets and more", image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400" },
    { name: "Seasonal", slug: "seasonal", description: "Best of the season", image: "https://images.unsplash.com/photo-1467453678174-768ec283a940?w=400" },
    { name: "Fruits", slug: "fruits", description: "Fresh seasonal fruits", image: "https://images.unsplash.com/photo-1546548970-71785318a17b?w=400" },
    { name: "Herbs", slug: "herbs", description: "Fresh culinary herbs and microgreens", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400" },
    { name: "Gourds", slug: "gourds", description: "Bottle gourd, bitter gourd and more", image: "https://images.unsplash.com/photo-1606483956061-46a898dce538?w=400" },
  ];

  const catMap: Record<string, number> = {};
  for (const cat of catData) {
    const [c] = await db
      .insert(categoriesTable)
      .values(cat)
      .onConflictDoUpdate({ target: categoriesTable.slug, set: { name: cat.name } })
      .returning();
    catMap[cat.slug] = c.id;
  }
  console.log("Categories:", catMap);

  // Products
  const products = [
    { name: "Fresh Spinach", desc: "Farm-fresh spinach harvested this morning. Rich in iron and vitamins.", price: 30, mrp: 40, unit: "bunch", stock: 150, sellerId: seller1.id, catSlug: "leafy-vegetables", isOrganic: true, nutrition: "Rich in Iron, Vitamin K, Folate", tags: ["organic", "iron-rich", "local"], images: ["https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400"], orders: 95 },
    { name: "Baby Kale", desc: "Tender young kale leaves, perfect for salads and smoothies.", price: 55, mrp: 70, unit: "bunch", stock: 80, sellerId: seller2.id, catSlug: "leafy-vegetables", isOrganic: true, nutrition: "High in Calcium, Vitamin C, K", tags: ["organic", "superfood"], images: ["https://images.unsplash.com/photo-1516594634946-2a0d21ae4f22?w=400"], orders: 70 },
    { name: "Methi Leaves", desc: "Fresh and aromatic fenugreek leaves. A kitchen staple.", price: 20, mrp: 25, unit: "bunch", stock: 200, sellerId: seller1.id, catSlug: "leafy-vegetables", isOrganic: false, nutrition: "Rich in Protein, Fiber, Iron", tags: ["local", "aromatic"], images: ["https://images.unsplash.com/photo-1631452180539-96aca7d48617?w=400"], orders: 140 },
    { name: "Fresh Coriander", desc: "Fresh green coriander, perfect for garnishing and chutney.", price: 15, mrp: 20, unit: "bunch", stock: 300, sellerId: seller2.id, catSlug: "herbs", isOrganic: false, nutrition: "Rich in Vitamin C, Antioxidants", tags: ["everyday", "aromatic"], images: ["https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=400"], orders: 200 },
    { name: "Organic Carrots", desc: "Sweet and crunchy organic carrots from Ooty farms.", price: 60, mrp: 80, unit: "kg", stock: 100, sellerId: seller1.id, catSlug: "root-vegetables", isOrganic: true, nutrition: "Rich in Beta-Carotene, Vitamin A", tags: ["organic", "sweet"], images: ["https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400"], orders: 120 },
    { name: "Baby Potatoes", desc: "Small, tender baby potatoes perfect for roasting.", price: 45, mrp: 60, unit: "kg", stock: 120, sellerId: seller2.id, catSlug: "root-vegetables", isOrganic: false, nutrition: "Rich in Potassium, Vitamin C", tags: ["versatile"], images: ["https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400"], orders: 110 },
    { name: "Beetroot", desc: "Deep red beetroots, great for salads and juicing.", price: 40, mrp: 50, unit: "kg", stock: 80, sellerId: seller1.id, catSlug: "root-vegetables", isOrganic: false, nutrition: "Rich in Folate, Manganese, Iron", tags: ["juicing", "salad"], images: ["https://images.unsplash.com/photo-1590868309235-ea34bed7bd7f?w=400"], orders: 85 },
    { name: "Broccoli", desc: "Farm-fresh broccoli florets, bursting with nutrients.", price: 80, mrp: 100, unit: "piece", stock: 60, sellerId: seller2.id, catSlug: "seasonal", isOrganic: true, nutrition: "High in Fiber, Vitamin C, K", tags: ["organic", "nutrient-dense"], images: ["https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400"], orders: 90 },
    { name: "Cherry Tomatoes", desc: "Sweet cherry tomatoes, perfect for salads and pasta.", price: 90, mrp: 120, unit: "250g", stock: 100, sellerId: seller1.id, catSlug: "seasonal", isOrganic: true, nutrition: "Rich in Lycopene, Vitamin C", tags: ["organic", "sweet", "cherry"], images: ["https://images.unsplash.com/photo-1546548970-71785318a17b?w=400"], orders: 130 },
    { name: "Capsicum Mix", desc: "Colorful bell peppers — red, yellow, and green.", price: 70, mrp: 90, unit: "250g", stock: 75, sellerId: seller2.id, catSlug: "seasonal", isOrganic: false, nutrition: "Rich in Vitamin C, Antioxidants", tags: ["colorful", "versatile"], images: ["https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400"], orders: 88 },
    { name: "Bottle Gourd (Lauki)", desc: "Fresh and tender bottle gourd. Light and healthy.", price: 25, mrp: 35, unit: "piece", stock: 150, sellerId: seller1.id, catSlug: "gourds", isOrganic: false, nutrition: "Low Calorie, High Water Content", tags: ["light", "everyday"], images: ["https://images.unsplash.com/photo-1606483956061-46a898dce538?w=400"], orders: 75 },
    { name: "Bitter Gourd (Karela)", desc: "Fresh bitter gourd. Great for diabetic-friendly cooking.", price: 35, mrp: 45, unit: "kg", stock: 90, sellerId: seller2.id, catSlug: "gourds", isOrganic: false, nutrition: "Diabetic-friendly, Vitamin C, Iron", tags: ["medicinal", "low-gi"], images: ["https://images.unsplash.com/photo-1599493729326-c30e07ef10f8?w=400"], orders: 55 },
    { name: "Fresh Mint (Pudina)", desc: "Fresh cooling mint leaves, great for chutneys and drinks.", price: 20, mrp: 30, unit: "bunch", stock: 200, sellerId: seller1.id, catSlug: "herbs", isOrganic: false, nutrition: "Rich in Menthol, Antioxidants", tags: ["cooling", "aromatic"], images: ["https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?w=400"], orders: 160 },
    { name: "Raw Mango", desc: "Tart and tangy raw mangoes, perfect for pickles and chutneys.", price: 50, mrp: 65, unit: "kg", stock: 80, sellerId: seller2.id, catSlug: "fruits", isOrganic: false, nutrition: "Rich in Vitamin C, Pectin", tags: ["seasonal", "sour"], images: ["https://images.unsplash.com/photo-1591073113125-e46713c829ed?w=400"], orders: 95 },
    { name: "Sweet Corn", desc: "Fresh farm-picked sweet corn. Great for grilling and curries.", price: 35, mrp: 50, unit: "piece", stock: 120, sellerId: seller1.id, catSlug: "seasonal", isOrganic: false, nutrition: "Rich in Fiber, B Vitamins", tags: ["sweet", "grilling"], images: ["https://images.unsplash.com/photo-1601472544100-0ed6a3e73bed?w=400"], orders: 105 },
  ];

  for (const p of products) {
    await db
      .insert(productsTable)
      .values({
        name: p.name,
        description: p.desc,
        price: p.price,
        mrp: p.mrp,
        unit: p.unit,
        stock: p.stock,
        sellerId: p.sellerId,
        categoryId: catMap[p.catSlug],
        isOrganic: p.isOrganic,
        isFresh: true,
        nutritionInfo: p.nutrition,
        tags: p.tags,
        images: p.images,
        orderCount: p.orders,
        rating: 4.2 + Math.random() * 0.7,
        reviewCount: Math.floor(p.orders * 0.3),
      })
      .onConflictDoNothing();
  }

  console.log(`Seeded ${products.length} products`);
  console.log("\n=== DEMO ACCOUNTS ===");
  console.log("Admin:  admin@instaveg.com  / admin123");
  console.log("Seller: ramesh@instaveg.com / seller123");
  console.log("Seller: priya@instaveg.com  / seller123");
  console.log("Buyer:  buyer@instaveg.com  / buyer123");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
