-- ==========================================================================
-- Swad MH13 — demo/test data
--
-- Use this when you want every panel populated with something to click:
--   Customer  -> 3 open restaurants, 12 menu items, 4 orders to track
--   Owner     -> orders in placed / preparing / out_for_delivery / delivered
--   Rider     -> 3 riders (online, busy, offline) with assigned deliveries
--   Admin     -> customers + counts for the dashboard
--
-- How to use:
--   1. Run supabase/schema.sql first (it creates the tables).
--   2. Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
--   3. Safe to re-run: every insert is "on conflict do nothing".
-- ==========================================================================

-- ------------------------------------------------------------ restaurants
insert into public.restaurants
  (id, name, cuisine, area, category, rating, rating_count, delivery_minutes,
   delivery_fee, min_order, price_for_two, is_open, is_verified, accent, emoji, tagline, phone)
values
  ('r1', 'Kolhapuri Tadka', 'Maharashtrian • Mutton Thali', 'Rajarampuri, Kolhapur', 'thali',
   4.6, 1248, 32, 25, 99, 350, true, true, 'red', '🍲',
   'Authentic tambda-pandhra rassa since 1998', '+91 98220 11001'),
  ('r2', 'Annapurna Misal House', 'Misal • Snacks • Chai', 'Main Road, Gadhinglaj', 'misal',
   4.5, 2310, 22, 15, 59, 180, true, true, 'amber', '🥘',
   'Gadhinglaj-style misal since 1984', '+91 98220 11002'),
  ('r3', 'MH13 Pizza Co.', 'Pizza • Sides • Cold Coffee', 'Shahupuri, Kolhapur', 'pizza',
   4.3, 860, 28, 29, 149, 450, true, false, 'emerald', '🍕',
   'Cheese-burst pizzas from the MH13 kitchen', '+91 98220 11003')
on conflict (id) do nothing;

-- Keep the demo restaurants orderable while you are testing.
update public.restaurants set is_open = true where id in ('r1', 'r2', 'r3');

-- ------------------------------------------------------------- menu items
insert into public.menu_items
  (id, restaurant_id, name, description, price, category, is_veg, is_available, is_bestseller, emoji)
values
  ('m101', 'r1', 'Kolhapuri Mutton Thali', 'Mutton tambda rassa, pandhra rassa, bhakri and rice', 329, 'Mains', false, true, true, '🍖'),
  ('m102', 'r1', 'Tambda Rassa', 'Fiery Kolhapuri mutton gravy', 89, 'Gravies', false, true, false, '🌶️'),
  ('m103', 'r1', 'Pandhra Rassa', 'Creamy coconut mutton broth', 79, 'Gravies', false, true, false, '🍜'),
  ('m107', 'r1', 'Solkadhi', 'Kokum and coconut digestive drink', 59, 'Drinks', true, true, true, '🥤'),
  ('m108', 'r1', 'Jowar Bhakri', 'Hand-rolled jowar flatbread (2 pcs)', 35, 'Breads', true, true, false, '🫓'),
  ('m201', 'r2', 'Puneri Misal Pav', 'Spicy misal with farsan, onion and 2 pav', 99, 'Signature', true, true, true, '🥘'),
  ('m206', 'r2', 'Vada Pav', 'Classic Kolhapuri-style vada pav', 30, 'Snacks', true, true, true, '🍔'),
  ('m207', 'r2', 'Sabudana Khichdi', 'Upvas-friendly sabudana with peanuts', 79, 'Breakfast', true, true, false, '🍚'),
  ('m208', 'r2', 'Masala Chai', 'Cutting chai with ginger and cardamom', 20, 'Drinks', true, true, false, '☕'),
  ('m501', 'r3', 'MH13 Cheese Burst Pizza (8")', 'Double cheese burst base with paneer and capsicum', 259, 'Pizza', true, true, true, '🍕'),
  ('m505', 'r3', 'Cold Coffee', 'Thick cold coffee with ice cream', 99, 'Drinks', true, true, false, '☕'),
  ('m506', 'r3', 'Garlic Breadsticks', 'Butter-garlic breadsticks with dip', 129, 'Sides', true, true, false, '🥖')
