# CLAUDE.md — InstaVEG

You are working on InstaVEG, a hyperlocal vegetable marketplace being repaired and moved off Replit to Vercel.
Read `AUDIT.md` before starting any task. Every change should map to an audit item ID (C1, H3, L2…).

## Actual stack (verified)
- pnpm workspace monorepo, TypeScript 5.9, Node 20+ (pnpm 10.x required; use `pnpm`, never npm/yarn)
- `artifacts/instaveg`: React 19 + Vite 7 frontend (Wouter, Zustand, TanStack Query, Tailwind v4, shadcn/ui)
- `artifacts/api-server`: Express 5 API, mounted at `/api`, bundled with esbuild
- `lib/db`: **PostgreSQL + Drizzle ORM**. Ignore any doc that says MongoDB/Mongoose; it is stale.
- `lib/api-spec/openapi.yaml`: API contract. `lib/api-client-react` and `lib/api-zod` are **generated**; never hand-edit `src/generated/`. Change the spec, then run codegen.
- Auth: JWT Bearer token, secret from `SESSION_SECRET`.

## Commands
- Install: `pnpm install`
- Typecheck all: `pnpm run typecheck`
- Build all: `pnpm run build`
- Codegen after spec edits: `pnpm --filter @workspace/api-spec run codegen`
- API dev: `pnpm --filter @workspace/api-server run dev` (port 8080)
- Web dev: `pnpm --filter @workspace/instaveg run dev`
- Push schema (dev DB only): `pnpm --filter @workspace/db run push`
- Seed: `pnpm --filter @workspace/scripts run seed`

## Working rules (non-negotiable)
1. Inspect first, modify second. Before editing, state the audit item, the files involved, and the planned change.
2. Work in small batches. One logical fix per commit with a message like `fix(orders): C1 enforce order ownership`.
3. After each batch run `pnpm run typecheck` and the relevant build, and report the **actual** output. Never claim something works without evidence. If something can't be verified, say so.
4. Make the smallest reasonable change. Preserve working features and existing business logic unless a verified bug requires changing it. No large rewrites, no redesigns.
5. Never replace real backend behavior with mock data to make the UI look functional.
6. Never hardcode secrets or add fallback secrets. Required env vars must fail loudly at startup in production.
7. Never commit `.env` files, credentials, API keys, or database URLs. Keep `.env.example` updated with placeholder values only.
8. Never disable typechecks, security checks, or validation to make something pass.
9. **Ask the user before**: deleting files or packages, `drizzle-kit push --force`, running `scripts/src/dedup.ts`, dropping/resetting any database, running seeds against a non-local database, touching production data, or changing real payment behavior.
10. Payments: test/sandbox mode only. Never initiate real payments or send real emails/SMS.
11. Stop at the end of each batch and summarize: what changed, files touched, check results, remaining limitations, and what the user should test manually.

## Security conventions for this codebase
- Every route that takes an `:id` must verify the caller owns the resource or has the right role. Return 404 (not 403) for resources the caller may not see.
- Sellers act through their `sellers` row (`sellersTable.userId === req.user.id`), not their user id.
- Validate numbers server-side: quantities are positive integers; prices and stock are non-negative.
- Multi-step writes (checkout, stock decrement) go in `db.transaction`.

## Product images
- Products are identified by a stable `slug`, never by array index or display name alone.
- The seed's `slug → image` map is the single source of truth. No other script may overwrite product images.
- Every product image must actually depict that product. No photo may be reused across different products.
- Frontend renders product images through one shared component with a fallback image and a fixed aspect ratio.

## Platform notes
- The developer may be on Windows. Keep scripts cross-platform (no bare `export VAR=` in package.json scripts).
- Target deployment: Vercel (static frontend + Express as a serverless function under `/api`) + Neon Postgres. See `AUDIT.md` §4.
