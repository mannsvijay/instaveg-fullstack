# Deploying InstaVEG (Vercel + Neon)

One Vercel project serves the React app and the Express API from the same domain:

- `/api` and `/api/*` → the Express API, running as one Vercel Function in `sin1` (Singapore), next to the Neon database in AWS `ap-southeast-1`.
- Every other path → the static Vite build, with an SPA fallback so deep links such as `/product/5` or `/admin/orders` work on refresh.

The build (`pnpm run build:vercel`) writes Vercel's [Build Output API](https://vercel.com/docs/build-output-api) directory `.vercel/output` itself:

| Path | Contents |
|---|---|
| `.vercel/output/static/` | The Vite build of `artifacts/instaveg` |
| `.vercel/output/functions/api.func/` | The API bundled by esbuild (`artifacts/api-server/src/vercel.ts`), Node.js 24, region `sin1`, `NODE_ENV=production` |
| `.vercel/output/config.json` | Routing and cache headers (see `artifacts/api-server/build-vercel.mjs`) |

Why this design: the workspace packages export TypeScript source, which Node cannot run and which [Vercel's Express support does not bundle](https://vercel.com/docs/frameworks/backend/express), so the API ships as one self-contained bundle. Routing and cache rules live in `build-vercel.mjs` (the generated `config.json`), not in `vercel.json`.

| Path | Cache-Control |
|---|---|
| `/assets/*` (content-hashed JS/CSS) | `public, max-age=31536000, immutable` |
| `/images/*` (product and category photos) | `public, max-age=604800, stale-while-revalidate=86400` |
| `/`, `/index.html` and SPA fallback responses | `no-cache` |

The build never pushes the schema or seeds data, and the API never seeds on startup. Both are manual steps below.

To try the exact build locally before deploying: `pnpm run build:vercel`, then `pnpm run preview:vercel` (serves `.vercel/output` on http://localhost:3100 with the same routing and cache headers, the function running with `NODE_ENV=production` and `VERCEL=1`, using the database in your `.env`). It is a stand-in, not Vercel itself, so the smoke test below is still needed.

## Live deployment

Production runs at **https://instaveg.vercel.app**, built from `main` against the Neon production branch, seeded with the production profile (32 catalog products).

What happened on the first deployment (`fix/audit` Preview, then `main` Production after pull request #1):

- The Git-triggered build used the `.vercel/output` written by `pnpm run build:vercel` (unknown 1 confirmed).
- `/api/...` paths reached Express unchanged after the rewrite (unknown 2 confirmed).
- Smoke checks 1–3 passed; no fallback was needed. Fallbacks A and B below are kept for reference only.

Project settings in use (no secret values recorded here):

| Setting | Value |
|---|---|
| Framework Preset | Other (`vercel.json`: `framework: null`, build command `pnpm run build:vercel`) |
| Root Directory | `./` |
| Install Command / Output Directory | not overridden |
| Node.js Version | 24.x |
| Function Region | Singapore (`sin1`) |
| Production Branch | `main` |
| `DATABASE_URL` | Production: Neon production branch, pooled. Preview: Neon dev branch, pooled |
| `SESSION_SECRET` | separate random values for Production and Preview |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` (Production and Preview) |
| `CORS_ORIGINS` | unset |
| Deployment Protection | Standard Protection (previews private) |

Read-only production check on 2026-10-28 (curl, no login, no data changed):

| Request | Result |
|---|---|
| `/api/healthz` | 200 `{"status":"ok"}`; `x-vercel-id: bom1::sin1::…` (edge Mumbai, function Singapore) |
| `/api/products?limit=100` | 200, `total: 32` |
| `/api/does-not-exist` | 404 `{"error":"Not found"}` (JSON) |
| `/product/5`, `/` | 200 `index.html`, `cache-control: no-cache` |
| `/images/products/tomato.webp` | 200 `image/webp`, `public, max-age=604800, stale-while-revalidate=86400` |
| `/images/products/missing.webp` | 404 from Vercel (not the app's HTML) |
| `/assets/index-*.js` | 200, `public, max-age=31536000, immutable` |
| API security headers | helmet's CSP, `strict-transport-security`, `x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN`, `referrer-policy: no-referrer`, COOP/CORP; no `x-powered-by` |

Observations, not yet changed:

- Static responses (the HTML, assets, images) carry only Vercel's own `strict-transport-security`; helmet's headers (CSP, `x-frame-options`, …) apply to `/api` only. Adding them to static routes would be a `config.json` header change in `build-vercel.mjs`.
- The `/images/*` cache header also applies to a 404 for a missing image.
- API responses get Vercel's default `cache-control: public, max-age=0, must-revalidate`, so they are not cached.

## Environments and databases

| Where | Neon branch | Connection string | `SESSION_SECRET` |
|---|---|---|---|
| Vercel **Production** | production branch | **pooled** (`-pooler` host) | its own random value |
| Vercel **Preview** | dev branch | **pooled** (`-pooler` host) | a **different** random value |
| Your machine, `.env` (local dev and tests) | dev branch | direct | your local value |
| Your machine, `.env.production.local` (schema push and seed only) | production branch | **direct** (no `-pooler`) | not used |

Preview deployments must never use the production database: give the Preview environment the dev branch only.

Vercel's [Deployment Protection](https://vercel.com/docs/deployment-protection) with **Standard Protection** keeps every deployment except the production domain private (only signed-in members of your Vercel team can open previews). Check that it is on in **Settings → Deployment Protection**.

`.env`, `.env.production.local` and every other `.env.*` file are gitignored; only `.env.example` is committed.

## 1. Neon (once)

1. In the Neon console, open your project (region AWS `ap-southeast-1`).
2. Make sure there is a **production** branch (usually the default `main` branch) and your **dev** branch.
3. For each branch, open **Connect** and copy:
   - the **pooled** connection string (host contains `-pooler`): used by Vercel;
   - for the production branch also the **direct** connection string (no `-pooler`): used only from your machine for the schema push and seed.

## 2. Create the production schema and demo data (from your machine)

1. In the repository root, create `.env.production.local` (it is gitignored):

   ```dotenv
   # Neon PRODUCTION branch, DIRECT (non-pooled) connection string
   DATABASE_URL=postgresql://...
   # Admin password for the public demo: at least 16 characters, not a demo password
   SEED_ADMIN_PASSWORD=...
   ```

   Generate a password with `node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"` and keep it in your password manager.

2. Push the schema to the production branch:

   ```bash
   pnpm --filter @workspace/db run push:production
   ```

   This reads `DATABASE_URL` only from `.env.production.local` (never from your shell or `.env`). drizzle-kit asks for confirmation before any destructive change; read its summary before confirming.

3. Seed the production demo data:

   ```bash
   pnpm --filter @workspace/scripts run seed:production
   ```

   The production profile:
   - sets the admin password from `SEED_ADMIN_PASSWORD` (`admin@instaveg.com`); the buyer and seller demo accounts keep their documented passwords (README);
   - re-activates the demo accounts and re-approves the three demo sellers;
   - resets the 32 catalog products (prices, stock, descriptions, images);
   - removes products visitors added under the demo sellers: deleted only if no order, cart, review or wishlist references them, otherwise hidden with stock 0 so other users' data is never broken. It prints what it deleted or hid;
   - never creates test accounts.

   Re-run the same command whenever you want to restore the demo after visitors change it.

## 3. Vercel project (once)

1. Sign in at [vercel.com](https://vercel.com) (the Hobby plan is enough) and connect your GitHub account.
2. **Add New… → Project**, import this repository.
3. On the import screen:
   - **Root Directory**: leave as the repository root (`./`).
   - **Framework Preset**: Other. `vercel.json` sets `framework: null` and the build command `pnpm run build:vercel`.
   - Do **not** override the Install Command (an override like `pnpm install` makes Vercel use its oldest pnpm) or the Output Directory (the build writes `.vercel/output`).
4. **Environment Variables** (Settings → Environment Variables), each scoped as shown:

   | Name | Production | Preview | Notes |
   |---|---|---|---|
   | `DATABASE_URL` | production branch, **pooled** | dev branch, **pooled** | never the direct string on Vercel |
   | `SESSION_SECRET` | random, 48+ bytes | a **different** random value | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1` | `1` | makes Vercel use `pnpm@10.34.9` from `package.json` ([docs](https://vercel.com/docs/builds/configure-a-build#corepack)) |
   | `CORS_ORIGINS` | leave unset | leave unset | only needed if another site must call the API |

   Do **not** add `SEED_ADMIN_PASSWORD` to Vercel; it is only used on your machine.

5. **Settings → Functions → Function Regions**: select **Singapore (`sin1`)**. The build also sets `sin1` on the function itself; the project setting keeps them consistent. The Hobby plan allows one region.
6. **Settings → Build and Deployment → Node.js Version**: 24.x.
7. **Settings → Git → Production Branch**: `main`. Other branches create Preview deployments.
8. **Settings → Deployment Protection**: Standard Protection with Vercel Authentication.

## 4. First deployment: Preview, then Production

1. Push a branch other than `main` (for example `fix/audit`): Vercel builds a Preview deployment using the **dev** database.
2. Open the build log and run the smoke test below against the preview URL. Previews are protected, so use a browser signed in to Vercel.
3. When everything passes, merge to `main`. Vercel builds the Production deployment against the **production** database. Run the smoke test again on the production URL.
4. Optional: add your own domain in **Settings → Domains**.

### Smoke-test checklist

Two things can only be confirmed on Vercel itself; the first three checks cover them.

| # | Check | Expected | Confirms |
|---|---|---|---|
| 1 | Build log | ends with `build-vercel: wrote .vercel/output (static, functions/api.func, config.json)`; the deployment summary lists a Function `api` in `sin1` | Vercel used our `.vercel/output` (unknown 1) |
| 2 | Open `/api/healthz` | `{"status":"ok"}` | the API function runs |
| 3 | Open `/api/products?limit=2` | JSON with `products` and `total` | Express sees the original `/api/...` path after the rewrite (unknown 2). If every `/api/...` URL returns `{"error":"Not found"}`, the path is not preserved: use fallback A |
| 4 | Open `/api/does-not-exist` | `{"error":"Not found"}` with status 404 | JSON 404 |
| 5 | Open `/product/5`, then refresh | the product page loads; response header `cache-control: no-cache` | SPA fallback and deep links |
| 6 | Open `/admin/orders` while signed out, then refresh | redirected to the login page | SPA fallback for protected routes |
| 7 | Open `/images/products/tomato.webp` | the image; `cache-control: public, max-age=604800, stale-while-revalidate=86400` | static images and cache headers |
| 8 | DevTools → Network, any `/assets/index-*.js` | `cache-control: public, max-age=31536000, immutable` | hashed asset caching |
| 9 | Open `/images/products/missing.webp` | 404 (not the app's HTML) | missing files are real 404s |
| 10 | Log in as `buyer@instaveg.com` / `buyer123`, add an item, check out with COD | order placed, visible under Orders | API, auth and database writes |
| 11 | Vercel → Logs for the deployment | one JSON object per request; no "does not use Neon's pooled" warning | JSON logging and pooled `DATABASE_URL` |
| 12 | Preview only: confirm the order from step 10 is in the **dev** branch, not production | | Preview is isolated from production data |

## Fallbacks

Use these only if the smoke test shows Vercel did not use `.vercel/output` (check 1 or 2 fails) or the `/api` path is not preserved (check 3 fails). Neither was needed for the live deployment.

### Fallback A: `api/` directory and `vercel.json` rewrites

Let Vercel build the function from the documented [`api/` directory](https://vercel.com/docs/functions/configuring-functions/advanced-configuration), while still shipping our esbuild bundle:

1. Change `build-vercel.mjs` to write the bundle to `artifacts/api-server/dist-vercel/index.mjs` instead of `.vercel/output/...`, and drop the static copy and `config.json` steps.
2. Add `api/index.mjs` at the repo root:

   ```js
   export { default } from "../artifacts/api-server/dist-vercel/index.mjs";
   ```

3. Replace `vercel.json` with:

   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "framework": null,
     "buildCommand": "pnpm run build:vercel",
     "outputDirectory": "artifacts/instaveg/dist/public",
     "regions": ["sin1"],
     "functions": { "api/index.mjs": { "includeFiles": "artifacts/api-server/dist-vercel/**" } },
     "rewrites": [
       { "source": "/api/(.*)", "destination": "/api" },
       { "source": "/((?!api/)[^.]*)", "destination": "/index.html" }
     ],
     "headers": [
       { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
       { "source": "/images/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=604800, stale-while-revalidate=86400" }] },
       { "source": "/((?!api/)[^.]*)", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
     ]
   }
   ```

4. Redeploy a Preview and repeat the smoke test.

### Fallback B: build locally and upload the prebuilt output

This uploads exactly the `.vercel/output` that the local verification tested; nothing is built on Vercel. The bundle is plain JavaScript (no native modules), so building on Windows is fine.

```bash
npm i -g vercel                                # Vercel CLI, once
vercel login                                   # needs your Vercel account
vercel link                                    # link this folder to the project (creates .vercel/project.json, gitignored)
pnpm run build:vercel                          # writes .vercel/output
vercel deploy --prebuilt                       # Preview deployment
# after the smoke test passes:
vercel deploy --prebuilt --prod                # Production deployment
```

Environment variables still come from the project settings at runtime. With this fallback, disable automatic Git deployments (Settings → Git) so Vercel does not also build from source.

## Maintenance

- **Restore the demo data:** run `pnpm --filter @workspace/scripts run seed:production` again.
- **Schema changes:** apply to the dev branch with `pnpm --filter @workspace/db run push`, test, then `push:production`, then deploy.
- **Rollback:** Vercel's Instant Rollback (Deployments → … → Instant Rollback) switches the domain back to a previous deployment; database changes are not rolled back.
- **Rotate `SESSION_SECRET`:** change it in Vercel and redeploy; everyone is logged out.