on conflict (id) do nothing;

-- ----------------------------------------------------------------- riders
insert into public.riders (id, name, phone, area, vehicle, status, deliveries, rating)
values
  ('rd1', 'Kiran Patil', '+91 98765 43210', 'Rajarampuri, Kolhapur', 'Bike', 'online', 128, 4.9),
  ('rd2', 'Sneha Deshmukh', '+91 98765 43211', 'Gadhinglaj', 'Scooter', 'busy', 96, 4.8),
  ('rd3', 'Amit Jadhav', '+91 98765 43212', 'Shahupuri, Kolhapur', 'Bike', 'offline', 54, 4.7)
on conflict (id) do nothing;

-- -------------------------------------------------------------- customers
insert into public.customers (id, name, phone, email, address, orders, is_blocked)
values
  ('c1', 'Nikhil Jinde', '9876500011', 'nikhil@example.com', '12 Shivaji Colony, Rajarampuri, Kolhapur', 3, false),
  ('c2', 'Prachi Kulkarni', '9876500022', 'prachi@example.com', 'Flat 4B, Sai Residency, Gadhinglaj', 2, false),
  ('c3', 'Sameer Naik', '9876500033', 'sameer@example.com', 'Near Bus Stand, Shahupuri, Kolhapur', 1, false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------- orders
-- One order per stage so every panel has something to act on.
insert into public.orders
  (id, code, customer_id, customer_name, phone, address, restaurant_id, items,
   subtotal, delivery_fee, total, status, rider_id, payment_method, notes, created_at, updated_at)
values
  ('o1', 'MH13-1041', 'c1', 'Nikhil Jinde', '9876500011',
   '12 Shivaji Colony, Rajarampuri, Kolhapur', 'r1',
   '[{"menu_item_id":"m101","name":"Kolhapuri Mutton Thali","price":329,"qty":1,"emoji":"🍖"},
     {"menu_item_id":"m107","name":"Solkadhi","price":59,"qty":2,"emoji":"🥤"}]'::jsonb,
   447, 25, 472, 'placed', null, 'cod', 'Extra rassa please',
   now() - interval '4 minutes', now() - interval '4 minutes'),

  ('o2', 'MH13-1042', 'c2', 'Prachi Kulkarni', '9876500022',
   'Flat 4B, Sai Residency, Gadhinglaj', 'r2',
   '[{"menu_item_id":"m201","name":"Puneri Misal Pav","price":99,"qty":2,"emoji":"🥘"},
     {"menu_item_id":"m206","name":"Vada Pav","price":30,"qty":2,"emoji":"🍔"}]'::jsonb,
   258, 15, 273, 'preparing', 'rd1', 'upi', null,
   now() - interval '12 minutes', now() - interval '6 minutes'),

  ('o3', 'MH13-1043', 'c1', 'Nikhil Jinde', '9876500011',
   '12 Shivaji Colony, Rajarampuri, Kolhapur', 'r3',
   '[{"menu_item_id":"m501","name":"MH13 Cheese Burst Pizza (8\")","price":259,"qty":1,"emoji":"🍕"},
     {"menu_item_id":"m505","name":"Cold Coffee","price":99,"qty":2,"emoji":"☕"}]'::jsonb,
   457, 29, 486, 'out_for_delivery', 'rd2', 'cod', 'Ring the bell twice',
   now() - interval '25 minutes', now() - interval '8 minutes'),

  ('o4', 'MH13-1040', 'c3', 'Sameer Naik', '9876500033',
   'Near Bus Stand, Shahupuri, Kolhapur', 'r2',
   '[{"menu_item_id":"m201","name":"Puneri Misal Pav","price":99,"qty":1,"emoji":"🥘"},
     {"menu_item_id":"m208","name":"Masala Chai","price":20,"qty":2,"emoji":"☕"}]'::jsonb,
   139, 15, 154, 'delivered', 'rd3', 'cod', null,
   now() - interval '2 hours', now() - interval '90 minutes')
on conflict (id) do nothing;
