import bcrypt from "bcryptjs";
import { and, eq, getTableColumns, inArray, notInArray, sql, type SQL, type Table } from "drizzle-orm";
import {
  db, pool, usersTable, sellersTable, categoriesTable, productsTable,
  orderItemsTable, cartItemsTable, reviewsTable, wishlistsTable,
} from "@workspace/db";
import { categories, catalog, categoryImage, productImage, type SellerKey } from "./catalog";

// Idempotent demo seed. Upserts by user email, seller userId, category slug
// and product slug. Re-running resets demo passwords and catalog fields
// (price, stock, ...) but leaves rating/reviewCount/orderCount.
//
// Profiles (SEED_PROFILE, see docs/DEPLOYMENT.md):
// - development (default): admin password "admin123"; never deletes rows.
// - production: the admin password comes from SEED_ADMIN_PASSWORD (never
//   committed); buyer/seller demo passwords stay as documented. It also
//   removes products visitors added under the 3 demo sellers (slug not in the
//   catalog): deleted only when nothing references them, otherwise hidden
//   with stock 0, so other users' orders, carts, reviews and wishlists are
//   never deleted or broken. It never creates test accounts.

type Profile = "development" | "production";
const DEMO_PASSWORDS = ["admin123", "seller123", "buyer123"];

const users = [
  { name: "Admin User", email: "admin@instaveg.com", password: "admin123", role: "admin", phone: "+91 9876543210" },
  { name: "Ramesh Kumar", email: "ramesh@instaveg.com", password: "seller123", role: "seller", phone: "+91 9001234567" },
  { name: "Priya Nair", email: "priya@instaveg.com", password: "seller123", role: "seller", phone: "+91 9009876543" },
  { name: "Arjun Singh", email: "arjun@instaveg.com", password: "seller123", role: "seller", phone: "+91 9887766554" },
  { name: "Demo Buyer", email: "buyer@instaveg.com", password: "buyer123", role: "buyer", phone: "+91 9988776655" },
];

const sellers: Record<SellerKey, { email: string; storeName: string; description: string; city: string; address: string; phone: string }> = {
  ramesh: { email: "ramesh@instaveg.com", storeName: "Ramesh Fresh Farm", description: "Daily fresh vegetables from our 20-acre farm in Pune. Harvested every morning.", city: "Pune", address: "Village Road, Hadapsar, Pune", phone: "+91 9001234567" },
  priya: { email: "priya@instaveg.com", storeName: "Priya Organic Greens", description: "Organically grown vegetables and herbs from our family farm in Kothrud.", city: "Pune", address: "Organic Farm Lane, Kothrud, Pune", phone: "+91 9009876543" },
  arjun: { email: "arjun@instaveg.com", storeName: "Arjun Exotic Harvest", description: "Specialising in exotic vegetables, tropical fruits, and rare herbs sourced from across India.", city: "Pune", address: "Market Yard, Gultekdi, Pune", phone: "+91 9887766554" },
};


function validateCatalog(): void {
  const slugs = new Set<string>();
  for (const item of catalog) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.slug)) throw new Error(`Bad slug: ${item.slug}`);
    if (slugs.has(item.slug)) throw new Error(`Duplicate slug: ${item.slug}`);
    slugs.add(item.slug);
    if (!(item.price > 0) || item.mrp < item.price) throw new Error(`Bad price/mrp: ${item.slug}`);
    if (!Number.isInteger(item.stock) || item.stock < 20 || item.stock > 200) throw new Error(`Bad stock: ${item.slug}`);
  }
}

// Builds `col = excluded.col` assignments for an upsert.
function excluded<T extends Table>(table: T, keys: (keyof T["_"]["columns"] & string)[]): Record<string, SQL> {
  const columns = getTableColumns(table);
  return Object.fromEntries(keys.map((key) => [key, sql.raw(`excluded."${columns[key].name}"`)]));
}

function resolveProfile(): Profile {
  const arg = process.argv.find((a) => a.startsWith("--profile="))?.slice("--profile=".length);
  const profile = arg ?? process.env.SEED_PROFILE ?? "development";
  if (profile !== "development" && profile !== "production") {
    throw new Error(`Unknown seed profile "${profile}" (use development or production)`);
  }
  return profile;
}

