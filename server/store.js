/**
 * Data access layer for Swad MH13.
 *
 * Two modes:
 *  - "supabase": SUPABASE_URL + SUPABASE_ANON_KEY (or service role) are set and
 *    the project is reachable. All reads/writes go to your Supabase database.
 *  - "demo": no credentials, or the Supabase probe failed. Data lives in memory
 *    so the whole app still works end-to-end.
 *
 * Credentials are read from process.env on the server only. Nothing here is ever
 * bundled into the browser build.
 */

import { createClient } from '@supabase/supabase-js'
import {
  seedRestaurants,
  seedMenuItems,
  seedRiders,
  seedCustomers,
  seedOrders,
  categories,
} from './seed.js'

/**
 * Resolve the Supabase project URL. Accepts any of these forms:
 *   SUPABASE_URL=https://vppfluhgfkbamwngadcd.supabase.co   (full URL)
 *   SUPABASE_URL=vppfluhgfkbamwngadcd                      (bare project ref)
 *   SUPABASE_PROJECT_REF=vppfluhgfkbamwngadcd              (bare ref, fallback)
 * A bare ref is expanded to https://<ref>.supabase.co, which is the same host the
 * dashboard shows at Settings -> API -> Project URL.
 */
export function resolveSupabaseUrl() {
  const raw = (process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_REF || '')
    .trim()
    .replace(/\/+$/, '')
  if (!raw) return ''
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (!url.hostname.includes('.')) return `https://${url.hostname}.supabase.co`
    return url.origin
  } catch {
    console.warn(`[swad-mh13] could not parse Supabase URL from "${raw}"`)
    return ''
  }
}

const SUPABASE_URL = resolveSupabaseUrl()
// Supabase key precedence. The newer names (sb_secret_… / sb_publishable_…)
// replace the legacy service_role / anon keys and are supported here too.
// Every one of these is read on the server only — never bundled for the browser.
const SUPABASE_KEY = (
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim()

const KEY_KIND =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    ? 'secret'
    : SUPABASE_KEY
      ? 'publishable'
      : 'none'
const SUPABASE_HOST = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : ''

export const status = {
  // Project URL is public information; the API key never leaves the server.
  supabaseUrl: SUPABASE_URL || null,
  supabaseHost: SUPABASE_HOST || null,
  supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_KEY),
  missingKey: Boolean(SUPABASE_URL && !SUPABASE_KEY),
  hasServiceRole: Boolean(
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  ),
  keyKind: KEY_KIND,
  missingTables: [],
  mode: 'demo',
  warning: null,
}

let sb = null

/** In-memory store used for demo mode. */
const memory = {
  restaurants: structuredClone(seedRestaurants),
  menu_items: structuredClone(seedMenuItems),
  riders: structuredClone(seedRiders),
  customers: structuredClone(seedCustomers),
  orders: structuredClone(seedOrders),
}

export const ORDER_FLOW = [
  'placed',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
]

export const ORDER_STATUSES = [...ORDER_FLOW, 'cancelled']

const ALLOWED_TRANSITIONS = {
  placed: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}

