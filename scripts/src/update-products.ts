import { db, productsTable, sellersTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Better, more accurate image URLs for each vegetable
const IMAGE_UPDATES: Record<string, string> = {
  "Fresh Spinach": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600",
  "Baby Kale": "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=600",
  "Methi Leaves": "https://images.unsplash.com/photo-1607305387299-a3d9611cd469?w=600",
  "Fresh Coriander": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600",
  "Organic Carrots": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600",
  "Baby Potatoes": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600",
  "Beetroot": "https://images.unsplash.com/photo-1613743983303-b3e89f8a2b80?w=600",
  "Broccoli": "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600",
  "Cherry Tomatoes": "https://images.unsplash.com/photo-1558818498-28c1e002b655?w=600",
  "Capsicum Mix": "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600",
  "Bottle Gourd (Lauki)": "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600",
  "Bitter Gourd (Karela)": "https://images.unsplash.com/photo-1630343710506-89f8b9f21d31?w=600",
  "Fresh Mint (Pudina)": "https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?w=600",
  "Raw Mango": "https://images.unsplash.com/photo-1553279768-865429fa0078?w=600",
  "Sweet Corn": "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600",
};

async function updateImages() {
  console.log("Updating product images...");
  for (const [name, image] of Object.entries(IMAGE_UPDATES)) {
    const result = await db
      .update(productsTable)
      .set({ images: [image] })
      .where(eq(productsTable.name, name))
      .returning({ id: productsTable.id });
    if (result.length > 0) console.log(`  Updated: ${name} (id: ${result[0].id})`);
    else console.log(`  Not found: ${name}`);
  }
}

async function addMoreProducts() {
  // Get sellers and categories
  const sellers = await db.select().from(sellersTable);
  const categories = await db.select().from(categoriesTable);

  const s1 = sellers.find(s => s.storeName?.includes("Ramesh"))!;
  const s2 = sellers.find(s => s.storeName?.includes("Priya"))!;

  const catMap: Record<string, number> = {};
  for (const c of categories) catMap[c.slug!] = c.id;

  const newProducts = [
    // Leafy
    { name: "Palak Saag", desc: "Mixed green saag — spinach, bathua and mustard leaves, perfect for North Indian cooking.", price: 35, mrp: 45, unit: "bunch", stock: 120, sellerId: s1.id, catSlug: "leafy-vegetables", isOrganic: false, nutrition: "High in Iron, Vitamin A, C", tags: ["saag", "north-indian"], image: "https://images.unsplash.com/photo-1574484284002-952d92456975?w=600", orders: 80 },
    { name: "Amaranth Leaves (Lal Saag)", desc: "Vibrant red amaranth leaves, rich in iron. Great for stir-fries and sabzis.", price: 25, mrp: 35, unit: "bunch", stock: 100, sellerId: s2.id, catSlug: "leafy-vegetables", isOrganic: false, nutrition: "High in Iron, Calcium, Vitamin K", tags: ["red", "iron-rich"], image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600", orders: 60 },
    // Root
    { name: "Sweet Potato", desc: "Naturally sweet orange-fleshed sweet potatoes. Great for curries and chaat.", price: 55, mrp: 70, unit: "kg", stock: 80, sellerId: s1.id, catSlug: "root-vegetables", isOrganic: false, nutrition: "High in Beta-Carotene, Fiber, Potassium", tags: ["sweet", "nutritious"], image: "https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?w=600", orders: 70 },
    { name: "Radish (Mooli)", desc: "Fresh white radishes with tops. Crispy and peppery, great for parathas and salads.", price: 30, mrp: 40, unit: "bunch", stock: 150, sellerId: s2.id, catSlug: "root-vegetables", isOrganic: false, nutrition: "Rich in Vitamin C, Folate, Fiber", tags: ["crispy", "parathas"], image: "https://images.unsplash.com/photo-1582515073490-39981397c445?w=600", orders: 88 },
    { name: "Turnip (Shalgam)", desc: "Tender turnips with earthy flavour. Perfect for slow-cooked winter curries.", price: 35, mrp: 45, unit: "kg", stock: 90, sellerId: s1.id, catSlug: "root-vegetables", isOrganic: false, nutrition: "High in Vitamin C, Fiber, Glucosinolates", tags: ["winter", "slow-cook"], image: "https://images.unsplash.com/photo-1590868309235-ea34bed7bd7f?w=600", orders: 45 },
    // Gourds
    { name: "Ridge Gourd (Turai)", desc: "Tender ridge gourd, light and easy to digest. Ideal for everyday sabzi.", price: 28, mrp: 38, unit: "kg", stock: 120, sellerId: s2.id, catSlug: "gourds", isOrganic: false, nutrition: "Low calorie, Vitamin B6, Magnesium", tags: ["light", "everyday"], image: "https://images.unsplash.com/photo-1606483956061-46a898dce538?w=600", orders: 68 },
    { name: "Ash Gourd (Petha)", desc: "Large ash gourd, great for petha candy and ayurvedic cooking.", price: 22, mrp: 30, unit: "kg", stock: 80, sellerId: s1.id, catSlug: "gourds", isOrganic: false, nutrition: "High Water Content, Vitamin B1", tags: ["ayurvedic", "cooling"], image: "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600", orders: 38 },
    // Seasonal
    { name: "Green Peas (Matar)", desc: "Fresh shelled green peas, sweet and tender. Straight from the farm.", price: 70, mrp: 90, unit: "250g", stock: 100, sellerId: s2.id, catSlug: "seasonal", isOrganic: false, nutrition: "Rich in Protein, Fiber, Vitamin K", tags: ["sweet", "protein-rich"], image: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600", orders: 115 },
    { name: "Cauliflower (Phool Gobhi)", desc: "Fresh white cauliflower florets. Great for aloo gobhi and manchurian.", price: 50, mrp: 65, unit: "piece", stock: 90, sellerId: s1.id, catSlug: "seasonal", isOrganic: true, nutrition: "High in Vitamin C, K, Choline", tags: ["organic", "versatile"], image: "https://images.unsplash.com/photo-1568584711271-6bf7f3f2b1bd?w=600", orders: 105 },
    { name: "Drumstick (Moringa)", desc: "Fresh drumstick pods packed with nutrients. Essential for sambar and curries.", price: 40, mrp: 55, unit: "bunch", stock: 70, sellerId: s2.id, catSlug: "seasonal", isOrganic: false, nutrition: "Extremely high in Iron, Calcium, Vitamins", tags: ["superfood", "sambar"], image: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=600", orders: 78 },
    // Herbs
    { name: "Curry Leaves", desc: "Fresh aromatic curry leaves. Straight from the plant, no pre-packaging.", price: 15, mrp: 20, unit: "bunch", stock: 250, sellerId: s1.id, catSlug: "herbs", isOrganic: false, nutrition: "Rich in Antioxidants, Calcium, Iron", tags: ["aromatic", "south-indian"], image: "https://images.unsplash.com/photo-1526329718700-63a7d30a6c2a?w=600", orders: 190 },
    { name: "Green Garlic (Hara Lehsun)", desc: "Fresh young garlic shoots with mild flavour. Seasonal winter delight.", price: 25, mrp: 35, unit: "bunch", stock: 80, sellerId: s2.id, catSlug: "herbs", isOrganic: false, nutrition: "Rich in Allicin, Vitamin C, Selenium", tags: ["seasonal", "winter"], image: "https://images.unsplash.com/photo-1509987984766-4ce810ea8cca?w=600", orders: 55 },
    // Fruits
    { name: "Banana (Kela)", desc: "Farm-ripe yellow bananas, sweet and energy-packed. Great for breakfast.", price: 40, mrp: 55, unit: "dozen", stock: 150, sellerId: s1.id, catSlug: "fruits", isOrganic: false, nutrition: "Rich in Potassium, Vitamin B6, Fiber", tags: ["energy", "breakfast"], image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600", orders: 145 },
    { name: "Papaya (Papita)", desc: "Ripe and tender papaya with sweet orange flesh. Great for digestion.", price: 60, mrp: 80, unit: "piece", stock: 60, sellerId: s2.id, catSlug: "fruits", isOrganic: false, nutrition: "Rich in Papain, Vitamin C, A, Folate", tags: ["digestion", "tropical"], image: "https://images.unsplash.com/photo-1601236312754-6ab3cc19abef?w=600", orders: 70 },
    { name: "Guava (Amrood)", desc: "Fresh pink-fleshed guavas with sweet fragrance. High in Vitamin C.", price: 45, mrp: 60, unit: "kg", stock: 90, sellerId: s1.id, catSlug: "fruits", isOrganic: false, nutrition: "Extremely high in Vitamin C, Lycopene", tags: ["vitamin-c", "local"], image: "https://images.unsplash.com/photo-1536511132770-e5058c7e8c46?w=600", orders: 88 },
  ];

  let added = 0;
  for (const p of newProducts) {
    const existing = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.name, p.name));
    if (existing.length > 0) { console.log(`  Skipping (exists): ${p.name}`); continue; }

    await db.insert(productsTable).values({
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
      images: [p.image],
      orderCount: p.orders,
      rating: 4.0 + Math.random() * 0.8,
      reviewCount: Math.floor(p.orders * 0.3),
    });
    added++;
    console.log(`  Added: ${p.name}`);
  }
  console.log(`\nDone! Added ${added} new products.`);
}

async function run() {
  await updateImages();
  await addMoreProducts();
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
