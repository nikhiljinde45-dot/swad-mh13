-- ============================================================================
-- Swad MH13 — additive migration: Supabase Auth roles, extra columns, RLS
--
-- Your project already has: profiles, restaurants, categories, menu_items,
-- addresses, orders, order_items. This file NEVER drops or renames them; it
-- only adds the columns the app needs and turns on Row Level Security.
--
-- Run once: Supabase dashboard -> SQL Editor -> paste -> Run. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------- profiles
alter table public.profiles
  add column if not exists email      text,
  add column if not exists is_blocked boolean not null default false;

alter table public.profiles alter column role set default 'customer';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('customer', 'restaurant_owner', 'rider', 'admin'));

-- ------------------------------------------------------------- restaurants
alter table public.restaurants
  add column if not exists city             text,
  add column if not exists pincode          text,
  add column if not exists owner_name       text,
  add column if not exists owner_phone      text,
  add column if not exists rejection_reason text,
  add column if not exists delivery_fee     numeric not null default 25,
  add column if not exists updated_at       timestamptz not null default now();

-- -------------------------------------------------------------- menu_items
alter table public.menu_items
  add column if not exists is_veg boolean not null default true;

-- ------------------------------------------------------------------ orders
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
-- Helper functions used by the policies below.
-- security definer so reading profiles inside a policy cannot recurse.
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
-- Row Level Security
-- ============================================================================
alter table public.profiles    enable row level security;
alter table public.restaurants enable row level security;
alter table public.categories  enable row level security;
alter table public.menu_items  enable row level security;
alter table public.addresses   enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- profiles: you see yourself; admins see everyone.
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

-- restaurants: approved ones are public; owners see and edit their own.
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

-- menu_items: readable for approved restaurants; writable by the owning chef.
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

-- categories: everyone reads, only admins curate.
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to anon, authenticated using (true);

drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- addresses: strictly the owner's own rows.
drop policy if exists addresses_all on public.addresses;
create policy addresses_all on public.addresses for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- orders: customer, the restaurant's owner, the assigned rider, or admin.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (
    user_id = auth.uid()
    or rider_id = auth.uid()
    or public.owns_restaurant(restaurant_id)
    or public.is_admin()
  );

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated
  with check (user_id = auth.uid());

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

-- order_items: readable/writable only through an order you can already see.
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
-- Privilege guards: nobody can promote themselves.
-- ============================================================================
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

-- A restaurant owner must not be able to flip is_active on their own listing.
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

-- ============================================================================
-- Profile row for every new auth user (role can never be admin here).
-- ============================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
  if v_role not in ('customer', 'owner', 'rider') then
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
-- Storage bucket for restaurant logos and food photos.
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
-- ADMIN BOOTSTRAP (run by hand, once, in the SQL editor — never from the app):
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- Riders are promoted the same way:
--
--   update public.profiles set role = 'rider' where email = 'rider@example.com';
-- ============================================================================
