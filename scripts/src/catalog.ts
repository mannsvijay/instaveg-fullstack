// Catalog data shared by the seed and the image verifier.
// The slug is each item's stable identity; images are self-hosted and derived
// from the slug (single source of truth, H3).

export type SellerKey = "ramesh" | "priya" | "arjun";
export type CategorySlug =
  | "leafy-vegetables" | "root-vegetables" | "fruits" | "exotic-vegetables"
  | "herbs" | "gourds" | "organic-produce" | "seasonal";

export const productImage = (slug: string) => `/images/products/${slug}.webp`;
export const categoryImage = (slug: string) => `/images/categories/${slug}.webp`;

export const categories: { name: string; slug: CategorySlug; description: string }[] = [
  { name: "Leafy Vegetables", slug: "leafy-vegetables", description: "Spinach, cabbage, methi and more" },
  { name: "Root Vegetables", slug: "root-vegetables", description: "Carrots, potatoes, beets and more" },
  { name: "Fruits", slug: "fruits", description: "Fresh seasonal fruits" },
  { name: "Exotic Vegetables", slug: "exotic-vegetables", description: "Broccoli, avocado, zucchini and more" },
  { name: "Herbs & Spices", slug: "herbs", description: "Fresh culinary herbs and aromatics" },
  { name: "Gourds", slug: "gourds", description: "Bottle gourd, bitter gourd and more" },
  { name: "Organic Produce", slug: "organic-produce", description: "Organically grown fruits and vegetables" },
  { name: "Seasonal Specials", slug: "seasonal", description: "Best of the current season" },
];

export type CatalogItem = {
  slug: string;
  name: string;
  category: CategorySlug;
  seller: SellerKey;
  price: number;
  mrp: number;
  unit: "kg" | "500g" | "250g" | "bunch" | "piece" | "dozen";
  stock: number;
  description: string;
  nutritionInfo: string;
  tags?: string[];
};

