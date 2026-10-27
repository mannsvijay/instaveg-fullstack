// Verifies the self-hosted product and category images (H3).
// Fails (exit 1) if any seeded product/category has no image file, an image
// path doesn't match its slug, two files are identical (sha256), a file is not
// an 800x800 WebP or exceeds 150 KB, an image file isn't used by the catalog,
// or a file isn't listed in public/images/CREDITS.md.
//
// Run: pnpm --filter @workspace/scripts run verify-images

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { catalog, categories, categoryImage, productImage } from "./catalog";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = path.resolve(here, "../../artifacts/instaveg/public");
const MAX_BYTES = 150 * 1024;

async function main(): Promise<void> {
  const errors: string[] = [];
  const credits = fs.readFileSync(path.join(PUBLIC_DIR, "images/CREDITS.md"), "utf8");

  const expected = [
    ...catalog.map((p) => ({ label: `product ${p.slug}`, url: productImage(p.slug) })),
    ...categories.map((c) => ({ label: `category ${c.slug}`, url: categoryImage(c.slug) })),
  ];
  const expectedUrls = new Set(expected.map((e) => e.url));

  const hashes = new Map<string, string>();
  for (const { label, url } of expected) {
    const file = path.join(PUBLIC_DIR, url);
    if (!fs.existsSync(file)) {
      errors.push(`${label}: missing image file ${url}`);
      continue;
    }
    const buf = fs.readFileSync(file);
    const sha = createHash("sha256").update(buf).digest("hex");
    if (hashes.has(sha)) errors.push(`${label}: ${url} is identical to ${hashes.get(sha)}`);
    hashes.set(sha, url);
    if (buf.length > MAX_BYTES) errors.push(`${label}: ${url} is ${(buf.length / 1024).toFixed(1)} KB (max 150 KB)`);
    const meta = await sharp(buf).metadata();
    if (meta.format !== "webp" || meta.width !== 800 || meta.height !== 800) {
      errors.push(`${label}: ${url} is ${meta.format} ${meta.width}x${meta.height}, expected webp 800x800`);
    }
    if (!credits.includes(`\`${url}\``)) errors.push(`${label}: ${url} is not listed in CREDITS.md`);
  }

  // Every image file on disk must belong to a seeded product or category.
  for (const folder of ["products", "categories"]) {
    const dir = path.join(PUBLIC_DIR, "images", folder);
    for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      const url = `/images/${folder}/${name}`;
      if (!expectedUrls.has(url)) errors.push(`unexpected file ${url} (not used by any seeded ${folder.slice(0, -1)})`);
    }
  }

  const checked = expected.length;
  if (errors.length) {
    console.error(`verify-images: ${errors.length} problem(s) in ${checked} images`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`verify-images: OK - ${catalog.length} products + ${categories.length} categories, ${hashes.size} unique 800x800 WebP files, all <= 150 KB, all credited`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
