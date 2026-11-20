-- ============================================================================
-- Swad MH13 — migration: auth roles, rider assignment, RLS policies
--
-- Additive only. This file:
--   * never drops, renames or truncates a table,
--   * never deletes existing rows (the only UPDATE normalises old role values),
--   * never disables Row Level Security (it enables it),
--   * is idempotent — safe to run more than once.
--
-- Your project already has: profiles, restaurants, categories, menu_items,
-- addresses, orders, order_items. Existing columns and data are preserved.
--
-- How to run: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Normalise the role vocabulary (existing rows only, no deletion).
--    The app uses 'restaurant_owner'; older rows may say 'owner'.
-- ---------------------------------------------------------------------------
update public.profiles set role = 'restaurant_owner' where role = 'owner';
update public.profiles set role = 'customer' where role is null;

-- ---------------------------------------------------------------- profiles --
alter table public.profiles
  add column if not exists email      text,
  add column if not exists is_blocked boolean not null default false;

alter table public.profiles alter column role set default 'customer';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('customer', 'restaurant_owner', 'rider', 'admin'));

-- ------------------------------------------------------------- restaurants --
alter table public.restaurants
  add column if not exists city             text,
  add column if not exists pincode          text,
  add column if not exists owner_name       text,
  add column if not exists owner_phone      text,
  add column if not exists rejection_reason text,
  add column if not exists delivery_fee     numeric not null default 25,
  add column if not exists updated_at       timestamptz not null default now();

-- -------------------------------------------------------------- menu_items --
alter table public.menu_items
  add column if not exists is_veg boolean not null default true;

-- ------------------------------------------------------------- order_items --
-- Keep the dish name and price as they were when the order was placed, so
-- later price edits never rewrite order history.
alter table public.order_items
  add column if not exists name  text,
  add column if not exists price numeric(10, 2) not null default 0;

-- ------------------------------------------------------------------ orders --
-- rider_id points at public.profiles.id, which is the Supabase auth user id
-- (the same value as auth.uid()), so a rider sees exactly their deliveries.
alter table public.orders
  add column if not exists rider_id         uuid references public.profiles (id) on delete set null,
  add column if not exists subtotal         numeric not null default 0,
  add column if not exists delivery_fee     numeric not null default 0,
  add column if not exists delivery_address text,
  add column if not exists notes            text,
  add column if not exists updated_at       timestamptz not null default now();

alter table public.orders alter column order_status set default 'placed';

create index if not exists orders_rider_idx    on public.orders (rider_id);
create index if not exists orders_user_idx     on public.orders (user_id);
create index if not exists orders_status_idx   on public.orders (order_status);
create index if not exists menu_items_rest_idx on public.menu_items (restaurant_id);

-- ============================================================================
-- 1. Helper functions used by the policies.
--    security definer so a policy can read profiles/restaurants without
--    recursing into the very policies being evaluated.
-- ============================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.owns_restaurant(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant and r.owner_user_id = auth.uid()
  );
$$;

-- ============================================================================
-- 2. Row Level Security — enabled everywhere, never disabled.
-- ============================================================================
alter table public.profiles    enable row level security;
alter table public.restaurants enable row level security;
alter table public.categories  enable row level security;
alter table public.menu_items  enable row level security;
alter table public.addresses   enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Replace every policy on these seven tables with the canonical set below, so
-- an older/leftover permissive policy cannot silently widen access. Policies
-- are re-created immediately; no table or row is touched.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'restaurants', 'categories',
                        'menu_items', 'addresses', 'orders', 'order_items')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------- profiles --
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------- restaurants --
drop policy if exists restaurants_select on public.restaurants;
create policy restaurants_select on public.restaurants for select to anon, authenticated
  using (is_active or owner_user_id = auth.uid() or public.is_admin());

drop policy if exists restaurants_insert on public.restaurants;
create policy restaurants_insert on public.restaurants for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists restaurants_update on public.restaurants;
create policy restaurants_update on public.restaurants for update to authenticated
  using (owner_user_id = auth.uid() or public.is_admin())
  with check (owner_user_id = auth.uid() or public.is_admin());

drop policy if exists restaurants_delete on public.restaurants;
create policy restaurants_delete on public.restaurants for delete to authenticated
  using (owner_user_id = auth.uid() or public.is_admin());

-- -------------------------------------------------------------- menu_items --
drop policy if exists menu_items_select on public.menu_items;
create policy menu_items_select on public.menu_items for select to anon, authenticated
  using (
    public.is_admin()
    or public.owns_restaurant(restaurant_id)
    or exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_active)
  );