const now = () => new Date().toISOString()
const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`

function orderCode() {
  return `MH13-${Math.floor(1000 + Math.random() * 9000)}`
}

/* ------------------------------------------------------------------ */
/* Startup                                                             */
/* ------------------------------------------------------------------ */

export async function init() {
  if (!SUPABASE_URL) {
    status.mode = 'demo'
    status.warning =
      'No Supabase project URL found. Running on built-in demo data. Set SUPABASE_URL (or SUPABASE_PROJECT_REF) and SUPABASE_ANON_KEY in Settings → Environment variables.'
    console.log('[swad-mh13] demo mode — no Supabase project URL configured')
    return status
  }

  if (!SUPABASE_KEY) {
    status.mode = 'demo'
    status.warning = `Supabase project ${SUPABASE_HOST} is linked, but SUPABASE_ANON_KEY is missing. Add it in Settings → Environment variables to switch from demo data to your database.`
    console.log(`[swad-mh13] demo mode — project ${SUPABASE_HOST} linked, waiting for SUPABASE_ANON_KEY`)
    return status
  }

  try {
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const probe = await sb.from('restaurants').select('id').limit(1)
    if (probe.error) throw new Error(probe.error.message)

    status.mode = 'supabase'
    status.warning = null

    if ((probe.data || []).length === 0 && process.env.AUTO_SEED_SUPABASE !== 'false') {
      await seedSupabase()
    }
    await detectMissingTables()
    console.log(
      `[swad-mh13] connected to Supabase${
        status.missingTables.length
          ? ` — missing tables: ${status.missingTables.join(', ')}`
          : ''
      }`
    )
  } catch (err) {
    status.mode = 'demo'
    status.warning = `Supabase connection failed (${err.message}). Running on demo data. Check SUPABASE_URL / SUPABASE_ANON_KEY and that supabase/schema.sql has been applied.`
    console.warn('[swad-mh13]', status.warning)
  }

  return status
}

/** Insert the demo catalogue into an empty Supabase project so the app is usable immediately. */
async function seedSupabase() {
  console.log('[swad-mh13] seeding empty Supabase project with demo catalogue')
  const catalogue = {
    restaurants: seedRestaurants,
    menu_items: seedMenuItems,
    riders: seedRiders,
    customers: seedCustomers,
    orders: seedOrders,
  }
  // Per-table so one missing table cannot abort the whole seed (or the boot).
  for (const [table, rows] of Object.entries(catalogue)) {
    const { error } = await sb.from(table).insert(rows)
    if (error) console.warn(`[swad-mh13] seed "${table}" skipped: ${error.message}`)
  }
}

// A table that does not exist in the project yet is served from the in-memory
// demo store, so every panel stays usable while the schema is being applied.
const useSupabase = (table) =>
  status.mode === 'supabase' && !(table && status.missingTables.includes(table))

/** Every table the app reads. supabase/schema.sql creates all of them. */
const REQUIRED_TABLES = ['restaurants', 'menu_items', 'riders', 'customers', 'orders']

const MISSING_TABLE_RE = /could not find the table|does not exist|schema cache|undefined table/i

function isMissingTableError(error) {
  return Boolean(error) && MISSING_TABLE_RE.test(error.message || '')
}

/**
 * Record a table as missing and return the fallback value.
 * A project that has not run schema.sql yet should still render the app (with an
 * explicit notice) instead of returning HTTP 500 from every panel.
 */
function degradeForMissingTable(table, error, fallback) {
  if (!status.missingTables.includes(table)) status.missingTables.push(table)
  console.warn(`[swad-mh13] table "${table}" missing — run supabase/schema.sql (${error.message})`)
  return fallback
}

/** Probe each required table once at boot so /api/config can report what is missing. */
export async function detectMissingTables() {
  status.missingTables = []
  if (!useSupabase()) return status.missingTables

  for (const table of REQUIRED_TABLES) {
    const { error } = await sb.from(table).select('*', { count: 'exact', head: true })
    if (!error) continue
    if (isMissingTableError(error)) status.missingTables.push(table)
    else console.warn(`[swad-mh13] probe "${table}" failed: ${error.message}`)
  }

  status.warning = status.missingTables.length
    ? `Connected to Supabase. These tables do not exist yet: ${status.missingTables.join(', ')} — their panels are running on built-in demo data. Run supabase/schema.sql in the Supabase SQL editor to save that data in your own database.`
    : null
  return status.missingTables
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function enrichOrder(order, restaurantMap, riderMap) {
  const restaurant = restaurantMap.get(order.restaurant_id)
  const rider = order.rider_id ? riderMap.get(order.rider_id) : null
  return {
    ...order,
    restaurant_name: restaurant ? restaurant.name : 'Restaurant',
    restaurant_area: restaurant ? restaurant.area : '',
    rider_name: rider ? rider.name : null,
    rider_phone: rider ? rider.phone : null,
  }
}

async function maps() {
  const [restaurants, riders] = await Promise.all([listRestaurants(), listRiders()])
  return {
    restaurantMap: new Map(restaurants.map((r) => [r.id, r])),
    riderMap: new Map(riders.map((r) => [r.id, r])),
  }
}

/* ------------------------------------------------------------------ */
/* Restaurants                                                         */
/* ------------------------------------------------------------------ */

export async function listRestaurants({ category } = {}) {
  let rows
  if (useSupabase('restaurants')) {
    let q = sb.from('restaurants').select('*').order('name')
    if (category && category !== 'all') q = q.eq('category', category)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    rows = data
  } else {
    rows = memory.restaurants.filter((r) => !category || category === 'all' || r.category === category)
    rows = [...rows].sort((a, b) => a.name.localeCompare(b.name))
  }
  return rows
}

export async function getRestaurant(id) {
  if (useSupabase('restaurants')) {
    const { data, error } = await sb.from('restaurants').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }
  return memory.restaurants.find((r) => r.id === id) || null
}

export async function updateRestaurant(id, patch) {
  const allowed = [
    'name',
    'cuisine',
    'area',
    'tagline',
    'phone',
    'delivery_fee',
    'min_order',
    'delivery_minutes',
    'is_open',
    'image_url',
  ]
  const clean = {}
  for (const key of allowed) {
    if (patch[key] !== undefined) clean[key] = patch[key]
  }
  if (!Object.keys(clean).length) throw new Error('No updatable fields supplied')

  if (useSupabase('restaurants')) {
    const { data, error } = await sb.from('restaurants').update(clean).eq('id', id).select().maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Restaurant not found')
    return data
  }

  const restaurant = memory.restaurants.find((r) => r.id === id)
  if (!restaurant) throw new Error('Restaurant not found')
  Object.assign(restaurant, clean)
  return restaurant
}

/* ------------------------------------------------------------------ */
/* Menu items                                                          */
/* ------------------------------------------------------------------ */

export async function listMenu(restaurantId) {
  let rows
  if (useSupabase('menu_items')) {
    const { data, error } = await sb
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name')
    if (error) {
      if (isMissingTableError(error)) rows = degradeForMissingTable('menu_items', error, [])
      else throw new Error(error.message)
    } else {
      rows = data
    }
  } else {
    rows = memory.menu_items
      .filter((m) => m.restaurant_id === restaurantId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  return rows
}

export async function createMenuItem(payload) {
  const name = String(payload.name || '').trim()
  const price = Number(payload.price)
  if (!name) throw new Error('Item name is required')
  if (!Number.isFinite(price) || price <= 0) throw new Error('A valid price is required')
  if (!payload.restaurant_id) throw new Error('restaurant_id is required')

  const row = {
    id: uid('m'),
    restaurant_id: payload.restaurant_id,
    name,
    description: String(payload.description || '').trim(),
    price: Math.round(price),
    category: String(payload.category || 'Mains').trim() || 'Mains',
    is_veg: payload.is_veg !== false,
    is_available: payload.is_available !== false,
    is_bestseller: Boolean(payload.is_bestseller),
    emoji: String(payload.emoji || '🍽️').slice(0, 8),
    image_url: payload.image_url || null,
  }

  if (useSupabase('menu_items')) {
    const { data, error } = await sb.from('menu_items').insert(row).select().maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }
  memory.menu_items.push(row)
  return row
}

export async function updateMenuItem(id, patch) {
  const allowed = [
    'name',
    'description',
    'price',
    'category',
    'is_veg',
    'is_available',
    'is_bestseller',
    'emoji',
    'image_url',
  ]
  const clean = {}
  for (const key of allowed) {
    if (patch[key] !== undefined) clean[key] = patch[key]
  }
  if (clean.price !== undefined) {
    const price = Number(clean.price)
    if (!Number.isFinite(price) || price <= 0) throw new Error('A valid price is required')
    clean.price = Math.round(price)
  }
  if (!Object.keys(clean).length) throw new Error('No updatable fields supplied')

  if (useSupabase('menu_items')) {
    const { data, error } = await sb.from('menu_items').update(clean).eq('id', id).select().maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Menu item not found')
    return data
  }

  const item = memory.menu_items.find((m) => m.id === id)
  if (!item) throw new Error('Menu item not found')
  Object.assign(item, clean)
  return item
}

export async function deleteMenuItem(id) {
  if (useSupabase('menu_items')) {
    const { error } = await sb.from('menu_items').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return { id, deleted: true }
  }
  const index = memory.menu_items.findIndex((m) => m.id === id)
  if (index === -1) throw new Error('Menu item not found')
  memory.menu_items.splice(index, 1)
  return { id, deleted: true }
}

/* ------------------------------------------------------------------ */
/* Orders                                                             */
/* ------------------------------------------------------------------ */

export async function listOrders({ customer_id, restaurant_id, rider_id, status: orderStatus } = {}) {
  let rows
  if (useSupabase('orders')) {
    let q = sb.from('orders').select('*').order('created_at', { ascending: false })
    if (customer_id) q = q.eq('customer_id', customer_id)
    if (restaurant_id) q = q.eq('restaurant_id', restaurant_id)
    if (rider_id) q = q.eq('rider_id', rider_id)
    if (orderStatus) q = q.eq('status', orderStatus)
    const { data, error } = await q
    if (error) {
      if (isMissingTableError(error)) rows = degradeForMissingTable('orders', error, [])
      else throw new Error(error.message)
    } else {
      rows = data
    }
  } else {
    rows = memory.orders
      .filter((o) => !customer_id || o.customer_id === customer_id)
      .filter((o) => !restaurant_id || o.restaurant_id === restaurant_id)
      .filter((o) => !rider_id || o.rider_id === rider_id)
      .filter((o) => !orderStatus || o.status === orderStatus)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  }

  const { restaurantMap, riderMap } = await maps()
  return rows.map((o) => enrichOrder(o, restaurantMap, riderMap))
}

export async function getOrder(id) {
  let order
  if (useSupabase('orders')) {
    const { data, error } = await sb.from('orders').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    order = data
  } else {
    order = memory.orders.find((o) => o.id === id)
  }
  if (!order) return null
  const { restaurantMap, riderMap } = await maps()
  return enrichOrder(order, restaurantMap, riderMap)
}

export async function createOrder(payload) {
  const restaurant = await getRestaurant(payload.restaurant_id)
  if (!restaurant) throw new Error('Restaurant not found')
  if (!restaurant.is_open) throw new Error(`${restaurant.name} is currently closed`)

  const items = Array.isArray(payload.items) ? payload.items : []
  if (!items.length) throw new Error('Your cart is empty')

  const menu = await listMenu(restaurant.id)
  const menuMap = new Map(menu.map((m) => [m.id, m]))

  const cleanItems = items.map((line) => {
    const menuItem = menuMap.get(line.menu_item_id)
    if (!menuItem) throw new Error(`Item is no longer available: ${line.name || line.menu_item_id}`)
    if (!menuItem.is_available) throw new Error(`${menuItem.name} is currently unavailable`)
    const qty = Math.max(1, Math.min(30, Math.round(Number(line.qty) || 1)))
    return {
      menu_item_id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      qty,
      emoji: menuItem.emoji || '🍽️',
    }
  })

  const subtotal = cleanItems.reduce((sum, line) => sum + line.price * line.qty, 0)
  const deliveryFee = Number(restaurant.delivery_fee) || 0
  const total = subtotal + deliveryFee

  const name = String(payload.customer_name || '').trim()
  const phone = String(payload.phone || '').trim()
  const address = String(payload.address || '').trim()
  if (!name) throw new Error('Please add a name for the order')
  if (phone.replace(/\D/g, '').length < 10) throw new Error('Please add a valid 10-digit phone number')
  if (address.length < 8) throw new Error('Please add a complete delivery address')

  const customerId = payload.customer_id || uid('c')
  const order = {
    id: uid('o'),
    code: orderCode(),
    customer_id: customerId,
    customer_name: name,
    phone,
    address,
    restaurant_id: restaurant.id,
    items: cleanItems,
    subtotal,
    delivery_fee: deliveryFee,
    total,
    status: 'placed',
    rider_id: null,
    payment_method: payload.payment_method === 'upi' ? 'upi' : 'cod',
    notes: String(payload.notes || '').trim().slice(0, 240),
    created_at: now(),
    updated_at: now(),
  }

  if (useSupabase('orders')) {
    const { data, error } = await sb.from('orders').insert(order).select().maybeSingle()
    if (error) throw new Error(error.message)
    await touchCustomer(data, { name, phone, address })
    return enrichOrder(data, new Map([[restaurant.id, restaurant]]), new Map())
  }

  memory.orders.unshift(order)
  await touchCustomer(order, { name, phone, address })
  const { restaurantMap, riderMap } = await maps()
  return enrichOrder(order, restaurantMap, riderMap)
}

async function touchCustomer(order, { name, phone, address }) {
  const existing = await getCustomerByPhone(phone)
  if (existing) {
    const orders = (existing.orders || 0) + 1
    if (useSupabase('customers')) {
      await sb.from('customers').update({ orders, address }).eq('id', existing.id)
    } else {
      const row = memory.customers.find((c) => c.id === existing.id)
      if (row) Object.assign(row, { orders, address })
    }
    return
  }
  const row = {
    id: order.customer_id,
    name,
    phone,
    email: '',
    address,
    orders: 1,
    created_at: now(),
    is_blocked: false,
  }
  if (useSupabase('customers')) {
    await sb.from('customers').insert(row)
  } else {
    memory.customers.push(row)
  }
}

export async function updateOrder(id, patch) {
  const current = await getOrder(id)
  if (!current) throw new Error('Order not found')

  const clean = {}
  if (patch.status !== undefined) {
    if (!ORDER_STATUSES.includes(patch.status)) throw new Error(`Unknown status: ${patch.status}`)
    if (patch.status !== current.status) {
      const allowed = ALLOWED_TRANSITIONS[current.status] || []
      if (!allowed.includes(patch.status)) {
        throw new Error(`Cannot move an order from ${current.status} to ${patch.status}`)
      }
    }
    clean.status = patch.status
  }
  if (patch.rider_id !== undefined) clean.rider_id = patch.rider_id || null
  if (!Object.keys(clean).length) throw new Error('Nothing to update')
  clean.updated_at = now()

  if (useSupabase('orders')) {
    const { data, error } = await sb.from('orders').update(clean).eq('id', id).select().maybeSingle()
    if (error) throw new Error(error.message)
    const { restaurantMap, riderMap } = await maps()
    return enrichOrder(data, restaurantMap, riderMap)
  }

  const order = memory.orders.find((o) => o.id === id)
  Object.assign(order, clean)
  const { restaurantMap, riderMap } = await maps()
  return enrichOrder(order, restaurantMap, riderMap)
}

/* ------------------------------------------------------------------ */
/* Riders                                                             */
/* ------------------------------------------------------------------ */

export async function listRiders() {
  if (useSupabase('riders')) {
    const { data, error } = await sb.from('riders').select('*').order('name')
    if (error) {
      if (isMissingTableError(error)) return degradeForMissingTable('riders', error, [])
      throw new Error(error.message)
    }
    return data
  }
  return [...memory.riders].sort((a, b) => a.name.localeCompare(b.name))
}

export async function updateRider(id, patch) {
  const clean = {}
  if (patch.status !== undefined) {
    if (!['online', 'busy', 'offline'].includes(patch.status)) throw new Error('Invalid rider status')
    clean.status = patch.status
  }
  if (patch.name !== undefined) clean.name = String(patch.name).trim()
  if (patch.phone !== undefined) clean.phone = String(patch.phone).trim()
  if (patch.area !== undefined) clean.area = String(patch.area).trim()
  if (patch.vehicle !== undefined) clean.vehicle = String(patch.vehicle).trim()
  if (!Object.keys(clean).length) throw new Error('Nothing to update')

  if (useSupabase('riders')) {
    const { data, error } = await sb.from('riders').update(clean).eq('id', id).select().maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Rider not found')
    return data
  }
  const rider = memory.riders.find((r) => r.id === id)
  if (!rider) throw new Error('Rider not found')
  Object.assign(rider, clean)
  return rider
}

export async function createRider(payload) {
  const name = String(payload.name || '').trim()
  const phone = String(payload.phone || '').trim()
  if (!name) throw new Error('Rider name is required')
  if (phone.replace(/\D/g, '').length < 10) throw new Error('A valid phone number is required')
  const row = {
    id: uid('d'),
    name,
    phone,
    area: String(payload.area || 'Gadhinglaj').trim(),
    vehicle: String(payload.vehicle || 'Bike').trim(),
    status: 'offline',
    deliveries: 0,
    rating: 5,
  }
  if (useSupabase('riders')) {
    const { data, error } = await sb.from('riders').insert(row).select().maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }
  memory.riders.push(row)
  return row
}

export async function deleteRider(id) {
  if (useSupabase('riders')) {
    const { error } = await sb.from('riders').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return { id, deleted: true }
  }
  const index = memory.riders.findIndex((r) => r.id === id)
  if (index === -1) throw new Error('Rider not found')
  memory.riders.splice(index, 1)
  return { id, deleted: true }
}

/* ------------------------------------------------------------------ */
/* Customers                                                          */
/* ------------------------------------------------------------------ */

export async function listCustomers() {
  if (useSupabase('customers')) {
    const { data, error } = await sb.from('customers').select('*').order('created_at', { ascending: false })
    if (error) {
      if (isMissingTableError(error)) return degradeForMissingTable('customers', error, [])
      throw new Error(error.message)
    }
    return data
  }
  return [...memory.customers].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

export async function getCustomerByPhone(phone) {
  const clean = String(phone || '').trim()
  if (!clean) return null
  if (useSupabase('customers')) {
    const { data, error } = await sb.from('customers').select('*').eq('phone', clean).maybeSingle()
    if (error) return null
    return data
  }
  return memory.customers.find((c) => c.phone === clean) || null
}

export async function getCustomer(id) {
  if (useSupabase('customers')) {
    const { data, error } = await sb.from('customers').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }
  return memory.customers.find((c) => c.id === id) || null
}

export async function updateCustomer(id, patch) {
  const clean = {}
  if (patch.is_blocked !== undefined) clean.is_blocked = Boolean(patch.is_blocked)
  if (patch.name !== undefined) clean.name = String(patch.name).trim()
  if (patch.address !== undefined) clean.address = String(patch.address).trim()
  if (!Object.keys(clean).length) throw new Error('Nothing to update')

  if (useSupabase('customers')) {
    const { data, error } = await sb.from('customers').update(clean).eq('id', id).select().maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Customer not found')
    return data
  }
  const customer = memory.customers.find((c) => c.id === id)
  if (!customer) throw new Error('Customer not found')
  Object.assign(customer, clean)
  return customer
}

export async function deleteCustomer(id) {
  if (useSupabase('customers')) {
    const { error } = await sb.from('customers').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return { id, deleted: true }
  }
  const index = memory.customers.findIndex((c) => c.id === id)
  if (index === -1) throw new Error('Customer not found')
  memory.customers.splice(index, 1)
  return { id, deleted: true }
}

/* ------------------------------------------------------------------ */
/* Meta                                                               */
/* ------------------------------------------------------------------ */

export function listCategories() {
  return categories
}

export async function stats() {
  const [restaurants, riders, customers, orders] = await Promise.all([
    listRestaurants(),
    listRiders(),
    listCustomers(),
    listOrders(),
  ])
  const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status))
  const revenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total || 0), 0)

  return {
    restaurants: restaurants.length,
    open_restaurants: restaurants.filter((r) => r.is_open).length,
    riders: riders.length,
    online_riders: riders.filter((r) => r.status !== 'offline').length,
    customers: customers.length,
    orders: orders.length,
    active_orders: active.length,
    delivered_orders: orders.filter((o) => o.status === 'delivered').length,
    revenue,
  }
}
