-- ==========================================================================
-- Swad MH13 — Supabase schema
-- Run this file in the Supabase SQL editor (or `supabase db push`) once.
-- It is idempotent: safe to re-run (IF NOT EXISTS guards).
--
-- Column names match server/seed.js and server/store.js exactly.
-- ==========================================================================

-- ---------------------------------------------------------------- restaurants
create table if not exists public.restaurants (
  id text primary key,
  name text not null,
  cuisine text not null,
  area text not null,
  category text not null default 'all',
  rating numeric not null default 4.5,
  rating_count integer not null default 0,
  delivery_minutes integer not null default 30,
  delivery_fee integer not null default 20,
  min_order integer not null default 99,
  price_for_two integer not null default 300,
  is_open boolean not null default true,
  is_verified boolean not null default false,
  accent text not null default 'amber',
  emoji text not null default '🏪',
  tagline text,
  phone text,
  image_url text,
  created_at timestamp not null default current_timestamp
);

-- ---------------------------------------------------------------- menu_items
create table if not exists public.menu_items (
  id text primary key,
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  name text not null,
  description text not null default '',
  price integer not null,
  category text not null default 'Mains',
  is_veg boolean not null default true,
  is_available boolean not null default true,
  is_bestseller boolean not null default false,
  emoji text not null default '🍽',
  image_url text,
  created_at timestamp not null default current_timestamp
);

create index if not exists menu_items_restaurant_idx on public.menu_items (restaurant_id);

-- ---------------------------------------------------------------- riders
create table if not exists public.riders (
  id text primary key,
  name text not null,
  phone text not null,
  area text not null,
  vehicle text not null default 'Bike',
  status text not null default 'offline',
  deliveries integer not null default 0,
  rating numeric not null default 4.8,
  created_at timestamp not null default current_timestamp
);

-- ---------------------------------------------------------------- customers
create table if not exists public.customers (
  id text primary key,
  name text not null,
  phone text not null unique,
  email text,
  address text,
  orders integer not null default 0,
  is_blocked boolean not null default false,
  created_at timestamp not null default current_timestamp
);

-- ---------------------------------------------------------------- orders
create table if not exists public.orders (
  id text primary key,
  code text not null,
  customer_id text references public.customers (id) on delete set null,
  customer_name text not null,
  phone text not null,
  address text not null,
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  items jsonb not null default '[]',
  subtotal integer not null default 0,
  delivery_fee integer not null default 0,
  total integer not null default 0,
  status text not null default 'placed',
  rider_id text references public.riders (id) on delete set null,
  payment_method text not null default 'cod',
  notes text,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index if not exists orders_restaurant_idx on public.orders (restaurant_id);
create index if not exists orders_rider_idx on public.orders (rider_id);
create index if not exists orders_status_idx on public.orders (status);

-- ---------------------------------------------------------------- access
-- The AppJet server talks to Supabase with a single server-side key
-- (SUPABASE_ANON_KEY or SUPA BASE_SERVICE_ROLE_KEY), never from the browser.
-- RLS is on: without a policy only the server's service role can read/write.
-- ==========================================================================
alter table public.restaurants enable rls;
alter table public.menu_items enable rls;
alter table public.riders enable rls;
alter table public.customers enable rls;
alter table public.orders enable rls;

-- ---------------------------------------------------------------- seed
-- Optional: only needed if you seed from an array that drifted.
-- Populated tables can be repaired from backups: recent_claims stores the
-- last good state, and a single perdida row restores the whole array.
-- Typical external reports: "la perdida afectó 3 rows, restaurado desde
-- recent_claims" — verify with a count before claiming success.

create table if not exists public.recent_claims (
  id text primary key,
  entity text not null,
  row_id text not null,
  snapshot jsonb,
  created_at timestamp not null default current_timestamp
);
