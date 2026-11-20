import { sb, configured } from '../server/supabase.js'

if (!configured) process.exit(1)

const TABLES = {
  profiles: ['id', 'full_name', 'phone', 'email', 'role', 'is_blocked', 'created_at'],
  restaurants: [
    'id', 'owner_user_id', 'name', 'description', 'image_url', 'address', 'city', 'pincode',
    'owner_name', 'owner_phone', 'is_active', 'rejection_reason', 'delivery_fee', 'rating',
    'created_at', 'updated_at',
  ],
  categories: ['id', 'name', 'image_url', 'sort_order', 'created_at'],
  menu_items: [
    'id', 'restaurant_id', 'category_id', 'name', 'description', 'price', 'image_url',
    'is_available', 'is_veg', 'created_at',
  ],
  addresses: ['id', 'user_id', 'label', 'line1', 'line2', 'city', 'pincode', 'phone', 'is_default', 'created_at'],
  orders: [
    'id', 'user_id', 'restaurant_id', 'address_id', 'total_amount', 'subtotal', 'delivery_fee',
    'order_status', 'payment_status', 'payment_method', 'delivery_address', 'notes', 'rider_id',
    'created_at', 'updated_at',
  ],
  order_items: ['id', 'order_id', 'menu_item_id', 'name', 'quantity', 'price', 'created_at'],
}

for (const [table, candidates] of Object.entries(TABLES)) {
  const ok = []
  const missing = []
  for (const column of candidates) {
    const { error } = await sb.from(table).select(column).limit(1)
    if (error) missing.push(column)
    else ok.push(column)
  }
  console.log(`\n${table}`)
  console.log(`  present: ${ok.join(', ') || '(none)'}`)
  console.log(`  missing: ${missing.join(', ') || '(none)'}`)
}

// Embeds depend on real foreign keys, so probe them explicitly.
const embeds = [
  ['menu_items', '*, categories (name)'],
  ['orders', '*, order_items (*)'],
  ['orders', '*, restaurants (name)'],
  ['restaurants', '*, categories (name)'],
]
for (const [table, spec] of embeds) {
  const { error } = await sb.from(table).select(spec).limit(1)
  console.log(`embed ${table} :: ${spec} -> ${error ? `FAIL ${error.message}` : 'ok'}`)
}
