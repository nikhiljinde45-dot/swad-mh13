-- ==========================================================================
-- Swad MH13 — Supabase schema
--
-- How to use:
--   1. Open your Supabase project -> SQL Editor -> New query.
--   2. Paste this whole file and run it. It is idempotent (safe to re-run).
--   3. Set SUPABASE_URL and SUPABASE_ANON_KEY in AppJet
--      (Settings -> Environment variables). These are read by the Express
--      server only and are never sent to the browser.
--
-- The server seeds an empty project with demo restaurants, menu items,
-- riders, customers and orders on first boot, so the app is usable
-- immediately after this file runs.
--
-- Column names match server/seed.js and server/store.js exactly.
-- ==========================================================================

-- ------------------------------------------------------------- restaurants
create table if not exists public.restaurants (
  id               text primary key,
  name             text not null,
  cuisine          text not null,
  area             text not null,
  category         text not null default 'all',
  rating           numeric not null default 4.5,
  rating_count     integer not null default 0,
  delivery_minutes integer not null default 30,
  delivery_fee     integer not null default 20,
  min_order        integer not null default 99,
  price_for_two    integer not null default 300,
  is_open          boolean not null default true,
  is_verified      boolean not null default false,
  accent           text not null default 'amber',
  emoji            text not null default '🏪',
  tagline          text,
  phone            text,
  image_url        text,
  created_at       timestamptz not null default now()
);

-- -------------------------------------------------------------- menu_items
create table if not exists public.menu_items (
  id            text primary key,
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  name          text not null,
  description   text not null default '',
  price         integer not null check (price >= 0),
  category      text not null default 'Mains',
  is_veg        boolean not null default true,
  is_available  boolean not null default true,
  is_bestseller boolean not null default false,
  emoji         text not null default '🍽️',
  image_url     text,
  created_at    timestamptz not null default now()
);

create index if not exists menu_items_restaurant_idx on public.menu_items (restaurant_id);

-- ------------------------------------------------------------------ riders
create table if not exists public.riders (
  id         text primary key,
  name       text not null,
  phone      text not null,
  area       text not null,
  vehicle    text not null default 'Bike',
  status     text not null default 'offline'
             check (status in ('online', 'busy', 'offline')),
  deliveries integer not null default 0,
  rating     numeric not null default 4.8,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------- customers
create table if not exists public.customers (
  id         text primary key,
  name       text not null,
  phone      text not null unique,
  email      text,
  address    text,
  orders     integer not null default 0,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ orders
create table if not exists public.orders (
  id             text primary key,
  code           text not null,
  customer_id    text references public.customers (id) on delete set null,
  customer_name  text not null,
  phone          text not null,
  address        text not null,
  restaurant_id  text not null references public.restaurants (id) on delete cascade,
  items          jsonb not null default '[]'::jsonb,
  subtotal       integer not null default 0,
  delivery_fee   integer not null default 0,
  total          integer not null default 0,
  status         text not null default 'placed'
                 check (status in ('placed', 'accepted', 'preparing', 'ready',
                                   'out_for_delivery', 'delivered', 'cancelled')),
  rider_id       text references public.riders (id) on delete set null,
  payment_method text not null default 'cod' check (payment_method in ('cod', 'upi')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists orders_restaurant_idx on public.orders (restaurant_id);
create index if not exists orders_rider_idx      on public.orders (rider_id);
create index if not exists orders_status_idx     on public.orders (status);
create index if not exists orders_customer_idx   on public.orders (customer_id);

-- ------------------------------------------------------------------ access
-- Row Level Security is enabled on every table.
--
-- The AppJet server is the only client that talks to Supabase. It authenticates
-- with the anon key from server-side environment variables, so the browser never
-- receives a database credential.
--
-- The policies below let that server-side key read and write the tables. This is
-- a development setup that matches the app's current demo sign-in (choose an
-- owner / rider / admin in the UI). For production, add Supabase Auth, store the
-- user id on each row, and replace these policies with per-user rules — see
-- README.md ("Going to production").
-- --------------------------------------------------------------------------
alter table public.restaurants enable row level security;
alter table public.menu_items  enable row level security;
alter table public.riders      enable row level security;
alter table public.customers   enable row level security;
alter table public.orders      enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['restaurants', 'menu_items', 'riders', 'customers', 'orders']
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_app_rw', tbl);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      tbl || '_app_rw', tbl
    );
  end loop;
end $$;
