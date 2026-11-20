# Swad MH13 🍲

Mobile-first food delivery web app for Kolhapur / Gadhinglaj style food — misal, thali, biryani,
tandoor and more. One codebase, four panels, all reading and writing **your existing Supabase
database** through a small Express server.

**Live:** https://tzi5vty8qa.dev.ap-jt.com

| Panel | Route | What it does |
| --- | --- | --- |
| **Customer** | `/` | Browse restaurants & categories, search, menu, cart, address checkout, order history |
| **Restaurant Owner** | `/owner` | Own restaurant only: profile + cover photo, add/edit/delete dishes, photos, prices, availability, accept/prepare/ready |
| **Rider** | `/rider` | Assigned deliveries only, customer address, update status, mark delivered |
| **Admin** | `/admin` | Approve/reject restaurants, manage restaurants, customers, riders, categories, orders, assign riders |

Built with **React 19 + TypeScript + Tailwind CSS v4 (Vite)** and **Express 5**, which serves the
built client from `dist/` and the JSON API on the same port.

---

## 1. Environment variables

Everything is read server-side only — no Supabase key ever reaches the browser bundle.

| Name | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | yes | `https://<ref>.supabase.co` (a bare project ref also works) |
| `SUPABASE_SECRET_KEY` | yes* | Secret key (`sb_secret_…`). Server-side only. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes* | Legacy name for the same value. *Provide at least one. |
| `SUPABASE_PROJECT_REF` | no | Used when `SUPABASE_URL` is empty |
| `PORT` | no | Defaults to `3000`; the server binds `0.0.0.0` |

Set these in **AppJet → Settings → Environment variables** (or a local `.env`, see `.env.example`).
`SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` are optional and only used if you add
browser-direct Supabase calls later.

## 2. Quick start

```bash
npm install
npm run build     # tsc --noEmit + vite build → dist/
npm start         # serves dist/ and /api on http://localhost:3000
```

## 3. Database

The app uses the **existing** tables, without creating duplicates: `profiles`, `restaurants`,
`categories`, `menu_items`, `addresses`, `orders`, `order_items`.

Because the live schema may not have every optional column, every query is built from the columns
that actually exist (`server/schema.js`: `availableColumns()` + `pick()`), so the app runs on your
current database instead of failing on a missing column.

### Migration (optional, enables rider assignment)

`supabase/migrations/20261120000000_swad_mh13_auth.sql` is additive and idempotent. It adds the
columns/policies the rider workflow and stricter RLS need. The minimum for rider assignment:

```sql
alter table public.orders add column if not exists rider_id uuid references auth.users (id);
create index if not exists orders_rider_id_idx on public.orders (rider_id);
```

Run the whole file in **Supabase → SQL Editor** (or reconnect the Supabase integration in
**Settings → Connect Supabase** and ask me to apply it). Until `orders.rider_id` exists:

- the rider panel loads with an empty list and a notice,
- admin rider assignment returns `409` with a message pointing at this migration,
- everything else (customer, owner, admin) works normally.

### Admin access

Admin is never self-selectable. Create the account through normal registration, then promote it in
SQL:

```sql
update public.profiles set role = 'admin' where id = '<auth user id>';
```

## 4. Security model

- **Auth**: Supabase email/password via the server (`/api/auth/*`). The access/refresh token is
  stored in an httpOnly, SameSite cookie; the browser never sees it and sessions persist across
  reloads. Logout revokes the token server-side.
- **Roles**: `profiles.role` ∈ `customer` | `restaurant_owner` | `rider` | `admin`. Registration
  rejects `admin`; the server re-reads the role from the database on every request.
- **Ownership**: an owner can only read/write their own restaurant and its menu (cross-owner access
  returns 404); a rider only sees orders where `rider_id = auth.uid()`; a customer only sees their
  own addresses and orders.
- **Prices**: order totals are recomputed server-side from `menu_items`; any price/quantity total
  sent by the browser is ignored.
- **RLS**: policies are defined in the migration; Row Level Security is never disabled. The server
  uses the secret key, so RLS protects any direct client access to your project.
