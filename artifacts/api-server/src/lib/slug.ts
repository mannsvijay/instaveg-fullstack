import { db, productsTable } from "@workspace/db";
import { like } from "drizzle-orm";

export function slugify(input: string): string {
  const slug = input
    .replace(/\(.*?\)/g, " ")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "product";
}

// Unique product slug from the name: "bottle-gourd", then "bottle-gourd-2", ...
// The unique constraint on products.slug still guards against races.
export async function uniqueProductSlug(name: string): Promise<string> {
  const base = slugify(name);
  const rows = await db.select({ slug: productsTable.slug }).from(productsTable)
    .where(like(productsTable.slug, `${base}%`));
  const taken = new Set(rows.map((row) => row.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
