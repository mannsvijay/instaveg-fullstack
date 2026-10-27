# Engineering notes

A short, factual record of what the audit found in InstaVEG and how it was fixed.
IDs refer to [`docs/AUDIT.md`](AUDIT.md), which has the full evidence and the remaining open items.

## Starting point

The app was built on Replit. The audit found that any logged-in user could read or change other
users' orders and other sellers' products, payments could be forged, the JWT secret had a public
fallback, the root build failed, the product catalog could not be recreated from the repo, and
product photos were frequently wrong or reused across products.

## Security

| ID | Problem | Fix |
|---|---|---|
| C1 | Broken access control (IDOR): any user could read any order, including the buyer's name and address | `GET /orders/:id` is limited to the buyer, the order's seller (resolved through their `sellers` row) and admins; others get 404 |
| C2 | Any user, including buyers, could set any status on any order | Only the order's seller or an admin may change status, one step forward at a time (`pending → confirmed → preparing → dispatched → delivered`) or cancel from `pending`/`confirmed`; a buyer may only cancel their own pending order. `delivered` and `cancelled` are final; concurrent changes return 409 |
| C3 | Sellers could list every order on the platform | `GET /orders` is scoped by role: own orders, own seller's orders, or all for admins |
| C4 | Sellers could edit or delete other sellers' products; "My Products" listed all products | `PATCH`/`DELETE /products/:id` require ownership (admins exempt), 404 otherwise; the seller page requests only its own seller id |
| C5, H4 | Payment verification could be forged: no ownership check, signature not tied to the stored order, public fallback secret; the Razorpay integration was simulated | InstaVEG is cash-on-delivery only by design. The Razorpay payment endpoints, the `razorpay` payment method and all client payment code were removed; orders accept only `cod`, and the old payment routes return 404 |
| C6 | Hardcoded JWT secret fallback (`"instaveg-secret-key"`) allowed forging admin tokens | The API refuses to start unless `SESSION_SECRET` is set and at least 32 characters |
| C7 | Checkout accepted another user's address id, copying their address into the order | The address must belong to the caller, otherwise 400 |

## Business logic

| ID | Problem | Fix |
|---|---|---|
| H7, M2 | Multi-vendor carts were assigned to the first item's seller; checkout was several separate writes | One order per seller, all in a single `db.transaction` (orders, items, stock, seller counts, clearing the cart); any failure rolls everything back |
| H8 | No quantity, price or stock validation; stock never checked or decremented | Quantities must be whole numbers within stock; prices > 0, MRP ≥ price, stock a whole number ≥ 0. Checkout re-checks stock under row locks, prices at the current product price and decrements stock |
| H12 | Cancelling an order did not return stock | Cancellation restores each item's stock in the same transaction as the status change |
| H10 | The buyer was charged ₹5 more than the cart showed (platform fee only added at checkout) | One pricing function for cart and checkout; the cart shows delivery and platform fees, and the order totals equal the cart total |
| H5 | Seller approval could be bypassed; unapproved sellers' products were public | Only approved sellers may create or update products; public listings, product pages, category counts and add-to-cart only see approved sellers' products |
| M1 | Unlimited, unverified reviews; bad ids caused server errors | Integer rating 1–5, product must exist, numeric ids only, one review per user and product (database unique constraint, 409), and only buyers with a delivered order containing the product |
| M8 | Admins could set any role string, or lock themselves out | Role is an enum (buyer, seller, admin); admins cannot change their own role or deactivate themselves |
| H9, H11 | Product editing and the admin Products page were linked but did not exist | Seller and admin product editing with ownership checks; admin Products page with search, edit and delete |
| L9 | Unapproved sellers could still delete products | Delete follows the same approval rule as create and update (403) |
| M10 | Product `orderCount` (used for "Trending") was never updated | Checkout adds each item's quantity in the checkout transaction; cancelling subtracts it with the stock restore |
| M11 | No way to write a review in the UI | Review form for buyers with a delivered order and no review yet, driven by `GET /products/{id}/reviews/eligibility`, which only checks the caller's own orders |
| M13, M14 | Admins could not suspend sellers from the UI; the order status dropdown offered invalid changes | Admin seller list by status with Suspend/Reactivate; the dropdown offers only valid transitions |

## Build, data and project hygiene

| ID | Change |
|---|---|
| H1 | The root build and typecheck pass; broken Mongoose-era scripts were removed |
| H2 | One idempotent Drizzle seed (5 demo accounts, 3 approved sellers, 8 categories, 32 products keyed by a stable `slug`); seeding is an explicit command, not run on API start |
| H6 | Local development works on Windows (no Linux-only binaries, cross-platform scripts, Vite `/api` proxy) |
| L1–L5, M3 | Replit branding, config, plugins, sandbox package and stale docs removed; README rewritten |
| M4 | API hardening: JSON 404 and a global JSON error handler that never sends stack traces, helmet security headers, a `CORS_ORIGINS` allow-list, and rate limits on login (failed attempts only) and register. The limiter is in-memory, so on serverless each instance counts separately |
| M5, M6 | Obsolete: they described the Razorpay payment flow, which no longer exists |
| M7 | Expired sessions: a 401 on an authenticated request logs the user out, shows "Session expired, please log in again" and redirects to /login; route guards use `<Redirect>` instead of navigating during render |
| M9 | Route pages are lazy-loaded (main JS chunk 1,049,739 → 495,082 bytes); product lists use one joined query and category counts one grouped query instead of N+1 queries |
| M12 | Dev/preview servers listen on localhost by default with Vite's host check; `DEV_HOST=0.0.0.0` opts in to network access |
| L7 | Category chips scroll without a visible scrollbar |

## Images

| ID | Change |
|---|---|
| H3 | Product images were name-keyed, overwritten by several scripts and reused across products. Every product and category now has one self-hosted 800×800 WebP at `/images/products/<slug>.webp` or `/images/categories/<slug>.webp`, chosen by hand from openly licensed Wikimedia Commons photos (CC0, public domain, CC BY, CC BY-SA). Most are cut out and placed on a plain studio background |
| H3 | One `ProductImage` component renders every product image (square, lazy-loaded, alt text, local placeholder on error) |
| H3 | Credits for every image are in `artifacts/instaveg/public/images/CREDITS.md` and shown on the `/credits` page |
| H3 | `pnpm --filter @workspace/scripts run verify-images` fails on a missing, duplicate (sha256), wrongly sized or oversized image, or one missing from the credits |
| L6 | About 13.7 MB of unreferenced images removed |

## Tests

`pnpm --filter @workspace/api-server run test` runs 45 API tests (Node's built-in test runner and
`fetch`, no extra dependencies) against a locally started API and the development database:

- 22 security tests covering C1–C7 and the H4 removal (old payment routes return 404, orders carry
  no Razorpay fields).
- 16 business-rule tests covering H5, H7, H8, H9, H10, H12, L9, M1, M2, M8, M10, M11 and M13,
  including a checkout that rolls back when a later item is out of stock.
- 7 hardening tests covering M4: JSON 404, malformed JSON, security headers, login and register
  rate limits, and CORS for allowed and disallowed origins.

The tests refuse to run with `NODE_ENV=production` or against a non-local `API_URL`, use their own
temporary products (slug prefix `security-test-`) and never modify seeded data.

## Still open

See the status table in `docs/AUDIT.md`: a few images not yet in the studio style (L10), dropping
the unused `razorpay_order_id` column (L11), and `trust proxy` for the deployment (M15). Deployment
to Vercel and Neon follows in Batch 8.