- **Uploads**: images are validated by MIME type, size-limited, and uploaded to a Supabase Storage
  bucket by the server; only the public URL is returned.

## 5. API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health`, `/api/config` | Uptime, mode, categories |
| `POST` | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Session lifecycle |
| `GET` | `/api/auth/me` | Current user + profile |
| `POST` | `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/password` | Password reset / change |
| `GET` | `/api/restaurants`, `/api/restaurants/:id` | Active restaurants, menu |
| `GET` | `/api/categories` | Categories |
| `GET`/`POST` | `/api/addresses`, `PATCH`/`DELETE` `/api/addresses/:id` | Customer addresses |
| `GET`/`POST` | `/api/orders` | Order history / place order (server-priced) |
| `PATCH` | `/api/orders/:id` | Cancel own order |
| `GET`/`PATCH` | `/api/owner/restaurant` | Owner restaurant profile |
| `GET`/`POST` | `/api/owner/menu`, `/api/owner/menu-items` | Owner menu |
| `PATCH`/`DELETE` | `/api/owner/menu-items/:id` | Edit / delete dish |
| `GET` | `/api/owner/orders` | Incoming orders for own restaurant |
| `PATCH` | `/api/owner/orders/:id/status` | Accept / prepare / ready / reject |
| `GET` | `/api/rider/orders` | Deliveries assigned to the signed-in rider |
| `PATCH` | `/api/rider/orders/:id/status` | Picked up / out for delivery / delivered |
| `GET` | `/api/admin/overview` | Admin counters + lists |
| `PATCH` | `/api/admin/restaurants/:id` | Approve / reject restaurant |
| `PATCH` | `/api/admin/orders/:id/assign` | Assign a rider |
| `PATCH`/`DELETE` | `/api/admin/profiles/:id` | Block / unblock / delete user |
| `POST`/`PATCH`/`DELETE` | `/api/admin/categories`, `/api/admin/categories/:id` | Category CRUD |
| `POST` | `/api/uploads` | Image upload → public URL |

Order statuses move strictly forward:
`placed → accepted → preparing → ready → out_for_delivery → delivered` (or `cancelled`). Invalid
jumps are rejected by the server.

## 6. Verification

`scripts/e2e-check.mjs` runs the real workflows against your Supabase project (registration, login,
logout, role isolation, restaurant registration + approval gating, menu CRUD, cross-owner
protection, ordering rules):

```bash
node scripts/cleanup-test-data.mjs && node scripts/e2e-check.mjs
```

Current result: **27/27 checks passed**. `npm run build` (typecheck + bundle) and the dependency
security scan also pass.

## 7. Android / mobile notes

- Mobile-first layouts, fixed bottom tab bar with `env(safe-area-inset-bottom)` for gesture nav.
- Touch targets ≥ 36 px, `inputMode` on numeric/tel fields for the Android keyboard.
- `viewport-fit=cover` + `theme-color`; verified at 390 px width, scales up to desktop.

## 8. Project structure

```
server/
  index.js      Express API + static hosting of dist/ (SPA fallback app.get('/{*splat}'))
  supabase.js   Service client + auth client + session helpers
  schema.js     Column discovery (availableColumns / pick) per table
src/
  App.tsx       Routes + role guards (RequireRole / GuestOnly)
  lib/          api.ts, auth.tsx, cart.tsx, types.ts, format.ts, image.ts
  components/   AppShell.tsx, kit.tsx
  pages/        Login, Register, ForgotPassword, ResetPassword, CustomerHome,
                RestaurantDetail, Cart, Checkout, Orders, OwnerDashboard,
                RiderDashboard, AdminDashboard
supabase/migrations/20261120000000_swad_mh13_auth.sql
scripts/e2e-check.mjs, cleanup-test-data.mjs, check-supabase-url.mjs
```

## 9. Free-tier notes

No paid services: no maps, SMS, payment gateway or external storage beyond Supabase's free Storage
bucket. Cash / UPI-on-delivery is recorded as a preference only — no money moves.
