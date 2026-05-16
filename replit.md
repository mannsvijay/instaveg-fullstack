# InstaVEG

A production-grade hyperlocal vegetable marketplace connecting local farmers directly with buyers in their neighbourhood.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/instaveg run dev` — run the frontend (port assigned by Replit)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed demo accounts + products
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + Zustand + Framer Motion + shadcn/ui
- API: Express 5 + Pino logging
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/instaveg/` — React + Vite frontend (preview at `/`)
- `artifacts/api-server/` — Express API server (preview at `/api`)
- `artifacts/api-server/src/routes/` — Route handlers (auth, products, cart, orders, sellers, users, admin)
- `lib/db/src/schema/` — Drizzle ORM schema (users, sellers, products, categories, carts, orders, reviews, wishlists, addresses)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for codegen)
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not edit)
- `scripts/src/seed.ts` — Demo data seed script

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed hooks. Never edit generated files.
- JWT auth stored in Zustand (in-memory) + `setAuthTokenGetter` wired into custom fetch so all hooks automatically send Bearer tokens.
- Multi-vendor cart: items grouped by seller at checkout. Each order item tracks `sellerId`.
- Seller approval flow: sellers register → admin approves → seller can list products.
- Role-based routing: Buyer, Seller, Admin each have dedicated layout + route namespace.

## Product

**Buyer:** Browse categories, search products, view product details with reviews, add to cart/wishlist, checkout with COD or Razorpay, track orders.

**Seller:** Register store, manage product listings, view/advance order status, analytics dashboard with revenue charts.

**Admin:** Approve/reject sellers, manage all users and orders, platform-wide analytics.

## Demo Accounts

| Role   | Email                  | Password  |
|--------|------------------------|-----------|
| Admin  | admin@instaveg.com     | admin123  |
| Seller | ramesh@instaveg.com    | seller123 |
| Seller | priya@instaveg.com     | seller123 |
| Buyer  | buyer@instaveg.com     | buyer123  |

## Design System

- Background: `#F6FCDF` (earthy cream-green)
- Primary: `#31511E` (deep forest green)
- Accent: `#859F3D` (olive green)
- Animations: Framer Motion (stagger, fade, slide)
- Components: shadcn/ui base + custom Tailwind

## User preferences

- Earthy green theme throughout — no blues or grays as primary colors
- Keep all demo accounts seeded and re-runnable (`onConflictDoUpdate`)

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- The scripts package needs `@workspace/db` as a runtime dep for the seed script
- Vite preview is proxied — use relative URLs, not `localhost:8080` directly
- `OrderStatusUpdate.status` is a const-enum type — cast with `as any` when passing string values from UI dropdowns

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
