import bcrypt from "bcryptjs";
import { db, usersTable, sellersTable, categoriesTable, productsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export async function seedIfEmpty(): Promise<void> {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable);
    if (count > 0) {
      logger.info({ userCount: count }, "Database already has data — skipping startup seed");
      return;
    }
  } catch {
    logger.warn("Could not check user count — skipping startup seed (tables may not exist yet)");
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

  const [admin] = await db.insert(usersTable)
    .values({ name: "Admin User", email: "admin@instaveg.com", password: adminPw, role: "admin", phone: "+91 9876543210" })
    .onConflictDoUpdate({ target: usersTable.email, set: { role: "admin" } })
    .returning();

  const [s1User] = await db.insert(usersTable)
    .values({ name: "Ramesh Kumar", email: "ramesh@instaveg.com", password: s1Pw, role: "seller", phone: "+91 9001234567" })
    .onConflictDoUpdate({ target: usersTable.email, set: { role: "seller" } })
    .returning();

  const [s2User] = await db.insert(usersTable)
    .values({ name: "Priya Nair", email: "priya@instaveg.com", password: s2Pw, role: "seller", phone: "+91 9009876543" })
    .onConflictDoUpdate({ target: usersTable.email, set: { role: "seller" } })
    .returning();

  const [s3User] = await db.insert(usersTable)
    .values({ name: "Arjun Singh", email: "arjun@instaveg.com", password: s3Pw, role: "seller", phone: "+91 9887766554" })
    .onConflictDoUpdate({ target: usersTable.email, set: { role: "seller" } })
    .returning();

  await db.insert(usersTable)
    .values({ name: "Demo Buyer", email: "buyer@instaveg.com", password: buyerPw, role: "buyer", phone: "+91 9988776655" })
    .onConflictDoUpdate({ target: usersTable.email, set: { role: "buyer" } });

  const [s1] = await db.insert(sellersTable)
    .values({ userId: s1User.id, storeName: "Ramesh Fresh Farm", description: "Daily fresh vegetables from our 20-acre farm in Pune. Harvested every morning and delivered by 8 AM.", city: "Pune", address: "Village Road, Hadapsar, Pune", status: "approved", isVerified: true, rating: 4.8, phone: "+91 9001234567" })
    .onConflictDoUpdate({ target: sellersTable.userId, set: { status: "approved", isVerified: true } })
    .returning();

  const [s2] = await db.insert(sellersTable)
    .values({ userId: s2User.id, storeName: "Priya Organic Greens", description: "Certified organic produce grown without chemicals. NPOP certified farm in Kothrud.", city: "Pune", address: "Organic Farm Lane, Kothrud, Pune", status: "approved", isVerified: true, rating: 4.7, phone: "+91 9009876543" })
    .onConflictDoUpdate({ target: sellersTable.userId, set: { status: "approved", isVerified: true } })
    .returning();

  const [s3] = await db.insert(sellersTable)
    .values({ userId: s3User.id, storeName: "Arjun Exotic Harvest", description: "Specialising in exotic vegetables, tropical fruits, and rare herbs sourced from across India.", city: "Pune", address: "Market Yard, Gultekdi, Pune", status: "approved", isVerified: true, rating: 4.5, phone: "+91 9887766554" })
    .onConflictDoUpdate({ target: sellersTable.userId, set: { status: "approved", isVerified: true } })
    .returning();

  const cats = [
    { name: "Leafy Vegetables", slug: "leafy-vegetables",   description: "Spinach, kale, lettuce and more",           image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400" },
    { name: "Root Vegetables",  slug: "root-vegetables",    description: "Carrots, potatoes, beets and more",          image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400" },
    { name: "Fruits",           slug: "fruits",             description: "Fresh seasonal fruits",                      image: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400" },
    { name: "Exotic Vegetables", slug: "exotic-vegetables", description: "Broccoli, avocado, zucchini and more",       image: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400" },
    { name: "Herbs & Spices",   slug: "herbs",              description: "Fresh culinary herbs and aromatics",         image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400" },
    { name: "Gourds",           slug: "gourds",             description: "Bottle gourd, bitter gourd and more",        image: "https://images.unsplash.com/photo-1606483956061-46a898dce538?w=400" },
    { name: "Organic Produce",  slug: "organic-produce",    description: "Certified organic fruits and vegetables",    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400" },
    { name: "Seasonal Specials", slug: "seasonal",          description: "Best of the current season",                 image: "https://images.unsplash.com/photo-1467453678174-768ec283a940?w=400" },
  ];

  const catMap: Record<string, number> = {};
  for (const cat of cats) {
    const [c] = await db.insert(categoriesTable)
      .values(cat)
      .onConflictDoUpdate({ target: categoriesTable.slug, set: { name: cat.name, image: cat.image, description: cat.description } })
      .returning();
    catMap[cat.slug] = c.id;
  }

  const R = s1.id, G = s2.id, A = s3.id;

  type P = { name: string; desc: string; price: number; mrp: number; unit: string; stock: number; sid: number; cat: string; organic: boolean; fresh: boolean; nutrition: string; tags: string[]; img: string; orders: number; rating: number; reviews: number };

  const products: P[] = [
    { name: "Fresh Spinach (Palak)", desc: "Farm-fresh spinach harvested this morning. Tender leaves rich in iron and folate.", price: 28, mrp: 40, unit: "bunch", stock: 200, sid: R, cat: "leafy-vegetables", organic: true, fresh: true, nutrition: "Calories 23kcal | Iron 2.7mg | Vitamin K 483μg", tags: ["organic","iron-rich","local","bestseller"], img: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&fit=crop", orders: 340, rating: 4.8, reviews: 102 },
    { name: "Baby Kale", desc: "Tender young kale leaves — the superfood powerhouse. Great for salads and smoothies.", price: 55, mrp: 70, unit: "bunch", stock: 90, sid: G, cat: "leafy-vegetables", organic: true, fresh: true, nutrition: "Calories 49kcal | Calcium 150mg | Vitamin C 120mg", tags: ["superfood","organic","calcium-rich"], img: "https://images.unsplash.com/photo-1516594634946-2a0d21ae4f22?w=600&fit=crop", orders: 180, rating: 4.7, reviews: 54 },
    { name: "Iceberg Lettuce", desc: "Crisp and refreshing iceberg lettuce. Perfect for sandwiches, wraps and salads.", price: 45, mrp: 60, unit: "piece", stock: 80, sid: A, cat: "leafy-vegetables", organic: false, fresh: true, nutrition: "Calories 14kcal | Water 96% | Folate 29μg", tags: ["crisp","salad","sandwich"], img: "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600&fit=crop", orders: 130, rating: 4.5, reviews: 39 },
    { name: "Methi Leaves (Fenugreek)", desc: "Fresh and aromatic fenugreek leaves — a kitchen staple. Great for parathas and curries.", price: 18, mrp: 25, unit: "bunch", stock: 250, sid: R, cat: "leafy-vegetables", organic: false, fresh: true, nutrition: "Calories 49kcal | Protein 3.2g | Iron 6.5mg", tags: ["aromatic","everyday","iron-rich"], img: "https://images.unsplash.com/photo-1631452180539-96aca7d48617?w=600&fit=crop", orders: 280, rating: 4.6, reviews: 84 },
    { name: "Cabbage (Patta Gobhi)", desc: "Large, firm and fresh green cabbage. Versatile — stir-fries, sabzi or raw salads.", price: 30, mrp: 40, unit: "piece", stock: 150, sid: G, cat: "leafy-vegetables", organic: false, fresh: true, nutrition: "Calories 25kcal | Vitamin C 36mg | Fiber 2.5g", tags: ["everyday","versatile","crispy"], img: "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=600&fit=crop", orders: 210, rating: 4.4, reviews: 63 },
    { name: "Amaranth Leaves (Chaulai)", desc: "Vibrant red-green amaranth leaves. Packed with antioxidants and iron.", price: 25, mrp: 35, unit: "bunch", stock: 100, sid: R, cat: "leafy-vegetables", organic: true, fresh: true, nutrition: "Calories 23kcal | Iron 2.3mg | Calcium 215mg", tags: ["antioxidant","organic","iron-rich"], img: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=600&fit=crop", orders: 90, rating: 4.5, reviews: 27 },
    { name: "Mustard Greens (Sarson)", desc: "Peppery sarson leaves — the soul of a classic sarson ka saag. Seasonal and fragrant.", price: 22, mrp: 30, unit: "bunch", stock: 120, sid: G, cat: "leafy-vegetables", organic: false, fresh: true, nutrition: "Calories 27kcal | Vitamin K 257μg | Vitamin C 70mg", tags: ["seasonal","winter","saag"], img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&fit=crop", orders: 155, rating: 4.6, reviews: 46 },
    { name: "Organic Carrots", desc: "Sweet, crunchy organic carrots from Nashik farms. Excellent raw, juiced or cooked.", price: 55, mrp: 75, unit: "kg", stock: 120, sid: G, cat: "root-vegetables", organic: true, fresh: true, nutrition: "Calories 41kcal | Beta-Carotene 8285μg | Vitamin A 835μg", tags: ["organic","sweet","juicing","bestseller"], img: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&fit=crop", orders: 310, rating: 4.9, reviews: 93 },
    { name: "Baby Potatoes", desc: "Tender small potatoes — perfect for roasting, dum aloo or spicy curries.", price: 40, mrp: 55, unit: "kg", stock: 180, sid: R, cat: "root-vegetables", organic: false, fresh: true, nutrition: "Calories 77kcal | Potassium 421mg | Vitamin C 20mg", tags: ["versatile","roasting","everyday"], img: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&fit=crop", orders: 265, rating: 4.7, reviews: 79 },
    { name: "Beetroot", desc: "Deep earthy beetroots bursting with natural sweetness. Great for juicing and salads.", price: 38, mrp: 50, unit: "kg", stock: 90, sid: R, cat: "root-vegetables", organic: false, fresh: true, nutrition: "Calories 43kcal | Folate 109μg | Manganese 0.3mg", tags: ["juicing","salad","antioxidant"], img: "https://images.unsplash.com/photo-1590868309235-ea34bed7bd7f?w=600&fit=crop", orders: 185, rating: 4.6, reviews: 55 },
    { name: "Radish (Mooli)", desc: "Fresh white radishes with bright green tops. Peppery and crunchy — perfect for parathas.", price: 25, mrp: 35, unit: "kg", stock: 140, sid: G, cat: "root-vegetables", organic: false, fresh: true, nutrition: "Calories 16kcal | Vitamin C 15mg | Folate 25μg", tags: ["crunchy","winter","paratha"], img: "https://images.unsplash.com/photo-1582515073490-39981397c445?w=600&fit=crop", orders: 170, rating: 4.4, reviews: 51 },
    { name: "Sweet Potato", desc: "Naturally sweet and nutritious sweet potatoes. Roast, bake or make chaat.", price: 48, mrp: 65, unit: "kg", stock: 100, sid: A, cat: "root-vegetables", organic: false, fresh: true, nutrition: "Calories 86kcal | Vitamin A 961μg | Potassium 337mg", tags: ["sweet","roasting","healthy"], img: "https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?w=600&fit=crop", orders: 145, rating: 4.6, reviews: 43 },
    { name: "Onion (Pyaaz)", desc: "Fresh red onions with tight skin and pungent aroma. The foundation of every Indian dish.", price: 35, mrp: 45, unit: "kg", stock: 300, sid: R, cat: "root-vegetables", organic: false, fresh: true, nutrition: "Calories 40kcal | Vitamin C 7.4mg | Quercetin 13mg", tags: ["everyday","essential","cooking-base"], img: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&fit=crop", orders: 450, rating: 4.8, reviews: 135 },
    { name: "Potato (Aloo)", desc: "Firm white potatoes freshly harvested. From dum aloo to fries — the king of vegetables.", price: 30, mrp: 40, unit: "kg", stock: 350, sid: R, cat: "root-vegetables", organic: false, fresh: true, nutrition: "Calories 77kcal | Potassium 421mg | Vitamin C 20mg", tags: ["everyday","essential","versatile"], img: "https://images.unsplash.com/photo-1508313880080-c4bef0730395?w=600&fit=crop", orders: 520, rating: 4.7, reviews: 156 },
    { name: "Turnip (Shalgam)", desc: "Crisp white turnips with a mild peppery flavour. Great in curries, soups and pickles.", price: 28, mrp: 38, unit: "kg", stock: 80, sid: G, cat: "root-vegetables", organic: false, fresh: true, nutrition: "Calories 28kcal | Vitamin C 21mg | Calcium 30mg", tags: ["winter","mild","soup"], img: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&fit=crop", orders: 75, rating: 4.3, reviews: 22 },
    { name: "Alphonso Mango", desc: "The king of mangoes. Premium Devgad Alphonso — fragrant, fibre-free and extraordinarily sweet.", price: 180, mrp: 250, unit: "kg", stock: 60, sid: A, cat: "fruits", organic: false, fresh: true, nutrition: "Calories 60kcal | Vitamin C 36mg | Vitamin A 54μg", tags: ["premium","seasonal","bestseller","summer"], img: "https://images.unsplash.com/photo-1591073113125-e46713c829ed?w=600&fit=crop", orders: 200, rating: 4.9, reviews: 60 },
    { name: "Bananas (Elaichi)", desc: "Small, intensely flavoured Elaichi bananas. Aromatic and sweeter than regular bananas.", price: 50, mrp: 65, unit: "dozen", stock: 150, sid: R, cat: "fruits", organic: false, fresh: true, nutrition: "Calories 89kcal | Potassium 358mg | Vitamin B6 0.4mg", tags: ["everyday","energy","kids-favourite"], img: "https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=600&fit=crop", orders: 290, rating: 4.6, reviews: 87 },
    { name: "Pomegranate (Anar)", desc: "Ruby-red pomegranates bursting with antioxidant-rich arils. From Solapur farms.", price: 120, mrp: 160, unit: "piece", stock: 80, sid: A, cat: "fruits", organic: false, fresh: true, nutrition: "Calories 83kcal | Vitamin C 10mg | Fiber 4g", tags: ["antioxidant","juicing","premium"], img: "https://images.unsplash.com/photo-1541344999736-83eca272f6fc?w=600&fit=crop", orders: 165, rating: 4.8, reviews: 49 },
    { name: "Papaya (Papita)", desc: "Ripe, orange-fleshed papaya loaded with digestive enzymes. Naturally sweet.", price: 45, mrp: 60, unit: "kg", stock: 70, sid: R, cat: "fruits", organic: false, fresh: true, nutrition: "Calories 43kcal | Papain enzyme | Vitamin C 62mg", tags: ["digestive","breakfast","tropical"], img: "https://images.unsplash.com/photo-1526318472351-c75fcf070305?w=600&fit=crop", orders: 140, rating: 4.5, reviews: 42 },
    { name: "Watermelon", desc: "Juicy, seedless watermelon — the ultimate summer refresher. 92% water, naturally sweet.", price: 25, mrp: 35, unit: "kg", stock: 50, sid: A, cat: "fruits", organic: false, fresh: true, nutrition: "Calories 30kcal | Lycopene 4532μg | Water 92%", tags: ["summer","hydrating","seedless"], img: "https://images.unsplash.com/photo-1563114773-84221bd62daa?w=600&fit=crop", orders: 230, rating: 4.7, reviews: 69 },
    { name: "Guava (Amrood)", desc: "Fresh pink-fleshed guavas with a sweet-tart flavour. Exceptionally high in Vitamin C.", price: 45, mrp: 60, unit: "kg", stock: 90, sid: R, cat: "fruits", organic: false, fresh: true, nutrition: "Calories 68kcal | Vitamin C 228mg | Fiber 5.4g", tags: ["vitamin-c","tropical","kids"], img: "https://images.unsplash.com/photo-1536511132770-e5058c7e8c46?w=600&fit=crop", orders: 155, rating: 4.5, reviews: 46 },
    { name: "Black Grapes", desc: "Plump, sweet black grapes freshly arrived from Nashik vineyards. Seedless.", price: 95, mrp: 130, unit: "kg", stock: 70, sid: A, cat: "fruits", organic: false, fresh: true, nutrition: "Calories 69kcal | Resveratrol | Vitamin C 10.8mg", tags: ["seedless","premium","antioxidant"], img: "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=600&fit=crop", orders: 175, rating: 4.8, reviews: 52 },
    { name: "Orange (Nagpur)", desc: "Juicy Nagpur oranges at peak sweetness. Perfect for juicing and eating fresh.", price: 70, mrp: 90, unit: "kg", stock: 100, sid: R, cat: "fruits", organic: false, fresh: true, nutrition: "Calories 47kcal | Vitamin C 53mg | Folate 30μg", tags: ["vitamin-c","juicing","winter"], img: "https://images.unsplash.com/photo-1547514701-42782101795e?w=600&fit=crop", orders: 195, rating: 4.6, reviews: 58 },
    { name: "Apple (Himalayan)", desc: "Crisp, red Himalayan apples from Himachal Pradesh. Rich flavour and satisfying crunch.", price: 160, mrp: 210, unit: "kg", stock: 80, sid: A, cat: "fruits", organic: false, fresh: true, nutrition: "Calories 52kcal | Vitamin C 4.6mg | Fiber 2.4g", tags: ["premium","crispy","himalayan"], img: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600&fit=crop", orders: 185, rating: 4.7, reviews: 55 },
    { name: "Pineapple", desc: "Sweet tropical pineapple with juicy golden flesh. Ready-to-eat ripeness.", price: 65, mrp: 85, unit: "piece", stock: 55, sid: A, cat: "fruits", organic: false, fresh: true, nutrition: "Calories 50kcal | Bromelain enzyme | Vitamin C 47.8mg", tags: ["tropical","digestive","sweet"], img: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&fit=crop", orders: 120, rating: 4.5, reviews: 36 },
    { name: "Broccoli", desc: "Farm-fresh broccoli crowns brimming with nutrients. Blanch, roast or stir-fry.", price: 85, mrp: 110, unit: "piece", stock: 70, sid: G, cat: "exotic-vegetables", organic: true, fresh: true, nutrition: "Calories 34kcal | Vitamin C 89mg | Vitamin K 102μg", tags: ["organic","superfood","vitamin-c"], img: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&fit=crop", orders: 195, rating: 4.8, reviews: 58 },
    { name: "Avocado", desc: "Perfectly ripe Hass avocados with creamy buttery flesh. Great for toast or guacamole.", price: 120, mrp: 160, unit: "piece", stock: 45, sid: A, cat: "exotic-vegetables", organic: false, fresh: true, nutrition: "Calories 160kcal | Healthy fats 15g | Potassium 485mg", tags: ["premium","healthy-fats","keto"], img: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&fit=crop", orders: 140, rating: 4.7, reviews: 42 },
    { name: "Bell Peppers (Mixed)", desc: "Vibrant red, yellow and green bell peppers — colourful, crunchy and sweet.", price: 80, mrp: 100, unit: "250g", stock: 85, sid: A, cat: "exotic-vegetables", organic: false, fresh: true, nutrition: "Calories 31kcal | Vitamin C 127mg | Vitamin A 157μg", tags: ["colorful","vitamin-c","stir-fry"], img: "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&fit=crop", orders: 220, rating: 4.6, reviews: 66 },
    { name: "Zucchini (Courgette)", desc: "Tender green zucchini with mild flavour. Great grilled, sautéed or spiralised.", price: 70, mrp: 90, unit: "kg", stock: 60, sid: A, cat: "exotic-vegetables", organic: false, fresh: true, nutrition: "Calories 17kcal | Vitamin C 18mg | Potassium 261mg", tags: ["low-carb","grilling","keto"], img: "https://images.unsplash.com/photo-1589621316382-008455b857cd?w=600&fit=crop", orders: 105, rating: 4.4, reviews: 31 },
    { name: "Asparagus", desc: "Fresh green asparagus spears — a spring delicacy. Roast with olive oil and garlic.", price: 150, mrp: 200, unit: "250g", stock: 40, sid: A, cat: "exotic-vegetables", organic: false, fresh: true, nutrition: "Calories 20kcal | Folate 52μg | Vitamin K 41.6μg", tags: ["premium","spring","roasting"], img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&fit=crop", orders: 80, rating: 4.6, reviews: 24 },
    { name: "Cherry Tomatoes", desc: "Sweet, bite-sized cherry tomatoes bursting with natural sugars. Brilliant in salads.", price: 90, mrp: 120, unit: "250g", stock: 110, sid: G, cat: "exotic-vegetables", organic: true, fresh: true, nutrition: "Calories 18kcal | Lycopene 2573μg | Vitamin C 14mg", tags: ["organic","sweet","salad","pasta"], img: "https://images.unsplash.com/photo-1524593166156-312f362cada0?w=600&fit=crop", orders: 265, rating: 4.8, reviews: 79 },
    { name: "Cauliflower (Phool Gobhi)", desc: "Snow-white cauliflower with tightly packed florets. From aloo gobhi to cauliflower rice.", price: 45, mrp: 60, unit: "piece", stock: 90, sid: R, cat: "exotic-vegetables", organic: false, fresh: true, nutrition: "Calories 25kcal | Vitamin C 48mg | Choline 45mg", tags: ["versatile","low-carb","everyday"], img: "https://images.unsplash.com/photo-1568584711271-6bf7f3f2b1bd?w=600&fit=crop", orders: 230, rating: 4.5, reviews: 69 },
    { name: "Fresh Coriander (Dhania)", desc: "Fresh, fragrant coriander bunches. Essential for garnishing, chutneys and marinades.", price: 15, mrp: 20, unit: "bunch", stock: 400, sid: R, cat: "herbs", organic: false, fresh: true, nutrition: "Calories 23kcal | Vitamin K 310μg | Vitamin C 27mg", tags: ["everyday","garnishing","essential"], img: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=600&fit=crop", orders: 480, rating: 4.7, reviews: 144 },
    { name: "Fresh Mint (Pudina)", desc: "Cool and refreshing mint leaves. Perfect for chutneys, raita and mojitos.", price: 18, mrp: 25, unit: "bunch", stock: 300, sid: R, cat: "herbs", organic: false, fresh: true, nutrition: "Calories 70kcal | Menthol | Vitamin A 212μg", tags: ["cooling","chutney","digestive"], img: "https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?w=600&fit=crop", orders: 320, rating: 4.8, reviews: 96 },
    { name: "Curry Leaves (Kadi Patta)", desc: "Aromatic fresh curry leaves — the secret base of South Indian cooking.", price: 20, mrp: 30, unit: "bunch", stock: 200, sid: R, cat: "herbs", organic: false, fresh: true, nutrition: "Rich in Iron, Calcium | Antioxidants | Carbazole alkaloids", tags: ["south-indian","aromatic","tempering"], img: "https://images.unsplash.com/photo-1596543695270-c3a7f2c4f84d?w=600&fit=crop", orders: 260, rating: 4.6, reviews: 78 },
    { name: "Fresh Basil", desc: "Sweet Italian basil with fragrant large leaves. Elevate your pizzas, pastas and pesto.", price: 40, mrp: 55, unit: "bunch", stock: 80, sid: A, cat: "herbs", organic: true, fresh: true, nutrition: "Calories 22kcal | Vitamin K 414μg | Eugenol rich", tags: ["italian","pizza","pesto","organic"], img: "https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?w=600&fit=crop", orders: 115, rating: 4.7, reviews: 34 },
    { name: "Ginger (Adrak)", desc: "Fresh, fiery ginger root with intense flavour. Essential for teas, curries and marinades.", price: 60, mrp: 80, unit: "250g", stock: 150, sid: R, cat: "herbs", organic: false, fresh: true, nutrition: "Calories 80kcal | Gingerol | Anti-inflammatory", tags: ["spicy","immunity","digestion","tea"], img: "https://images.unsplash.com/photo-1612170153139-6f881ff067e0?w=600&fit=crop", orders: 285, rating: 4.8, reviews: 85 },
    { name: "Garlic (Lehsun)", desc: "Plump white garlic bulbs with a pungent aroma. The cornerstone of Indian and global cuisines.", price: 50, mrp: 70, unit: "250g", stock: 200, sid: R, cat: "herbs", organic: false, fresh: true, nutrition: "Calories 149kcal | Allicin | Selenium 14μg", tags: ["immunity","antibacterial","cooking-base"], img: "https://images.unsplash.com/photo-1615485925600-97237c4fc1ec?w=600&fit=crop", orders: 340, rating: 4.7, reviews: 102 },
    { name: "Green Chilli (Hari Mirch)", desc: "Fresh, fiery green chillies for that essential kick in every dish. Medium-hot variety.", price: 20, mrp: 30, unit: "100g", stock: 200, sid: R, cat: "herbs", organic: false, fresh: true, nutrition: "Calories 40kcal | Capsaicin | Vitamin C 144mg", tags: ["spicy","everyday","essential"], img: "https://images.unsplash.com/photo-1571680322279-a226e6a4cc2a?w=600&fit=crop", orders: 380, rating: 4.6, reviews: 114 },
    { name: "Bottle Gourd (Lauki)", desc: "Tender, mild bottle gourd. Light on the stomach and perfect for everyday Indian cooking.", price: 22, mrp: 32, unit: "piece", stock: 180, sid: R, cat: "gourds", organic: false, fresh: true, nutrition: "Calories 14kcal | Water 96% | Choline 7mg", tags: ["light","everyday","low-calorie"], img: "https://images.unsplash.com/photo-1606483956061-46a898dce538?w=600&fit=crop", orders: 245, rating: 4.4, reviews: 73 },
    { name: "Bitter Gourd (Karela)", desc: "Fresh bitter gourd. Bitter yet beneficial — excellent for blood sugar management.", price: 32, mrp: 45, unit: "kg", stock: 100, sid: G, cat: "gourds", organic: false, fresh: true, nutrition: "Calories 17kcal | Charantin | Vitamin C 84mg", tags: ["diabetic-friendly","medicinal","bitter"], img: "https://images.unsplash.com/photo-1599493729326-c30e07ef10f8?w=600&fit=crop", orders: 140, rating: 4.3, reviews: 42 },
    { name: "Ridge Gourd (Turai)", desc: "Fresh turai with ridged skin and soft flesh. Absorbs masala beautifully — an everyday sabzi staple.", price: 28, mrp: 38, unit: "kg", stock: 110, sid: R, cat: "gourds", organic: false, fresh: true, nutrition: "Calories 20kcal | Fiber 2.2g | Vitamin C 12mg", tags: ["everyday","mild","light"], img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&fit=crop", orders: 160, rating: 4.3, reviews: 48 },
    { name: "Ash Gourd (Petha)", desc: "Firm white ash gourd — classic for winter melon curry and the famous Agra petha sweet.", price: 25, mrp: 35, unit: "kg", stock: 70, sid: G, cat: "gourds", organic: false, fresh: true, nutrition: "Calories 13kcal | Water 96% | Vitamin C 13mg", tags: ["cooling","ayurvedic","juice"], img: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&fit=crop", orders: 80, rating: 4.2, reviews: 24 },
    { name: "Snake Gourd (Chichinda)", desc: "Long, slender snake gourd with crisp white flesh. A delicate sabzi when cooked with coconut.", price: 30, mrp: 40, unit: "piece", stock: 80, sid: G, cat: "gourds", organic: false, fresh: true, nutrition: "Calories 18kcal | Vitamin C 8mg | Calcium 26mg", tags: ["south-indian","mild","coconut-curry"], img: "https://images.unsplash.com/photo-1606483956061-46a898dce538?w=600&fit=crop", orders: 75, rating: 4.3, reviews: 22 },
    { name: "Organic Tomatoes", desc: "Vine-ripened organic tomatoes with intense flavour. No pesticides, grown with natural compost.", price: 65, mrp: 85, unit: "kg", stock: 120, sid: G, cat: "organic-produce", organic: true, fresh: true, nutrition: "Calories 18kcal | Lycopene 2573μg | Vitamin C 14mg", tags: ["organic","vine-ripened","no-pesticide"], img: "https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?w=600&fit=crop", orders: 285, rating: 4.8, reviews: 85 },
    { name: "Organic Cucumber", desc: "Long green organic cucumbers — crisp, cool and hydrating. NPOP certified, chemical-free.", price: 50, mrp: 65, unit: "kg", stock: 100, sid: G, cat: "organic-produce", organic: true, fresh: true, nutrition: "Calories 16kcal | Water 96% | Vitamin K 16μg", tags: ["organic","hydrating","salad","cool"], img: "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=600&fit=crop", orders: 200, rating: 4.7, reviews: 60 },
    { name: "Organic Spinach", desc: "Certified organic baby spinach leaves. Washed, triple-cleaned and ready to use.", price: 65, mrp: 85, unit: "200g", stock: 80, sid: G, cat: "organic-produce", organic: true, fresh: true, nutrition: "Calories 23kcal | Iron 2.7mg | Vitamin K 483μg", tags: ["organic","ready-to-use","iron-rich","baby"], img: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&fit=crop", orders: 175, rating: 4.9, reviews: 52 },
    { name: "Organic Pumpkin", desc: "Sweet, golden organic pumpkin. Make creamy curries, soups or the classic kaddu ki sabzi.", price: 35, mrp: 50, unit: "kg", stock: 90, sid: G, cat: "organic-produce", organic: true, fresh: true, nutrition: "Calories 26kcal | Beta-Carotene 1599μg | Vitamin A 426μg", tags: ["organic","sweet","beta-carotene"], img: "https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=600&fit=crop", orders: 130, rating: 4.5, reviews: 39 },
    { name: "Organic Lady Finger (Bhindi)", desc: "Tender, young organic okra pods. Perfectly sized for frying, curries and stir-fries.", price: 55, mrp: 70, unit: "500g", stock: 100, sid: G, cat: "organic-produce", organic: true, fresh: true, nutrition: "Calories 33kcal | Vitamin C 23mg | Fiber 3.2g", tags: ["organic","tender","frying"], img: "https://images.unsplash.com/photo-1601648764658-cf37e8c89b70?w=600&fit=crop", orders: 195, rating: 4.6, reviews: 58 },
    { name: "Sweet Corn", desc: "Fresh farm-picked sweet corn cobs at peak sweetness. Grill with butter or make creamy corn curry.", price: 35, mrp: 50, unit: "piece", stock: 150, sid: R, cat: "seasonal", organic: false, fresh: true, nutrition: "Calories 86kcal | Fiber 2.4g | Lutein 644μg", tags: ["summer","grilling","sweet","bbq"], img: "https://images.unsplash.com/photo-1601472544100-0ed6a3e73bed?w=600&fit=crop", orders: 285, rating: 4.7, reviews: 85 },
    { name: "Drumstick (Sahjan)", desc: "Long, tender drumstick pods packed with nutrients. Essential for sambar and Moringa detox.", price: 40, mrp: 55, unit: "bundle", stock: 90, sid: R, cat: "seasonal", organic: false, fresh: true, nutrition: "Calories 37kcal | Vitamin C 141mg | Calcium 185mg", tags: ["sambar","moringa","south-indian"], img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&fit=crop", orders: 170, rating: 4.5, reviews: 51 },
    { name: "Raw Mango (Kachcha Aam)", desc: "Tart and tangy raw green mangoes. Perfect for aam panna, pickles and spicy chutneys.", price: 48, mrp: 65, unit: "kg", stock: 80, sid: A, cat: "seasonal", organic: false, fresh: true, nutrition: "Calories 60kcal | Vitamin C 36mg | Pectin rich", tags: ["tangy","pickle","summer","aam-panna"], img: "https://images.unsplash.com/photo-1591073113125-e46713c829ed?w=600&fit=crop", orders: 195, rating: 4.6, reviews: 58 },
    { name: "Green Peas (Matar)", desc: "Sweet and tender green peas freshly shelled. Elevate every pulao, curry and stuffed paratha.", price: 60, mrp: 80, unit: "500g", stock: 100, sid: R, cat: "seasonal", organic: false, fresh: true, nutrition: "Calories 81kcal | Protein 5.4g | Fiber 5.1g", tags: ["winter","sweet","protein-rich"], img: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&fit=crop", orders: 240, rating: 4.7, reviews: 72 },
    { name: "Lotus Stem (Kamal Kakdi)", desc: "Fresh lotus stem with its signature lacy hollow structure. Crunchy — a true seasonal delicacy.", price: 80, mrp: 110, unit: "250g", stock: 40, sid: A, cat: "seasonal", organic: false, fresh: true, nutrition: "Calories 74kcal | Potassium 556mg | Vitamin C 44mg", tags: ["delicacy","crunchy","gourmet"], img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&fit=crop", orders: 65, rating: 4.4, reviews: 19 },
  ];

  let seeded = 0;
  for (const p of products) {
    const catId = catMap[p.cat];
    if (!catId) continue;
    const result = await db.insert(productsTable).values({
      name: p.name, description: p.desc, price: p.price, mrp: p.mrp, unit: p.unit,
      stock: p.stock, sellerId: p.sid, categoryId: catId, isOrganic: p.organic,
      isFresh: p.fresh, nutritionInfo: p.nutrition, tags: p.tags, images: [p.img],
      orderCount: p.orders, rating: p.rating, reviewCount: p.reviews,
    }).onConflictDoNothing().returning();
    if (result.length > 0) seeded++;
  }

  logger.info({ seeded, adminId: admin.id }, "Startup seed complete");
}