drop policy if exists menu_items_write on public.menu_items;
create policy menu_items_write on public.menu_items for all to authenticated
  using (public.owns_restaurant(restaurant_id) or public.is_admin())
  with check (public.owns_restaurant(restaurant_id) or public.is_admin());

-- -------------------------------------------------------------- categories --
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to anon, authenticated using (true);

drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------- addresses --
drop policy if exists addresses_all on public.addresses;
create policy addresses_all on public.addresses for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------------ orders --
-- Customer (own order), the restaurant's owner, the assigned rider, or admin.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (
    user_id = auth.uid()
    or rider_id = auth.uid()
    or public.owns_restaurant(restaurant_id)
    or public.is_admin()
  );

-- A customer may only create an order for themselves.
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated
  with check (user_id = auth.uid());

-- Status changes: the restaurant owner, the assigned rider, or an admin.
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
  using (
    public.owns_restaurant(restaurant_id)
    or rider_id = auth.uid()
    or public.is_admin()
  )
  with check (
    public.owns_restaurant(restaurant_id)
    or rider_id = auth.uid()
    or public.is_admin()
  );

-- ------------------------------------------------------------- order_items --
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.user_id = auth.uid() or o.rider_id = auth.uid()
           or public.owns_restaurant(o.restaurant_id) or public.is_admin())
  ));

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items for insert to authenticated
  with check (exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
  ));

-- ============================================================================
-- 3. Privilege guards — nobody can promote themselves.
-- ============================================================================

-- Only an admin may change profiles.role. (auth.uid() is null for the
-- server-side service key and for the SQL editor, so those still work.)
create or replace function public.prevent_role_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an administrator can change a role';
  end if;
  return new;
end $$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- An owner cannot approve or suspend their own restaurant.
create or replace function public.prevent_self_approval() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_active is distinct from old.is_active
     and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an administrator can approve or suspend a restaurant';
  end if;
  return new;
end $$;

drop trigger if exists restaurants_approval_guard on public.restaurants;
create trigger restaurants_approval_guard before update on public.restaurants
  for each row execute function public.prevent_self_approval();

-- orders.rider_id may only reference an account whose role is 'rider'.
create or replace function public.validate_rider_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.rider_id is not null
     and (tg_op = 'INSERT' or new.rider_id is distinct from old.rider_id)
     and not exists (
       select 1 from public.profiles p where p.id = new.rider_id and p.role = 'rider'
     )
  then
    raise exception 'Only an account with the rider role can be assigned to an order';
  end if;
  return new;
end $$;

drop trigger if exists orders_rider_guard on public.orders;
create trigger orders_rider_guard before insert or update of rider_id on public.orders
  for each row execute function public.validate_rider_assignment();

-- ============================================================================
-- 4. Profile row for every new auth user (role can never be admin here).
-- ============================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
  -- 'owner' is the legacy spelling; the app writes 'restaurant_owner'.
  if v_role = 'owner' then
    v_role := 'restaurant_owner';
  end if;
  if v_role not in ('customer', 'restaurant_owner', 'rider') then
    v_role := 'customer';
  end if;

  insert into public.profiles (id, full_name, phone, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'guest'), '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    new.email,
    v_role
  )
  on conflict (id) do update set email = excluded.email;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 5. Table privileges (RLS then decides which rows are visible).
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on public.restaurants, public.categories, public.menu_items to anon;

-- ============================================================================
-- 6. Storage bucket for restaurant logos and food photos (free tier).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('food-images', 'food-images', true)
on conflict (id) do update set public = true;

drop policy if exists "food images are public" on storage.objects;
create policy "food images are public" on storage.objects for select to public
  using (bucket_id = 'food-images');

drop policy if exists "authenticated users upload food images" on storage.objects;
create policy "authenticated users upload food images" on storage.objects for insert to authenticated
  with check (bucket_id = 'food-images');

drop policy if exists "owners replace their food images" on storage.objects;
create policy "owners replace their food images" on storage.objects for update to authenticated
  using (bucket_id = 'food-images' and owner = auth.uid());

-- ============================================================================
-- 7. ADMIN / RIDER BOOTSTRAP — run by hand, once, in the SQL editor.
--    (Never callable from the app.)
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--   update public.profiles set role = 'rider' where email = 'rider@example.com';
-- ============================================================================
