import { sb } from './supabase.js'

/* ------------------------------------------------------------------ *
 * Column discovery
 *
 * The live project may or may not have run supabase/migrations yet, so
 * every read/write is built from the columns that actually exist.
 * PostgREST names the offending column in its error, so one probe per
 * table converges in a couple of round trips and is cached afterwards.
 * ------------------------------------------------------------------ */

const cache = new Map()

function missingColumnFrom(message = '') {
  const patterns = [
    /column\s+"?([a-z0-9_.]+)"?\s+(?:of relation\s+"?[a-z0-9_]+"?\s+)?does not exist/i,
    /Could not find the '([a-z0-9_]+)' column/i,
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(message)
    if (match) return match[1].split('.').pop()
  }
  return null
}

export async function availableColumns(table, wanted) {
  const key = `${table}|${wanted.join(',')}`
  if (cache.has(key)) return cache.get(key)

  let cols = [...wanted]
  for (let attempt = 0; attempt <= wanted.length; attempt += 1) {
    if (!cols.length) break
    const { error } = await sb.from(table).select(cols.join(', ')).limit(1)
    if (!error) break
    const missing = missingColumnFrom(error.message)
    if (!missing || !cols.includes(missing)) break
    cols = cols.filter((column) => column !== missing)
  }

  cache.set(key, cols)
  return cols
}

/** Keep only the keys the table actually accepts. */
export const pick = (payload, cols) =>
  Object.fromEntries(Object.entries(payload).filter(([key]) => cols.includes(key)))

export const ORDER_COLUMNS = [
  'user_id', 'restaurant_id', 'address_id', 'total_amount', 'subtotal', 'delivery_fee',
  'order_status', 'payment_status', 'payment_method', 'delivery_address', 'notes',
  'rider_id', 'updated_at',
]

export const RESTAURANT_COLUMNS = [
  'owner_user_id', 'name', 'description', 'image_url', 'address', 'city', 'pincode',
  'owner_name', 'owner_phone', 'is_active', 'rejection_reason', 'delivery_fee', 'updated_at',
]

export const MENU_COLUMNS = [
  'restaurant_id', 'category_id', 'name', 'description', 'price', 'image_url',
  'is_available', 'is_veg',
]

export const PROFILE_COLUMNS = ['id', 'full_name', 'phone', 'email', 'role', 'is_blocked']

export const ADDRESS_COLUMNS = [
  'user_id', 'full_address', 'city', 'pincode', 'label', 'landmark', 'phone', 'is_default',
]

export const ORDER_ITEM_COLUMNS = [
  'order_id',
  'menu_item_id',
  'quantity',
  'name',
  'price',
  'item_name',
  'unit_price',
]
