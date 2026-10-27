// Writes tmp/image-review.html (gitignored): every product and category image
// next to its name, file size, source, author and license, for a visual check.
//
// Run: pnpm --filter @workspace/scripts run image-review

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalog, categories, categoryImage, productImage } from "./catalog";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const publicDir = path.join(root, "artifacts/instaveg/public");
const outFile = path.join(root, "tmp/image-review.html");

type Credit = { source: string; author: string; license: string };

// Rows look like: | Item | `/images/...webp` | [title](url) | author | [license](url) |
function readCredits(): Map<string, Credit> {
  const md = fs.readFileSync(path.join(publicDir, "images/CREDITS.md"), "utf8");
  const credits = new Map<string, Credit>();
  for (const line of md.split("\n")) {
    const cells = line.split(" | ").map((c) => c.replace(/^\| ?| ?\|$/g, "").trim());
    const file = cells[1]?.match(/^`(\/images\/.+\.webp)`$/)?.[1];
    if (file) credits.set(file, { source: cells[2], author: cells[3], license: cells[4] });
  }
  return credits;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mdLink = (s = "") => {
  const m = s.match(/^\[(.*)\]\((.*)\)$/);
  return m ? `<a href="${esc(m[2])}" target="_blank" rel="noopener">${esc(m[1])}</a>` : esc(s);
};

const credits = readCredits();
const items = [
  ...catalog.map((p) => ({ kind: "Product", name: p.name, slug: p.slug, url: productImage(p.slug) })),
  ...categories.map((c) => ({ kind: "Category", name: c.name, slug: c.slug, url: categoryImage(c.slug) })),
];

const cards = items.map((it) => {
  const file = path.join(publicDir, it.url);
  const exists = fs.existsSync(file);
  const kb = exists ? (fs.statSync(file).size / 1024).toFixed(1) : "-";
  const c = credits.get(it.url);
  const src = path.relative(path.dirname(outFile), file).split(path.sep).join("/");
  return `<figure>
  ${exists ? `<img src="${esc(src)}" alt="${esc(it.name)}" loading="lazy">` : `<div class="missing">MISSING</div>`}
  <figcaption>
    <strong>${esc(it.name)}</strong> <span class="kind">${it.kind}</span><br>
    <code>${esc(it.url)}</code> &middot; ${kb} KB<br>
    ${c ? `Source: ${mdLink(c.source)}<br>Author: ${esc(c.author)}<br>License: ${mdLink(c.license)}` : `<span class="missing">Not in CREDITS.md</span>`}
  </figcaption>
</figure>`;
});

// Storefront preview: the products as site-style cards (image, name, price).
const storefront = catalog.map((p) => {
  const src = path.relative(path.dirname(outFile), path.join(publicDir, productImage(p.slug))).split(path.sep).join("/");
  const off = p.mrp > p.price
    ? `<s>&#8377;${p.mrp}</s> <span class="off">${Math.round(((p.mrp - p.price) / p.mrp) * 100)}% off</span>`
    : "";
  return `<div class="card">
  <div class="card-img"><img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy"></div>
  <div class="card-body"><div class="name">${esc(p.name)}</div><div class="unit">${esc(p.unit)}</div>
  <div class="price">&#8377;${p.price} ${off}</div></div>
</div>`;
});

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>InstaVEG image review</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 16px; background: #f6fcdf; color: #1d2b12; }
  h1 { font-size: 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
  figure { margin: 0; background: #fff; border: 1px solid #d8e3c0; border-radius: 12px; overflow: hidden; }
  img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; }
  figcaption { padding: 10px; font-size: 12px; word-break: break-word; }
  .kind { color: #859f3d; font-size: 11px; text-transform: uppercase; }
  .missing { color: #b00020; font-weight: 600; padding: 8px; }
  h2 { font-size: 17px; margin-top: 32px; }
  .store { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
  .card { background: #fff; border: 1px solid #e3e8d4; border-radius: 16px; overflow: hidden; }
  .card-img { background: #F6F6F1; }
  .card-body { padding: 10px 12px 12px; }
  .name { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .unit { color: #6b7560; font-size: 11px; margin-top: 2px; }
  .price { font-weight: 700; color: #31511E; margin-top: 6px; }
  .price s { color: #8a9180; font-weight: 400; font-size: 11px; }
  .off { color: #2e7d32; font-size: 11px; font-weight: 600; }
</style></head>
<body>
<h1>InstaVEG image review: ${items.length} items (${catalog.length} products, ${categories.length} categories)</h1>
<div class="grid">
${cards.join("\n")}
</div>
<h2>Storefront preview: ${catalog.length} products as product cards</h2>
<div class="store">
${storefront.join("\n")}
</div>
</body></html>
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
console.log(`image-review: wrote ${path.relative(root, outFile)} with ${items.length} items`);