export const catalog: CatalogItem[] = [
  // Leafy Vegetables
  { slug: "spinach", name: "Spinach (Palak)", category: "leafy-vegetables", seller: "ramesh", price: 30, mrp: 35, unit: "bunch", stock: 80, description: "Fresh, tender spinach leaves for palak paneer, dal and stir-fries.", nutritionInfo: "Per 100 g (approx.): 23 kcal. Rich in vitamin K, vitamin A, folate and iron." },
  { slug: "cabbage", name: "Cabbage (Patta Gobhi)", category: "leafy-vegetables", seller: "ramesh", price: 35, mrp: 40, unit: "piece", stock: 60, description: "Firm green cabbage head, about 700 g to 1 kg. Good for sabzi, salads and stir-fries.", nutritionInfo: "Per 100 g (approx.): 25 kcal. Source of vitamin C, vitamin K and fibre." },
  { slug: "fenugreek-leaves", name: "Fenugreek Leaves (Methi)", category: "leafy-vegetables", seller: "priya", price: 25, mrp: 30, unit: "bunch", stock: 60, description: "Organically grown methi with a pleasantly bitter flavour. For methi thepla, aloo methi and parathas.", nutritionInfo: "Per 100 g (approx.): 49 kcal. Source of iron, vitamin K and fibre.", tags: ["organic"] },

  // Root Vegetables
  { slug: "potato", name: "Potato (Aloo)", category: "root-vegetables", seller: "ramesh", price: 35, mrp: 40, unit: "kg", stock: 200, description: "All-purpose potatoes for curries, fries and parathas.", nutritionInfo: "Per 100 g (approx.): 77 kcal. Mostly carbohydrate; source of potassium and vitamin C." },
  { slug: "onion", name: "Onion (Pyaz)", category: "root-vegetables", seller: "ramesh", price: 45, mrp: 50, unit: "kg", stock: 200, description: "Red onions, the base of most Indian cooking.", nutritionInfo: "Per 100 g (approx.): 40 kcal. Source of vitamin C and vitamin B6." },
  { slug: "carrot", name: "Carrot (Gajar)", category: "root-vegetables", seller: "ramesh", price: 30, mrp: 35, unit: "500g", stock: 120, description: "Crunchy carrots for salads, sabzi and gajar halwa.", nutritionInfo: "Per 100 g (approx.): 41 kcal. Rich in beta-carotene (vitamin A) and fibre." },
  { slug: "beetroot", name: "Beetroot (Chukandar)", category: "root-vegetables", seller: "ramesh", price: 30, mrp: 35, unit: "500g", stock: 70, description: "Deep red beetroot for salads, juices and poriyal.", nutritionInfo: "Per 100 g (approx.): 43 kcal. Source of folate, manganese and fibre." },
  { slug: "radish", name: "Radish (Mooli)", category: "root-vegetables", seller: "ramesh", price: 20, mrp: 25, unit: "500g", stock: 60, description: "White radish with a mild peppery bite. For mooli paratha and salads.", nutritionInfo: "Per 100 g (approx.): 16 kcal. Source of vitamin C." },

  // Fruits
  { slug: "banana", name: "Banana (Kela)", category: "fruits", seller: "arjun", price: 60, mrp: 70, unit: "dozen", stock: 100, description: "Ripe yellow bananas, sold by the dozen.", nutritionInfo: "Per 100 g (approx.): 89 kcal. Source of potassium and vitamin B6." },
  { slug: "apple", name: "Apple (Seb)", category: "fruits", seller: "arjun", price: 180, mrp: 220, unit: "kg", stock: 80, description: "Crisp red apples from Himachal Pradesh.", nutritionInfo: "Per 100 g (approx.): 52 kcal. Source of fibre and vitamin C." },
  { slug: "pomegranate", name: "Pomegranate (Anaar)", category: "fruits", seller: "arjun", price: 180, mrp: 220, unit: "kg", stock: 60, description: "Bhagwa pomegranates with juicy red arils.", nutritionInfo: "Per 100 g (approx.): 83 kcal. Source of fibre, vitamin C and vitamin K." },
  { slug: "papaya", name: "Papaya (Papita)", category: "fruits", seller: "arjun", price: 50, mrp: 60, unit: "piece", stock: 40, description: "Ripe papaya, about 1 kg each, with sweet orange flesh.", nutritionInfo: "Per 100 g (approx.): 43 kcal. Rich in vitamin C and vitamin A." },
  { slug: "guava", name: "Guava (Amrood)", category: "fruits", seller: "arjun", price: 80, mrp: 100, unit: "kg", stock: 50, description: "Firm green guavas, good eaten fresh with a pinch of salt and chilli.", nutritionInfo: "Per 100 g (approx.): 68 kcal. Very high in vitamin C; source of fibre." },

  // Exotic Vegetables
  { slug: "broccoli", name: "Broccoli", category: "exotic-vegetables", seller: "arjun", price: 70, mrp: 90, unit: "piece", stock: 40, description: "Fresh green broccoli head, about 300 g. For stir-fries, soups and salads.", nutritionInfo: "Per 100 g (approx.): 34 kcal. Rich in vitamin C and vitamin K; source of fibre.", tags: ["exotic"] },
  { slug: "zucchini", name: "Zucchini", category: "exotic-vegetables", seller: "arjun", price: 60, mrp: 80, unit: "500g", stock: 30, description: "Green zucchini for grilling, pasta and sautés.", nutritionInfo: "Per 100 g (approx.): 17 kcal. Source of vitamin C and potassium.", tags: ["exotic"] },
  { slug: "avocado", name: "Avocado", category: "exotic-vegetables", seller: "arjun", price: 120, mrp: 150, unit: "piece", stock: 25, description: "Creamy avocado, ripens at room temperature in 2 to 4 days.", nutritionInfo: "Per 100 g (approx.): 160 kcal. Mostly monounsaturated fat; source of fibre and potassium.", tags: ["exotic"] },
  { slug: "button-mushroom", name: "Button Mushroom", category: "exotic-vegetables", seller: "arjun", price: 60, mrp: 70, unit: "250g", stock: 40, description: "White button mushrooms for curries, pizzas and stir-fries. Keep refrigerated.", nutritionInfo: "Per 100 g (approx.): 22 kcal. Source of B vitamins (riboflavin, niacin) and selenium.", tags: ["exotic"] },

  // Herbs & Spices
  { slug: "green-chilli", name: "Green Chilli (Hari Mirch)", category: "herbs", seller: "ramesh", price: 20, mrp: 25, unit: "250g", stock: 90, description: "Spicy green chillies for tadka, chutneys and pickles.", nutritionInfo: "Per 100 g (approx.): 40 kcal. Source of vitamin C." },
  { slug: "coriander", name: "Coriander (Dhania)", category: "herbs", seller: "priya", price: 20, mrp: 25, unit: "bunch", stock: 100, description: "Organically grown coriander for garnishing and green chutney.", nutritionInfo: "Per 100 g (approx.): 23 kcal. Source of vitamin K, vitamin A and vitamin C.", tags: ["organic"] },
  { slug: "ginger", name: "Ginger (Adrak)", category: "herbs", seller: "priya", price: 40, mrp: 50, unit: "250g", stock: 80, description: "Organically grown ginger root for chai, curries and pastes.", nutritionInfo: "Per 100 g (approx.): 80 kcal. Contains gingerol, the compound behind its pungency.", tags: ["organic"] },
  { slug: "garlic", name: "Garlic (Lehsun)", category: "herbs", seller: "priya", price: 60, mrp: 70, unit: "250g", stock: 80, description: "Organically grown garlic bulbs for tadka, pickles and chutneys.", nutritionInfo: "Per 100 g (approx.): 149 kcal. Source of manganese and vitamin B6; contains sulphur compounds.", tags: ["organic"] },

  // Gourds
  { slug: "bottle-gourd", name: "Bottle Gourd (Lauki)", category: "gourds", seller: "ramesh", price: 35, mrp: 40, unit: "piece", stock: 50, description: "Tender light-green lauki, about 700 g to 1 kg each. For lauki chana dal and kofta.", nutritionInfo: "Per 100 g (approx.): 14 kcal. Around 96% water." },
  { slug: "bitter-gourd", name: "Bitter Gourd (Karela)", category: "gourds", seller: "ramesh", price: 35, mrp: 40, unit: "500g", stock: 60, description: "Fresh karela for stuffed karela and crisp fries.", nutritionInfo: "Per 100 g (approx.): 17 kcal. Source of vitamin C and folate." },
  { slug: "ridge-gourd", name: "Ridge Gourd (Turai)", category: "gourds", seller: "priya", price: 35, mrp: 45, unit: "500g", stock: 50, description: "Organically grown ridge gourd with tender flesh. For turai sabzi and chutney.", nutritionInfo: "Per 100 g (approx.): 20 kcal. High water content; source of fibre.", tags: ["organic"] },
  { slug: "pumpkin", name: "Pumpkin (Kaddu)", category: "gourds", seller: "ramesh", price: 40, mrp: 45, unit: "kg", stock: 40, description: "Sweet orange pumpkin, cut to order. For kaddu sabzi and soups.", nutritionInfo: "Per 100 g (approx.): 26 kcal. Rich in beta-carotene; source of potassium." },

  // Organic Produce
  { slug: "tomato", name: "Tomato (Tamatar)", category: "organic-produce", seller: "priya", price: 50, mrp: 60, unit: "kg", stock: 150, description: "Organically grown ripe red tomatoes for curries and salads.", nutritionInfo: "Per 100 g (approx.): 18 kcal. Source of vitamin C, potassium and lycopene.", tags: ["organic"] },
  { slug: "cauliflower", name: "Cauliflower (Phool Gobhi)", category: "organic-produce", seller: "priya", price: 45, mrp: 55, unit: "piece", stock: 60, description: "Organically grown white cauliflower, about 600 to 800 g. For aloo gobhi and gobhi paratha.", nutritionInfo: "Per 100 g (approx.): 25 kcal. Source of vitamin C, vitamin K and fibre.", tags: ["organic"] },
  { slug: "okra", name: "Okra (Bhindi)", category: "organic-produce", seller: "priya", price: 40, mrp: 50, unit: "500g", stock: 80, description: "Organically grown tender bhindi for bhindi masala and fries.", nutritionInfo: "Per 100 g (approx.): 33 kcal. Source of fibre, vitamin K and folate.", tags: ["organic"] },
  { slug: "brinjal", name: "Brinjal (Baingan)", category: "organic-produce", seller: "priya", price: 35, mrp: 40, unit: "500g", stock: 70, description: "Organically grown purple brinjal for baingan bharta and bharli vangi.", nutritionInfo: "Per 100 g (approx.): 25 kcal. Low in fat; source of fibre.", tags: ["organic"] },

  // Seasonal Specials
  { slug: "green-peas", name: "Green Peas (Matar)", category: "seasonal", seller: "ramesh", price: 60, mrp: 70, unit: "500g", stock: 100, description: "Fresh peas in the pod, sweet and in season. For matar paneer and pulao.", nutritionInfo: "Per 100 g shelled (approx.): 81 kcal. Source of plant protein, fibre and vitamin C.", tags: ["seasonal"] },
  { slug: "custard-apple", name: "Custard Apple (Sitaphal)", category: "seasonal", seller: "arjun", price: 120, mrp: 150, unit: "kg", stock: 40, description: "Sweet, creamy sitaphal, in season in autumn. Eat ripe and soft.", nutritionInfo: "Per 100 g (approx.): 94 kcal. Source of vitamin C, vitamin B6 and fibre.", tags: ["seasonal"] },
  { slug: "sweet-corn", name: "Sweet Corn (Bhutta)", category: "seasonal", seller: "ramesh", price: 25, mrp: 30, unit: "piece", stock: 80, description: "Fresh sweet corn cob for roasting, boiling or corn chaat.", nutritionInfo: "Per 100 g (approx.): 86 kcal. Source of carbohydrate, fibre and B vitamins.", tags: ["seasonal"] },
];
