# 🌿 InstaVEG

> **Hyperlocal vegetable marketplace — farm fresh, delivered fast.**

InstaVEG connects local farmers and vegetable sellers directly with buyers in their neighbourhood. Browse 30+ fresh vegetables and fruits, add to cart, and checkout — all in under 30 seconds.

<p align="center">
  <a href="https://green-mart-connect--mnvj69.replit.app/" target="_blank">
    <img src="https://img.shields.io/badge/Live-Demo-success?style=for-the-badge" alt="Live Demo">
  </a>
</p>

---

## ✨ Features

### 🛒 Buyer
- Browse by category (Leafy, Root, Gourds, Seasonal, Herbs, Fruits)
- Live search with debounced results and price filters
- Product detail page with reviews, nutrition info, and organic badge
- Multi-vendor cart with quantity controls
- Checkout with **Cash on Delivery** or **Razorpay** payment
- Order tracking with real-time status
- Wishlist management
- Profile & address management

### 🏪 Seller
- Store registration and approval workflow
- Product listing management (create, edit, delete)
- Order management — advance order status in one click
- Analytics dashboard with revenue charts (Recharts)
- Store settings

### 🔐 Admin
- Approve or reject seller applications
- Manage all users (view, role updates)
- Monitor all orders across sellers
- Platform-wide analytics — total users, revenue, active sellers

---

## 🎨 Design System

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#F6FCDF` | Page backgrounds |
| Primary | `#31511E` | Buttons, headings, accents |
| Accent | `#859F3D` | Badges, highlights |
| Font | Serif + Sans | Logo / body text |

Animations powered by **Framer Motion** — stagger effects, fade-ins, and smooth page transitions throughout.

---

## 🧑‍💻 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| 👤 Buyer | `buyer@instaveg.com` | `buyer123` |
| 🏪 Seller | `ramesh@instaveg.com` | `seller123` |
| 🏪 Seller | `priya@instaveg.com` | `seller123` |
| 🔐 Admin | `admin@instaveg.com` | `admin123` |

---

## 🏗️ Architecture

```
artifacts-monorepo/
├── artifacts/
│   ├── instaveg/          # React + Vite frontend  (served at /)
│   └── api-server/        # Express API server     (served at /api)
├── lib/
│   ├── db/                # PostgreSQL + Drizzle ORM schema
│   ├── api-spec/          # OpenAPI 3.1 contract (source of truth)
│   ├── api-client-react/  # Generated React Query hooks (Orval)
│   └── api-zod/           # Generated Zod schemas  (Orval)
└── scripts/               # Seed + migration utility scripts
```

### API-First Design

The OpenAPI spec in `lib/api-spec/openapi.yaml` is the single source of truth. Running `pnpm codegen` regenerates:
- **React Query hooks** for every endpoint (typed, with `queryKey` helpers)
- **Zod schemas** for request/response validation on the server

This means the frontend and backend always stay in sync.

---

## 🗄️ Database Schema

| Table | Description |
|-------|-------------|
| `users` | Buyers, sellers and admins — unified with a `role` field |
| `sellers` | Seller store profiles, approval status, ratings |
| `categories` | Product categories with slugs for URL routing |
| `products` | Listings with images, nutrition info, tags, stock |
| `carts` / `cart_items` | Per-user cart with multi-vendor support |
| `orders` / `order_items` | Orders with full status lifecycle |
| `addresses` | Saved delivery addresses per user |
| `reviews` | Product ratings and written reviews |
| `wishlists` | Saved products per user |

---

## 🔧 Tech Stack

### Frontend (`artifacts/instaveg`)
| Layer | Library |
|-------|---------|
| Framework | React 19 + Vite 7 |
| Routing | Wouter |
| State | Zustand |
| Data fetching | TanStack Query v5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Animations | Framer Motion |
| Charts | Recharts |
| Icons | Lucide React |

### Backend (`artifacts/api-server`)
| Layer | Library |
|-------|---------|
| Runtime | Node.js 24 |
| Framework | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 + drizzle-zod |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Logging | Pino |
| Build | esbuild |

---

## 🚀 Running Locally

### Prerequisites
- Node.js 20+
- pnpm 10+
- PostgreSQL database

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd instaveg-monorepo
pnpm install

# 2. Set environment variables
# DATABASE_URL=postgresql://...
# SESSION_SECRET=your-secret-key

# 3. Push DB schema
pnpm --filter @workspace/db run push

# 4. Seed demo data
pnpm --filter @workspace/scripts run seed

# 5. Start API server (port 8080)
pnpm --filter @workspace/api-server run dev

# 6. Start frontend (separate terminal)
pnpm --filter @workspace/instaveg run dev
```

### Useful Commands

```bash
# Full typecheck (all packages)
pnpm run typecheck

# Regenerate API hooks from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Build for production
pnpm run build

# Add more products / update images
pnpm --filter @workspace/scripts run update-products
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `lib/api-spec/openapi.yaml` | API contract — edit this, then run codegen |
| `lib/db/src/schema/` | Drizzle table definitions |
| `artifacts/api-server/src/routes/` | Route handlers (auth, products, cart, orders, admin…) |
| `artifacts/instaveg/src/App.tsx` | Frontend route map |
| `artifacts/instaveg/src/layouts/` | BuyerLayout, SellerLayout, AdminLayout |
| `artifacts/instaveg/src/pages/` | All page components |
| `scripts/src/seed.ts` | Demo account + product seed |

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ Yes | JWT signing secret |

---

## 📦 Seed Data

Running the seed script creates:
- **4 demo accounts** (1 admin, 2 sellers, 1 buyer)
- **2 approved seller stores**
- **6 categories** (Leafy, Root, Seasonal, Fruits, Herbs, Gourds)
- **30 products** with real photos, nutrition info, and tags

```bash
pnpm --filter @workspace/scripts run seed
```

---

## 🤝 Contributing

1. Branch off `main`
2. Edit the OpenAPI spec first for any API changes, then run codegen
3. Run `pnpm run typecheck` before pushing — zero TypeScript errors required
4. Push DB schema changes with `pnpm --filter @workspace/db run push`

