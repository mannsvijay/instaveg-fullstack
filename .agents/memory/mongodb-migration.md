---
name: MongoDB migration
description: InstaVEG was migrated from PostgreSQL/Drizzle to MongoDB Atlas/Mongoose. Covers ID strategy, model patterns, and known gotchas.
---

## ID strategy
All Mongoose models use `_id: Number` (not ObjectId). A `Counter` collection auto-increments IDs via `findByIdAndUpdate($inc: {seq:1}, upsert)`. Every schema's `toJSON` transform adds `ret.id = ret._id; delete ret._id; delete ret.__v` so all API responses use `id: number` — matching what the OpenAPI spec and frontend expect.

**Why:** The OpenAPI Zod params (e.g. `GetProductParams`) expect numeric IDs. Switching to ObjectId strings would require regenerating the entire API spec and updating the frontend.

## Model locations
- Counter: `lib/db/src/models/counter.ts` (and `nextId(name)` export)
- All models: `lib/db/src/models/{user,seller,category,product,cart,order,address,review,wishlist}.ts`
- Main export: `lib/db/src/index.ts` — exports `connectDB()` + all models + all interfaces

## Cart and Order design
- Cart items embedded in Cart document (no separate collection). Items identified by `productId`, not their own ID.
- Order items embedded in Order document. Items have `productId`, `quantity`, `price`, `productName`, `productImage`, `productUnit`, `sellerId`.
- Prices in cart items stored as integer cents (÷100 to display). In orders, stored as float (as-is).

## connectDB
`connectDB()` reads `MONGODB_URI` env var and calls `mongoose.connect()`. Called in `artifacts/api-server/src/index.ts` before `app.listen()`.

## Startup seed
`artifacts/api-server/src/lib/startup-seed.ts` checks `User.countDocuments()` and seeds only if 0. Seeds 5 users, 3 sellers, 8 categories, 30 products. Re-runnable via script `scripts/src/seed.ts` which uses `findOneAndUpdate({upsert:true})`.

## Old Drizzle files
`lib/db/src/schema/` directory was deleted (previously had Drizzle pg-core schema files). The old `exports["./schema"]` entry in `lib/db/package.json` was also removed. If anyone references `@workspace/db/schema`, it will 404.

## lib/db package.json changes
- Removed: `drizzle-orm`, `drizzle-zod`, `pg`, `drizzle-kit`
- Added: `mongoose ^8.15.0`
- Removed export alias `"./schema"` (no longer needed)
- Kept `@types/node` as devDep

## Known Replit quirk
The `artifacts/instaveg: web` workflow health-check sometimes fails (DIDNT_OPEN_A_PORT) even though Vite starts and serves correctly on port 22039. Confirmed: manual run + curl returns 200. This is a Replit platform health-check timing issue, not a code bug. User can start the frontend via the Run button in the Replit UI.
