# Swad MH13 🍲

A mobile-first food delivery web app for Kolhapur / Gadhinglaj style food — misal, thali, biryani,
tandoor and more. One codebase, four panels:

| Panel | Route | What it does |
| --- | --- | --- |
| **Customer** | `/` | Browse restaurants & categories, search, view menus, add to cart, checkout, track orders |
| **Restaurant Owner** | `/owner` | Restaurant profile + cover photo, add/edit/delete dishes, upload food photos, change prices, availability, accept/prepare/ready orders |
| **Rider** | `/rider` | Duty status, claim packed orders, see assigned deliveries, mark picked up / delivered |
| **Admin** | `/admin` | Live stats, all orders, rider assignment, restaurants, riders, customers (block/delete) |

Built with **React 19 + TypeScript + Tailwind CSS v4 (Vite)** and a small **Express 5** server that
serves the built app and the JSON API.

---

## Quick start

```bash
npm install
npm run build     # typecheck + production build into dist/
npm start         # serves dist/ and /api on http://localhost:3000
```

For development with hot reload (Vite on :5173, proxying `/api` to :3000):

```bash
npm run server    # terminal 1 — API on :3000
npm run dev       # terminal 2 — UI on :5173
```

The app runs immediately **without any configuration** using built-in demo data
(7 restaurants, ~45 dishes, riders, customers and sample orders). A small banner in the
customer home page tells you which mode you are in.

---

## Connecting your existing Supabase database

The project is already wired for Supabase; only two server-side values are needed.

1. **Create the tables.** Open your Supabase project → **SQL Editor** → paste
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**. The file is idempotent.
2. **Add the credentials** in AppJet → **Settings → Environment variables**:

   | Variable | Where to find it | Notes |
   | --- | --- | --- |
   | `SUPABASE_URL` | Supabase → Project Settings → API → Project URL | e.g. `https://abcd1234.supabase.co`; a bare project ref such as `vppfluhgfkbamwngadcd` is also accepted and expanded to `https://<ref>.supabase.co` |
   | `SUPABASE_PROJECT_REF` | The `<ref>` part of `supabase.com/dashboard/project/<ref>` | Optional; used only when `SUPABASE_URL` is empty |
   | `SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` public key | Required |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same page, `service_role` secret | Optional; preferred on the server |

3. **Redeploy / restart.** The server probes Supabase at boot:
   - tables reachable → `mode: "supabase"` (all reads/writes go to your database),
   - tables missing or unreachable → `mode: "demo"` with a warning in `/api/config`, so the app
     never shows a blank screen.

Check the live mode at any time: `GET /api/config` → `{"mode": "supabase", ...}`.

### Are keys exposed to the browser?

**No.** Only `PORT` and `VITE_*` variables reach the client bundle. `SUPABASE_*` is read exclusively
in `server/store.js` via `process.env` and never imported into `src/`. The browser talks to
`/api/*` on your own server. See `.env.example`.

### Going to production

The shipped RLS policies in `supabase/schema.sql` let the server's key read/write all rows — this
matches the current demo sign-in where you pick an owner/rider/admin in the UI. Before opening the
app to real customers:

1. Add **Supabase Auth** (phone OTP works well for India) and store `auth.uid()` on rows
   (`owner_id`, `rider_id`, `customer_id`).
2. Replace the permissive policies with per-user rules, e.g. an owner may update only their own
   restaurant and its menu items.
3. Use `SUPABASE_SERVICE_ROLE_KEY` only in server code, never in a client bundle.
4. Move food photos to **Supabase Storage** (free tier) instead of inline data URLs — the upload
   helper is isolated in `src/lib/image.ts` and only needs to return a public URL.

---

## Project structure

```
server/
  index.js      Express API + static hosting of dist/ (SPA fallback)
  store.js      Supabase client + in-memory demo store, status transitions, stats
  seed.js       Demo catalogue (also seeds an empty Supabase project)
src/
  App.tsx       Routes for all four panels
  lib/
    api.ts      Typed fetch wrapper for /api/*
    types.ts    Shared domain types
    format.ts   ₹ formatting, status labels/colours, time helpers
    app-state.tsx  Cart, saved profile and toasts (localStorage)
    image.ts    On-device photo compression for menu/cover uploads
  components/   ui.tsx (buttons, sheet, tabs, steppers…), layouts, cards
  pages/        Home, RestaurantPage, CartPage, CheckoutPage, OrdersPage,
                TrackPage, PanelsPage, OwnerPanel, RiderPanel, AdminPanel
supabase/
  schema.sql    Tables, indexes, RLS policies
```

### API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Uptime + mode |
| `GET` | `/api/config` | Mode, categories, status flow |
| `GET` | `/api/restaurants?category=` | Restaurant list |
| `GET` | `/api/restaurants/:id` | Restaurant + menu |
| `PATCH` | `/api/restaurants/:id` | Profile, fees, open/closed, photo |
| `POST` | `/api/menu-items` | Add dish |
| `PATCH`/`DELETE` | `/api/menu-items/:id` | Edit / delete dish |
| `GET` | `/api/orders?restaurant_id=&rider_id=&status=` | Filtered orders |
| `POST` | `/api/orders` | Place order (validates prices server-side) |
| `PATCH` | `/api/orders/:id` | Status / rider assignment (transitions enforced) |
| `GET`/`POST` | `/api/riders`, `PATCH`/`DELETE` `/api/riders/:id` | Rider management |
| `GET` | `/api/customers`, `PATCH`/`DELETE` `/api/customers/:id` | Customer management |
| `GET` | `/api/admin/stats` | Admin dashboard counters |

Order statuses move strictly forward:
`placed → accepted → preparing → ready → out_for_delivery → delivered` (or `cancelled`).
Invalid jumps are rejected by the server.

---

## Android / mobile notes

- Layouts are mobile-first; the customer app uses a fixed bottom tab bar with safe-area padding
  (`env(safe-area-inset-bottom)`) for gesture-nav phones.
- Touch targets are ≥ 36 px, inputs use `inputMode` so Android shows numeric/tel keyboards.
- `viewport-fit=cover` + `theme-color` for a native-feeling status bar.
- Tested at 390 px width; it scales to tablet/desktop with a centered max-width column.

## What is not included (by design)

- **No paid services**: no maps, SMS, payment gateway or cloud storage. Cash/UPI-on-delivery is
  recorded as a preference only — no money moves.
- **No password auth**: panel identity is a picker (demo). Wire Supabase Auth before going live.
- Food photos are compressed client-side into the `image_url` column. Move to Supabase Storage for
  real production volume.
