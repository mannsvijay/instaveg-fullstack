import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Carefully chosen Unsplash photos for each vegetable
const FIXES: Record<string, string[]> = {
  "Papaya (Papita)": [
    "https://images.unsplash.com/photo-1526318472351-c75fcf070305?w=600",
  ],
  "Green Garlic (Hara Lehsun)": [
    "https://images.unsplash.com/photo-1501430654243-c934cec2e1c0?w=600",
  ],
  "Curry Leaves": [
    "https://images.unsplash.com/photo-1596543695270-c3a7f2c4f84d?w=600",
  ],
  "Drumstick (Moringa)": [
    "https://images.unsplash.com/photo-1560472355-536de3962603?w=600",
  ],
  "Cauliflower (Phool Gobhi)": [
    "https://images.unsplash.com/photo-1568584711271-6bf7f3f2b1bd?w=600",
  ],
  "Green Peas (Matar)": [
    "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600",
  ],
  "Ash Gourd (Petha)": [
    "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600",
  ],
  "Ridge Gourd (Turai)": [
    "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=600",
  ],
  "Radish (Mooli)": [
    "https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=600",
  ],
  "Sweet Potato": [
    "https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?w=600",
  ],
  "Palak Saag": [
    "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600",
  ],
  "Bitter Gourd (Karela)": [
    "https://images.unsplash.com/photo-1605786189594-4d0e3b35a1e6?w=600",
  ],
  // Also fix a few more while we're at it
  "Methi Leaves": [
    "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600",
  ],
  "Baby Kale": [
    "https://images.unsplash.com/photo-1522184216316-3c25379f5760?w=600",
  ],
  "Broccoli": [
    "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600",
  ],
  "Beetroot": [
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600",
  ],
  "Organic Carrots": [
    "https://images.unsplash.com/photo-1445282768818-728615cc910a?w=600",
  ],
  "Cherry Tomatoes": [
    "https://images.unsplash.com/photo-1524593166156-312f362cada0?w=600",
  ],
  "Fresh Mint (Pudina)": [
    "https://images.unsplash.com/photo-1604909052743-94e838986d24?w=600",
  ],
  "Bottle Gourd (Lauki)": [
    "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600",
  ],
  "Turnip (Shalgam)": [
    "https://images.unsplash.com/photo-1568584711271-6bf7f3f2b1bd?w=600",
  ],
  "Amaranth Leaves (Lal Saag)": [
    "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=600",
  ],
  "Drumstick (Moringa)": [
    "https://images.unsplash.com/photo-1557844352-761f2565b576?w=600",
  ],
};

// More reliable: use specific Unsplash photo IDs that are verified veggie photos
const VERIFIED_FIXES: Record<string, string> = {
  "Papaya (Papita)":               "https://images.unsplash.com/photo-1526318472351-c75fcf070305?w=600&fit=crop",
  "Green Garlic (Hara Lehsun)":    "https://images.unsplash.com/photo-1615485925600-97237c4fc1ec?w=600&fit=crop",
  "Curry Leaves":                  "https://images.unsplash.com/photo-1596543695270-c3a7f2c4f84d?w=600&fit=crop",
  "Drumstick (Moringa)":           "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&fit=crop",
  "Cauliflower (Phool Gobhi)":     "https://images.unsplash.com/photo-1568584711271-6bf7f3f2b1bd?w=600&fit=crop",
  "Green Peas (Matar)":            "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&fit=crop",
  "Ash Gourd (Petha)":             "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&fit=crop",
  "Ridge Gourd (Turai)":           "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&fit=crop",
  "Radish (Mooli)":                "https://images.unsplash.com/photo-1582515073490-39981397c445?w=600&fit=crop",
  "Sweet Potato":                  "https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?w=600&fit=crop",
  "Palak Saag":                    "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&fit=crop",
  "Bitter Gourd (Karela)":         "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=600&fit=crop",
  // Other improvements
  "Methi Leaves":                  "https://images.unsplash.com/photo-1607305387299-a3d9611cd469?w=600&fit=crop",
  "Baby Kale":                     "https://images.unsplash.com/photo-1522184216316-3c25379f5760?w=600&fit=crop",
  "Broccoli":                      "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600&fit=crop",
  "Beetroot":                      "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&fit=crop",
  "Organic Carrots":               "https://images.unsplash.com/photo-1445282768818-728615cc910a?w=600&fit=crop",
  "Cherry Tomatoes":               "https://images.unsplash.com/photo-1524593166156-312f362cada0?w=600&fit=crop",
  "Fresh Mint (Pudina)":           "https://images.unsplash.com/photo-1604909052743-94e838986d24?w=600&fit=crop",
  "Amaranth Leaves (Lal Saag)":    "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=600&fit=crop",
  "Cauliflower (Phool Gobhi)":     "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600&fit=crop",
};

async function run() {
  console.log("Fixing product images...\n");
  for (const [name, image] of Object.entries(VERIFIED_FIXES)) {
    const rows = await db
      .update(productsTable)
      .set({ images: [image] })
      .where(eq(productsTable.name, name))
      .returning({ id: productsTable.id, name: productsTable.name });
    if (rows.length > 0) {
      console.log(`✓ ${name}`);
    } else {
      console.log(`✗ Not found: ${name}`);
    }
  }
  console.log("\nDone.");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
