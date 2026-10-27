# InstaVEG — Phase 1 Audit

Audited commit: `83b6aa9` ("refactor: migrate database layer to PostgreSQL and Drizzle").
Method: full source read of every backend route, DB schema, seed scripts, key frontend files; `pnpm install`, `pnpm run typecheck`, and individual builds run on Linux (Node 22, pnpm 10.34). Live demo HTML fetched.

Legend: **Confirmed** = verified by reading code or running a command. **Likely** = strong inference, needs a manual test to prove.

---

## 1. Actual architecture (verified)

| Layer | Technology | Location |
|---|---|---|
| Monorepo | pnpm workspaces, TypeScript 5.9 | root `pnpm-workspace.yaml` |
| Frontend | React 19 + Vite 7, Wouter, Zustand, TanStack Query, Tailwind v4, shadcn/ui | `artifacts/instaveg` |
| Backend | Express 5, Pino, bundled with esbuild to `dist/index.mjs` | `artifacts/api-server` |
| Database | **PostgreSQL + Drizzle ORM** (not MongoDB, see M3) | `lib/db` |
| API contract | OpenAPI 3.1 → Orval → React Query hooks + Zod schemas | `lib/api-spec`, `lib/api-client-react`, `lib/api-zod` |
| Auth | JWT (7-day) in `Authorization: Bearer`, token persisted to localStorage via Zustand `persist` | `api-server/src/lib/auth.ts`, `instaveg/src/store/useAuthStore.ts` |
| Payments | Razorpay checkout.js on frontend; **server side is simulated** (see H4) | `routes/orders.ts`, `pages/Checkout.tsx` |
| Hosting today | Replit: path router sends `/api/*` → Express :8080, `/*` → static Vite build | `.replit`, `*/.replit-artifact/artifact.toml` |

Unused workspace package: `artifacts/mockup-sandbox` (a Replit design-preview sandbox, not part of the app).