// Production: the admin password must come from the environment, be long and
// not be one of the publicly documented demo passwords.
function adminPassword(profile: Profile): string {
  if (profile === "development") return "admin123";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (password.length < 16) throw new Error("SEED_ADMIN_PASSWORD must be set and at least 16 characters for the production profile");
  if (DEMO_PASSWORDS.includes(password)) throw new Error("SEED_ADMIN_PASSWORD must not be a documented demo password");
  return password;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Visitor-added products under the demo sellers: delete only unreferenced
// ones. reviews and wishlists cascade on delete and order_items/cart_items
// have no foreign key, so any reference means "hide with stock 0" instead.
async function cleanDemoSellerProducts(tx: Tx, demoSellerIds: number[]) {
  const extras = await tx.select({ id: productsTable.id, slug: productsTable.slug }).from(productsTable)
    .where(and(inArray(productsTable.sellerId, demoSellerIds), notInArray(productsTable.slug, catalog.map((c) => c.slug))));
  const deleted: string[] = [];
  const hidden: string[] = [];
  for (const product of extras) {
    const [refs] = await tx.select({
      orders: sql<number>`(select count(*)::int from ${orderItemsTable} where ${orderItemsTable.productId} = ${product.id})`,
      carts: sql<number>`(select count(*)::int from ${cartItemsTable} where ${cartItemsTable.productId} = ${product.id})`,
      reviews: sql<number>`(select count(*)::int from ${reviewsTable} where ${reviewsTable.productId} = ${product.id})`,
      wishlists: sql<number>`(select count(*)::int from ${wishlistsTable} where ${wishlistsTable.productId} = ${product.id})`,
    }).from(sql`(select 1) as one`);
    if (refs.orders + refs.carts + refs.reviews + refs.wishlists === 0) {
      await tx.delete(productsTable).where(eq(productsTable.id, product.id));
      deleted.push(product.slug);
    } else {
      await tx.update(productsTable).set({ stock: 0, updatedAt: sql`now()` }).where(eq(productsTable.id, product.id));
      hidden.push(`${product.slug} (orders ${refs.orders}, carts ${refs.carts}, reviews ${refs.reviews}, wishlists ${refs.wishlists})`);
    }
  }
  return { deleted, hidden };
}

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed with NODE_ENV=production");
  }
  const profile = resolveProfile();
  const admin = adminPassword(profile);
  validateCatalog();
  console.log(`Seeding database (profile: ${profile})...`);

  const withAdmin = users.map((user) => (user.role === "admin" ? { ...user, password: admin } : user));
  const hashed = await Promise.all(withAdmin.map(async (user) => ({ ...user, password: await bcrypt.hash(user.password, 10), isActive: true })));
  let cleanup: { deleted: string[]; hidden: string[] } | null = null;

  await db.transaction(async (tx) => {
    const userRows = await tx.insert(usersTable).values(hashed)
      .onConflictDoUpdate({ target: usersTable.email, set: excluded(usersTable, ["name", "password", "role", "phone", "isActive"]) })
      .returning({ id: usersTable.id, email: usersTable.email });
    const userIdByEmail = new Map(userRows.map((row) => [row.email, row.id]));

    const sellerValues = (Object.keys(sellers) as SellerKey[]).map((key) => {
      const { email, ...seller } = sellers[key];
      return { ...seller, userId: userIdByEmail.get(email)!, status: "approved", isVerified: true, rating: 0 };
    });
    const sellerRows = await tx.insert(sellersTable).values(sellerValues)
      .onConflictDoUpdate({
        target: sellersTable.userId,
        set: excluded(sellersTable, ["storeName", "description", "city", "address", "phone", "status", "isVerified", "rating"]),
      })
      .returning({ id: sellersTable.id, userId: sellersTable.userId });
    const sellerIdByUserId = new Map(sellerRows.map((row) => [row.userId, row.id]));
    const sellerId = (key: SellerKey) => sellerIdByUserId.get(userIdByEmail.get(sellers[key].email)!)!;

    const categoryRows = await tx.insert(categoriesTable).values(categories.map((c) => ({ ...c, image: categoryImage(c.slug) })))
      .onConflictDoUpdate({ target: categoriesTable.slug, set: excluded(categoriesTable, ["name", "description", "image"]) })
      .returning({ id: categoriesTable.id, slug: categoriesTable.slug });
    const categoryIdBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]));

    const productValues = catalog.map((item) => ({
      slug: item.slug,
      name: item.name,
      description: item.description,
      price: item.price,
      mrp: item.mrp,
      unit: item.unit,
      images: [productImage(item.slug)],
      stock: item.stock,
      sellerId: sellerId(item.seller),
      categoryId: categoryIdBySlug.get(item.category)!,
      isFresh: true,
      isOrganic: item.seller === "priya",
      nutritionInfo: item.nutritionInfo,
      tags: item.tags ?? [],
    }));
    await tx.insert(productsTable).values(productValues)
      .onConflictDoUpdate({
        target: productsTable.slug,
        set: {
          ...excluded(productsTable, [
            "name", "description", "price", "mrp", "unit", "images", "stock",
            "sellerId", "categoryId", "isFresh", "isOrganic", "nutritionInfo", "tags",
          ]),
          updatedAt: sql`now()`,
        },
      });

    if (profile === "production") {
      cleanup = await cleanDemoSellerProducts(tx, (Object.keys(sellers) as SellerKey[]).map(sellerId));
    }
  });

  const count = async (table: typeof usersTable | typeof sellersTable | typeof categoriesTable | typeof productsTable) =>
    (await db.select({ n: sql<number>`count(*)::int` }).from(table))[0].n;
  console.log("Seed complete. Row counts:");
  console.log(`  users:      ${await count(usersTable)}`);
  console.log(`  sellers:    ${await count(sellersTable)}`);
  console.log(`  categories: ${await count(categoriesTable)}`);
  console.log(`  products:   ${await count(productsTable)}`);
  if (cleanup) {
    const { deleted, hidden } = cleanup as { deleted: string[]; hidden: string[] };
    console.log(`Demo seller products not in the catalog: ${deleted.length} deleted, ${hidden.length} hidden (stock 0)`);
    for (const slug of deleted) console.log(`  deleted: ${slug}`);
    for (const line of hidden) console.log(`  hidden:  ${line}`);
  }
}

seed()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await pool.end();
    process.exit(1);
  });