## 2. Command results

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` (Linux x64) | ✅ Pass |
| `pnpm run typecheck` | ❌ **Fail**: 12 errors, all in `scripts/` (`seed.ts`, `dedup.ts`, `fix-images.ts`, `update-products.ts`) |
| `pnpm run build` (root) | ❌ **Fails** because it runs `typecheck` first |
| `pnpm --filter @workspace/instaveg run build` | ✅ Pass (warning: single 1.01 MB JS chunk) |
| `pnpm --filter @workspace/api-server run build` | ✅ Pass |
| Automated tests | None exist |
| Lint | Not configured |
| Committed secrets / `.env` | ✅ None found |
| Live demo `/` | ✅ Serves; meta description reads "built on Replit…" |
| Live demo API / product data | ⚠️ Not verified (sandbox network can't reach it; manual step below) |

---

## 3. Findings

### 🔴 CRITICAL — security (all Confirmed by code)

| # | Issue | Evidence | Fix |
|---|---|---|---|
| C1 | **Any logged-in user can read any order** (IDOR), including buyer name and full address snapshot | `routes/orders.ts:112` `GET /orders/:id` has only `requireAuth`, no ownership check | Allow if `order.userId === user.id`, or user is the order's seller, or admin; else 404 |
| C2 | **Any logged-in user (even a buyer) can change any order's status** (mark delivered, cancel others' orders) | `routes/orders.ts:126` `PATCH /orders/:id` has no role or ownership check | Restrict to the order's seller + admin; buyer may only cancel own `pending` order; validate allowed status transitions |
| C3 | **Sellers see every order on the platform** | `routes/orders.ts:31-37` only filters when `role === "buyer"` | Seller → filter by their seller id; admin → all; otherwise own |
| C4 | **Any seller can edit or delete any other seller's products** (IDOR) | `routes/products.ts:106` and `:126` update/delete by id only. Compounded by `pages/seller/Products.tsx:20`: "My Products" lists **all** products with Edit/Delete buttons | Look up caller's seller row; require `product.sellerId === seller.id` unless admin. Frontend: pass own `sellerId` |
| C5 | **Payment can be forged**: no ownership check; signature not tied to stored `razorpayOrderId`; secret falls back to the public string `"demo_secret"` | `routes/orders.ts:148`, `:169`, `:181` | Ownership check; compare against stored `razorpayOrderId`; `crypto.timingSafeEqual`; refuse to run if `RAZORPAY_KEY_SECRET` missing |
| C6 | **JWT secret has a hardcoded fallback**: if `SESSION_SECRET` is unset in production, anyone can forge an admin token | `lib/auth.ts:4` `|| "instaveg-secret-key"` | Throw at startup if missing in production |
| C7 | **Order checkout accepts another user's address id**, copying their address into your order (PII leak) | `routes/orders.ts:74` selects address by id only | Add `eq(addressesTable.userId, user.id)`; 400 if not found |

### 🟠 HIGH

| # | Issue | Evidence | Fix |
|---|---|---|---|
| H1 | **Root build fails** → Vercel build with default command will fail | Typecheck output above. `scripts/src/seed.ts` uses Mongoose-style `User.findOneAndUpdate` models that don't exist in `@workspace/db`; `scripts/package.json` lacks `drizzle-orm` and lists unused `mongoose` | Rewrite seed in Drizzle; fix deps; remove or fix one-off scripts |
| H2 | **Product data is not reproducible from the repo.** A fresh DB = empty store | `lib/startup-seed.ts` logs "0 products"; `seed.ts` is broken and has no products; the 30-product seed is gone from git history; README's `update-products` command isn't in `scripts/package.json` | **First back up live data** (manual step); then build one idempotent seed with all products keyed by a stable `slug` |
| H3 | **Root cause of wrong product images** | Three conflicting name-keyed scripts (`update-products.ts`, `fix-images.ts` `FIXES` *and* `VERIFIED_FIXES`). The same photo is reused for unrelated products: spinach photo `1576045057995` → Ash Gourd, Bottle Gourd, Palak Saag; cauliflower `1568584711271` → Turnip; baby potatoes `1518977676601` → Ash Gourd; salad bowl `1512621776951` → Drumstick; category images reused as products. Final state depends on which script ran last. No `onError` fallback on `<img>` | Single source of truth: `slug → image` map in seed; hosted assets (self-hosted `/images/products/<slug>.webp` preferred); `ProductImage` component with fallback + fixed aspect ratio; verification script that fails on duplicates/404s |
| H4 | **Razorpay isn't actually integrated** | `routes/orders.ts:162` invents `order_<timestamp>_<id>` instead of calling Razorpay's Orders API; `keyId` defaults to `"rzp_test_demo"`. Checkout modal will reject a fabricated order/key (Likely, confirm with test keys) | Use `razorpay` SDK in **test mode** to create real orders; or ship COD-only with Razorpay hidden behind a flag. Your choice (see decisions) |
| H5 | **Seller approval can be bypassed** | `routes/products.ts:76` never checks `seller.status === "approved"`; public listings don't filter by seller status | Enforce on create/update; filter public queries to approved sellers |
| H6 | **Local dev on Windows/macOS is blocked** | `pnpm-workspace.yaml` `overrides` delete native binaries for every platform except linux-x64-gnu (esbuild, rollup, tailwind oxide, lightningcss). Also: no Vite `/api` proxy (Replit did it); API `dev` script uses POSIX `export` (fails in PowerShell); `PORT` required with no default | Remove platform-exclusion overrides (keep the `esbuild` pin and `@esbuild-kit` override); add Vite proxy; use `cross-env` or plain `node` script; default PORT 8080 |
| H7 | **Multi-vendor orders are broken** | `routes/orders.ts:77` assigns the whole order to the first item's seller; other sellers never see their items. `order_items` has no `sellerId` | Split checkout into one order per seller (matches existing schema) |
| H8 | **No quantity/stock/price validation** | Zod bodies have no `min`/`int`. `POST /cart/items` with `quantity: -5` lowers quantity; fractional quantities accepted; stock never checked or decremented; negative `price`/`stock` accepted on products | Add server-side bounds; check stock at add-to-cart and checkout; decrement stock in a transaction |
| H9 | **Seller product editing is not implemented** | `pages/seller/Products.tsx:82` Edit button links to `/seller/products/:id/edit`, but `App.tsx` has no such route and `pages/seller/AddProduct.tsx` has no edit mode | Add the route and an edit mode (load product, PATCH). Fix in Batch 3, after C4 |
| H10 | **Checkout total mismatch: buyer is charged more than displayed** | `routes/cart.ts` `buildCartResponse` returns `total = subtotal + deliveryFee`; `routes/orders.ts` saves `subtotal + DELIVERY_FEE + PLATFORM_FEE` (₹5 more). `Checkout.tsx`/`Cart.tsx` show the cart total and no platform fee line | One source of truth: cart response includes `platformFee` and a total that includes it; Cart/Checkout show a "Platform fee" line; order total equals cart total exactly; test asserts it. Batch 3, with H7/M2 |
| H11 | **Admin Products page missing**: sidebar links to `/admin/products` but there is no route or page | `layouts/AdminLayout.tsx:11`; no `/admin/products` route in `App.tsx` | Admin Products page: all products with seller name and stock, search, Edit (reuse H9 form; admin may edit any product), Delete with confirm dialog. Batch 3, after H9 |
| H12 | **Cancelling an order does not restore stock** (once H8 decrements stock at checkout, cancelled orders permanently remove inventory) | `routes/orders.ts` `PATCH /orders/:id` only updates `status` | When an order moves to `cancelled`, restore each item's stock in the same transaction as the status change; test: checkout reduces stock, cancel restores it exactly. Batch 3, own commit after H7/M2 |

### 🟡 MEDIUM

| # | Issue | Evidence | Fix |
|---|---|---|---|
| M1 | Review abuse: unlimited reviews per user, no purchase check, no product-exists check, unvalidated rating type; non-numeric id → DB error → 500 (Likely) | `routes/products.ts:136-172` | One review per user/product; integer 1–5; 404 on missing product |
| M2 | Order creation isn't atomic: order, items, seller count, and cart clear are separate writes | `routes/orders.ts:44-110` | Wrap in `db.transaction` |
| M3 | Stale/misleading docs: `.agents/memory/` says the DB is **MongoDB**; `replit.md` says token is in-memory (it's in localStorage); README says 6 categories/30 products | Files listed | Rewrite README; delete `.agents/`, `replit.md` |
| M4 | Production hardening missing: no global error handler or JSON 404; `cors()` allows every origin; no login rate limit; no security headers | `app.ts` | Error middleware; restrict CORS (or same-origin); `express-rate-limit` on auth; `helmet` |
| M5 | Payment verify has no `onError` → spinner stuck forever on failure (Likely) | `pages/Checkout.tsx` ~line 103 | Handle error + toast |
| M6 | Order is created and cart cleared **before** Razorpay payment; dismissing the modal leaves a pending order and an empty cart | `routes/orders.ts` + `Checkout.tsx` | Clear cart only after payment success for Razorpay orders |
| M7 | Expired/invalid token isn't handled globally; `ProtectedRoute` calls `setLocation` during render (Likely React warning) | `App.tsx:52-76` | 401 → logout + redirect; use `<Redirect>` |
| M8 | Admin can set any arbitrary role string | `AdminUpdateUserBody.role: z.string()` | Enum `buyer | seller | admin` in OpenAPI spec |
| M9 | 1.01 MB JS bundle; N+1 queries in `enrichProduct` / categories count | Build output; `routes/products.ts:18` | Route-level `lazy()`; joins |
| M10 | `orderCount` is never incremented, so "Trending" ordering is meaningless. Batch 6 | `routes/products.ts` trending sorts by `orderCount`; checkout never updates it | Increment by item quantity at checkout; decrement on cancel |
| M11 | No review form in the UI (M1 is server-side only). Batch 6 | `pages/ProductDetail.tsx` has no `useCreateReview` | Review form on ProductDetail for eligible buyers (delivered order containing the product) |

### 🟢 LOW — Replit branding & cleanup

| # | Item | Location |
|---|---|---|
| L1 | Meta description "built on Replit. Update this description…"; CSS hack hiding Replit badge | `artifacts/instaveg/index.html` |
| L2 | Replit Vite plugins (`runtime-error-modal`, `cartographer`, `dev-banner`) | `vite.config.ts`, `package.json`, catalog |
| L3 | Replit config: `.replit`, `.replitignore`, `*/.replit-artifact/`, `replit.md`, `.agents/`, `scripts/post-merge.sh`, Replit comments + `@replit/*` excludes in `pnpm-workspace.yaml`, `// @replit` comments in `ui/button.tsx`, `ui/badge.tsx` | various |
| L4 | `attached_assets/` (old pasted Replit prompts) and the `@assets` alias | root, `vite.config.ts` |
| L5 | `artifacts/mockup-sandbox` workspace package (unused by app) | `artifacts/mockup-sandbox` |
| L6 | ~13.7 MB of **unreferenced** images: 7 PNGs (1–2 MB each) in `public/images/` and 10 JPGs in `public/images/products/`; `IMAGES` constant unused | `public/images`, `src/lib/constants.ts` |
| L7 | Category filter chips on the category page show a visible horizontal scrollbar: `scrollbar-hide` class is not defined anywhere (no plugin/CSS). Fix in Batch 6 | `pages/CategoryBrowse.tsx:59` |
| L8 | Checkout payment method card sits in the left half of a two-column grid now that only COD remains; make the single option full width. Batch 3, in the H10 commit | `pages/Checkout.tsx:200` |
| L9 | A suspended (or otherwise non-approved) seller can still delete their own products. Batch 6 | `routes/products.ts` `DELETE /products/:id` checks ownership but not seller status |

Note: the visible Replit badge on the live site is injected by Replit hosting. It disappears automatically once hosted on Vercel; the CSS hack should still be deleted.

---

## 4. Recommended deployment architecture

**Recommended: Vercel (frontend + Express as one serverless function) + Neon Postgres (free tier).**

- Vercel serves the Vite build as static files with an SPA rewrite.
- The existing Express `app` is exported from a single Vercel function handling `/api/*`. Same origin → no CORS or cookie problems.
- Neon provides serverless Postgres; use its **pooled** connection string with a small `pg` pool (`max: 1–3`).
- Changes required: split `listen()` out of the app (keep `index.ts` for local dev), don't run the startup seed on every cold start (seed via a one-off command), keep pino-pretty dev-only, run Drizzle migrations from your machine against Neon.
- Cost: $0 on hobby tiers. Trade-off: cold starts of ~1 s on the first API call.

**Fallback if serverless causes problems:** Vercel (frontend only) + Render/Railway (Express as a normal server) + Neon. Vercel `rewrites` proxies `/api/*` to the API host, so the frontend code doesn't change. Downside: Render's free tier sleeps after inactivity (30–50 s first load), which is bad for recruiters clicking a link.

---

## 5. Action plan (batches, in order)

| Batch | Goal | Covers |
|---|---|---|
| 0 | **Safety net**: back up live Replit DB; create `fix/audit` branch; get local dev running | H6, manual steps |
| 1 | Make the build green; reproducible seed with stable slugs | H1, H2 |
| 2 | Lock down authorization | C1–C7 |
| 3 | Business-logic correctness | H5, H7, H8, H9 (after C4), H10, H11 (after H9), H12, L8, M1, M2, M6, M8 |
| 4 | Product images: one mapping, hosted assets, fallback, verification script | H3, L6 |
| 5 | Remove Replit branding/config; README rewrite; `.env.example` | L1–L5, M3 |
| 6 | Frontend robustness + hardening | M4, M5, M7, M9, M10, M11, L7, L9 |
| 7 | Payments decision (real Razorpay test mode vs COD-only) | H4 |
| 8 | Vercel + Neon config; preview deploy; verify; promote to production | Phase 5–7 |

## 6. Decisions needed from the owner

1. **Razorpay**: integrate real test-mode payments (needs a free Razorpay account + test keys), or ship COD-only and label Razorpay "coming soon"?
2. **Images**: self-host verified images in the repo (most reliable, recommended) or keep hotlinking Unsplash URLs?
3. **Unused packages**: OK to delete `mockup-sandbox`, `attached_assets`, `.agents`, and Replit config files?
4. **Data**: recreate demo data fresh from the new seed (recommended), or migrate the live Replit data?
