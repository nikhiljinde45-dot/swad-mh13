import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  sb,
  configured,
  SUPABASE_URL,
  BUCKET,
  COOKIE_NAME,
  clearCookie,
  resolveSession,
  startSession,
  loadProfile,
  readCookie,
  decodeSession,
  revokeSession,
} from './supabase.js'
import { availableColumns, pick, ORDER_COLUMNS, RESTAURANT_COLUMNS, MENU_COLUMNS, PROFILE_COLUMNS } from './schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3000)

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '8mb' }))

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message)
}

/* --------------------------- validation --------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const clean = (value) => (typeof value === 'string' ? value.trim() : '')
const number = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const requireText = (value, label, { min = 1, max = 400 } = {}) => {
  const text = clean(value)
  if (text.length < min) fail(400, `${label} is required`)
  if (text.length > max) fail(400, `${label} is too long`)
  return text
}

const ORDER_STATUSES = [
  'placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'rejected',
]

const OWNER_TRANSITIONS = {
  placed: ['accepted', 'rejected'],
  accepted: ['preparing'],
  preparing: ['ready'],
  ready: ['out_for_delivery'],
}
const RIDER_TRANSITIONS = {
  ready: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
}

/* ----------------------------- auth ------------------------------- */

const requireAuth = (...roles) =>
  wrap(async (req, res, next) => {
    if (!configured) fail(503, 'Supabase is not configured on the server')
    const session = await resolveSession(req, res)
    if (!session) fail(401, 'Please sign in to continue')
    if (session.profile.is_blocked) fail(403, 'This account has been suspended')
    if (roles.length && !roles.includes(session.profile.role)) {
      fail(403, 'Your account does not have access to this area')
    }
    req.auth = session
    next()
  })

const shapeUser = (user, profile) => ({
  id: user.id,
  email: user.email ?? profile?.email ?? '',
  full_name: profile?.full_name ?? '',
  phone: profile?.phone ?? '',
  role: profile?.role ?? 'customer',
})

/* ------------------------------ meta ------------------------------ */

const SCHEMA_EXPECTATIONS = {
  profiles: ['id', 'full_name', 'phone', 'email', 'role', 'is_blocked'],
  restaurants: ['id', 'owner_user_id', 'name', 'description', 'image_url', 'address', 'city', 'pincode', 'owner_name', 'owner_phone', 'is_active', 'rejection_reason', 'delivery_fee'],
  categories: ['id', 'name', 'image_url'],
  menu_items: ['id', 'restaurant_id', 'category_id', 'name', 'description', 'price', 'image_url', 'is_available', 'is_veg'],
  addresses: ['id', 'user_id', 'full_address', 'city', 'pincode'],
  orders: ['id', 'user_id', 'restaurant_id', 'address_id', 'total_amount', 'subtotal', 'delivery_fee', 'order_status', 'payment_status', 'payment_method', 'delivery_address', 'notes', 'rider_id', 'created_at'],
  order_items: ['id', 'order_id', 'menu_item_id', 'item_name', 'quantity', 'unit_price'],
}

let setupCache = { at: 0, value: null }

async function setupReport() {
  if (setupCache.value && Date.now() - setupCache.at < 60_000) return setupCache.value
  const missing = []
  if (!configured) {
    missing.push('SUPABASE_URL / SUPABASE_SECRET_KEY environment variables')
  } else {
    for (const [table, wanted] of Object.entries(SCHEMA_EXPECTATIONS)) {
      const present = await availableColumns(table, wanted)
      const absent = wanted.filter((column) => !present.includes(column))
      if (absent.length) missing.push(`${table}: ${absent.join(', ')}`)
    }
  }
  const value = { ready: missing.length === 0, missing }
  setupCache = { at: Date.now(), value }
  return value
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'Swad MH13', supabase: configured, time: new Date().toISOString() })
})

app.get('/api/config', wrap(async (_req, res) => {
  res.json({
    app: 'Swad MH13',
    supabase_url: SUPABASE_URL || null,
    supabase_configured: configured,
    storage_bucket: BUCKET,
    statuses: ORDER_STATUSES,
    setup: await setupReport(),
  })
}))

/* --------------------------- public data -------------------------- */

app.get('/api/categories', wrap(async (_req, res) => {
  if (!configured) fail(503, 'Supabase is not configured on the server')
  const { data, error } = await sb.from('categories').select('id, name, image_url').order('name')
  if (error) fail(500, error.message)
  res.json({ categories: data ?? [] })
}))

app.get('/api/restaurants', wrap(async (req, res) => {
  if (!configured) fail(503, 'Supabase is not configured on the server')
  const search = clean(req.query.search)
  const category = clean(req.query.category)

  let query = sb
    .from('restaurants')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (search) query = query.ilike('name', `%${search}%`)

  const { data: restaurants, error } = await query
  if (error) fail(500, error.message)

  let list = restaurants ?? []

  if (category && list.length) {
    const { data: rows, error: menuError } = await sb
      .from('menu_items')
      .select('restaurant_id')
      .eq('category_id', category)
    if (menuError) fail(500, menuError.message)
    const allowed = new Set((rows ?? []).map((row) => row.restaurant_id))
    list = list.filter((restaurant) => allowed.has(restaurant.id))
  }

  // menu sizes in one round trip
  if (list.length) {
    const { data: items } = await sb
      .from('menu_items')
      .select('restaurant_id')
      .in('restaurant_id', list.map((restaurant) => restaurant.id))
    const counts = new Map()
    for (const item of items ?? []) {
      counts.set(item.restaurant_id, (counts.get(item.restaurant_id) ?? 0) + 1)
    }
    list = list.map((restaurant) => ({ ...restaurant, menu_count: counts.get(restaurant.id) ?? 0 }))
  }

  res.json({ restaurants: list })
}))

app.get('/api/restaurants/:id', wrap(async (req, res) => {
  if (!configured) fail(503, 'Supabase is not configured on the server')
  const { data: restaurant, error } = await sb
    .from('restaurants')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle()
  if (error) fail(500, error.message)
  if (!restaurant || !restaurant.is_active) fail(404, 'Restaurant not found')

  const { data: menu, error: menuError } = await sb
    .from('menu_items')
    .select('*, categories (name)')
    .eq('restaurant_id', restaurant.id)
    .order('name')
  if (menuError) fail(500, menuError.message)

  res.json({ restaurant, menu: menu ?? [] })
}))

/* ----------------------------- auth ------------------------------- */

app.post('/api/auth/register', wrap(async (req, res) => {
  if (!configured) fail(503, 'Supabase is not configured on the server')
  const body = req.body || {}
  const email = requireText(body.email, 'Email', { max: 200 }).toLowerCase()
  if (!EMAIL_RE.test(email)) fail(400, 'Enter a valid email address')
  const password = clean(body.password)
  if (password.length < 8) fail(400, 'Password must be at least 8 characters')
  const fullName = requireText(body.full_name, 'Full name', { min: 2, max: 120 })
  const phone = requireText(body.phone, 'Phone number', { min: 10, max: 15 })

  // Admin is deliberately impossible here: it can only be granted in SQL.
  const role = clean(body.role) || 'customer'
  if (!['customer', 'restaurant_owner', 'rider'].includes(role)) {
    fail(400, 'Choose customer, restaurant partner or rider')
  }

  const { data: created, error: createError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, role },
  })
  if (createError) {
    const message = /already|registered|exists/i.test(createError.message)
      ? 'An account with this email already exists'
      : createError.message
    fail(400, message)
  }

  const userId = created.user.id
  const profileCols = await availableColumns('profiles', PROFILE_COLUMNS)
  const { error: profileError } = await sb.from('profiles').upsert(
    pick({ id: userId, full_name: fullName, phone, email, role }, profileCols),
    { onConflict: 'id' },
  )
  if (profileError) fail(500, `Could not create profile: ${profileError.message}`)

  let restaurant = null
  if (role === 'restaurant_owner' && body.restaurant) {
    const r = body.restaurant
    const restaurantCols = await availableColumns('restaurants', RESTAURANT_COLUMNS)
    const { data, error } = await sb
      .from('restaurants')
      .insert(
        pick(
          {
            owner_user_id: userId,
            name: requireText(r.name, 'Restaurant name', { min: 2, max: 120 }),
            description: clean(r.description),
            address: requireText(r.address, 'Restaurant address', { min: 5 }),
            city: clean(r.city),
            pincode: clean(r.pincode),
            owner_name: fullName,
            owner_phone: phone,
            image_url: clean(r.image_url) || null,
            is_active: false,
          },
          restaurantCols,
        ),
      )
      .select()
      .single()
    if (error) fail(500, `Could not save restaurant: ${error.message}`)
    restaurant = data
  }

  const user = await startSession(req, res, email, password)
  const profile = await loadProfile(user.id)
  res.status(201).json({ user: shapeUser(user, profile), profile, restaurant })
}))

app.post('/api/auth/login', wrap(async (req, res) => {
  if (!configured) fail(503, 'Supabase is not configured on the server')
  const email = requireText(req.body?.email, 'Email').toLowerCase()
  const password = clean(req.body?.password)
  if (!password) fail(400, 'Password is required')

  const user = await startSession(req, res, email, password)
  const profile = await loadProfile(user.id)
  if (!profile) fail(403, 'This account has no profile. Contact support.')
  if (profile.is_blocked) {
    clearCookie(req, res, COOKIE_NAME)
    fail(403, 'This account has been suspended')
  }
  res.json({ user: shapeUser(user, profile), profile })
}))

app.post('/api/auth/logout', wrap(async (req, res) => {
  // Invalidate server-side, not just in the browser: the httpOnly cookie is a
  // stateless JWT that would otherwise keep working until it expired.
  const raw = readCookie(req, COOKIE_NAME)
  const tokens = raw ? decodeSession(raw) : null
  revokeSession(tokens?.at)
  if (tokens?.at) {
    try {
      await sb.auth.admin.signOut(tokens.at)
    } catch {
      /* the local revocation above is authoritative for this server */
    }
  }
  clearCookie(req, res, COOKIE_NAME)
  res.json({ ok: true })
}))

app.get('/api/auth/me', wrap(async (req, res) => {
  if (!configured) fail(503, 'Supabase is not configured on the server')
  const session = await resolveSession(req, res)
  if (!session) return res.json({ user: null, profile: null })
  if (session.profile.is_blocked) fail(403, 'This account has been suspended')
  res.json({ user: shapeUser(session.user, session.profile), profile: session.profile })
}))

app.post('/api/auth/forgot-password', wrap(async (req, res) => {
  if (!configured) fail(503, 'Supabase is not configured on the server')
  const email = requireText(req.body?.email, 'Email').toLowerCase()
  if (!EMAIL_RE.test(email)) fail(400, 'Enter a valid email address')
  const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'localhost'}`
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  })
  if (error && !/not found|does not exist/i.test(error.message)) fail(500, error.message)
  // Always answer the same way so the endpoint cannot be used to enumerate accounts.
  res.json({ ok: true, message: 'If that email has an account, a reset link is on its way.' })
}))

// Completes the emailed reset link: the recovery token itself proves identity, so
// the new password is written for the verified user only.
app.post('/api/auth/reset-password', wrap(async (req, res) => {
  if (!configured) fail(503, 'Supabase is not configured on the server')
  const accessToken = clean(req.body?.access_token)
  const password = clean(req.body?.password)
  if (!accessToken) fail(400, 'This reset link is missing its token')
  if (password.length < 8) fail(400, 'Password must be at least 8 characters')

  const { data, error } = await sb.auth.getUser(accessToken)
  if (error || !data?.user) fail(401, 'This reset link is invalid or has expired')

  const { error: updateError } = await sb.auth.admin.updateUserById(data.user.id, { password })
  if (updateError) fail(400, updateError.message)
  res.json({ ok: true })
}))

app.post('/api/auth/password', requireAuth(), wrap(async (req, res) => {
  const password = clean(req.body?.password)
  if (password.length < 8) fail(400, 'Password must be at least 8 characters')
  const { error } = await sb.auth.admin.updateUserById(req.auth.user.id, { password })
  if (error) fail(400, error.message)
  res.json({ ok: true })
}))

/* --------------------------- addresses ---------------------------- */

app.get('/api/addresses', requireAuth('customer', 'admin'), wrap(async (req, res) => {
  const { data, error } = await sb
    .from('addresses')
    .select('id, user_id, full_address, city, pincode, created_at')
    .eq('user_id', req.auth.user.id)
    .order('created_at', { ascending: false })
  if (error) fail(500, error.message)
  res.json({ addresses: data ?? [] })
}))

app.post('/api/addresses', requireAuth('customer', 'admin'), wrap(async (req, res) => {
  const payload = {
    user_id: req.auth.user.id,
    full_address: requireText(req.body?.full_address, 'Delivery address', { min: 6, max: 300 }),
    city: requireText(req.body?.city, 'City', { min: 2, max: 80 }),
    pincode: requireText(req.body?.pincode, 'PIN code', { min: 4, max: 10 }),
  }
  const { data, error } = await sb.from('addresses').insert(payload).select().single()
  if (error) fail(500, error.message)
  res.status(201).json({ address: data })
}))

app.delete('/api/addresses/:id', requireAuth('customer', 'admin'), wrap(async (req, res) => {
  const { error } = await sb
    .from('addresses')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.auth.user.id)
  if (error) fail(500, error.message)
  res.json({ ok: true })
}))

/* ----------------------------- orders ----------------------------- */

async function orderRows(orders) {
  if (!orders.length) return []
  const ids = [...new Set(orders.map((order) => order.user_id).filter(Boolean))]
  if (!ids.length) return orders
  const { data: people } = await sb.from('profiles').select('id, full_name, phone').in('id', ids)
  const byId = new Map((people ?? []).map((person) => [person.id, person]))
  return orders.map((order) => ({
    ...order,
    customer: byId.get(order.user_id) ?? null,
  }))
}

const ORDER_SELECT =
  '*, restaurants (id, name, image_url, address), order_items (*)'

app.get('/api/orders', requireAuth(), wrap(async (req, res) => {
  const { user, profile } = req.auth
  let query = sb.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false })

  if (profile.role === 'customer') {
    query = query.eq('user_id', user.id)
  } else if (profile.role === 'rider') {
    query = query.eq('rider_id', user.id)
  } else if (profile.role === 'restaurant_owner') {
    const { data: owned } = await sb.from('restaurants').select('id').eq('owner_user_id', user.id)
    const ids = (owned ?? []).map((restaurant) => restaurant.id)
    if (!ids.length) return res.json({ orders: [] })
    query = query.in('restaurant_id', ids)
  }

  const { data, error } = await query
  if (error) fail(500, error.message)
  res.json({ orders: await orderRows(data ?? []) })
}))

app.get('/api/orders/:id', requireAuth(), wrap(async (req, res) => {
  const { data: order, error } = await sb
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', req.params.id)
    .maybeSingle()
  if (error) fail(500, error.message)
  if (!order) fail(404, 'Order not found')

  const { user, profile } = req.auth
  let allowed = profile.role === 'admin' || order.user_id === user.id || order.rider_id === user.id
  if (!allowed && profile.role === 'restaurant_owner') {
    const { data: owned } = await sb
      .from('restaurants')
      .select('id')
      .eq('id', order.restaurant_id)
      .eq('owner_user_id', user.id)
      .maybeSingle()
    allowed = Boolean(owned)
  }
  if (!allowed) fail(403, 'You cannot view this order')

  res.json({ order })
}))

app.post('/api/orders', requireAuth('customer', 'admin'), wrap(async (req, res) => {
  const body = req.body || {}
  const restaurantId = requireText(body.restaurant_id, 'Restaurant')
  const rawItems = Array.isArray(body.items) ? body.items : []
  if (!rawItems.length) fail(400, 'Your cart is empty')
  if (rawItems.length > 40) fail(400, 'Too many different items in one order')

  const paymentMethod = clean(body.payment_method) === 'upi' ? 'upi' : 'cod'
  const notes = clean(body.notes).slice(0, 400)

  const { data: restaurant, error: restaurantError } = await sb
    .from('restaurants')
    .select('id, name, delivery_fee, is_active')
    .eq('id', restaurantId)
    .maybeSingle()
  if (restaurantError) fail(500, restaurantError.message)
  if (!restaurant || !restaurant.is_active) fail(400, 'This restaurant is not accepting orders')

  const wanted = new Map()
  for (const item of rawItems) {
    const id = clean(item?.menu_item_id)
    const qty = Math.floor(number(item?.quantity, 0))
    if (!id) fail(400, 'Invalid cart item')
    if (qty < 1 || qty > 20) fail(400, 'Each item needs a quantity between 1 and 20')
    wanted.set(id, (wanted.get(id) ?? 0) + qty)
  }

  const { data: menuItems, error: menuError } = await sb
    .from('menu_items')
    .select('id, name, price, is_available, restaurant_id')
    .in('id', [...wanted.keys()])
  if (menuError) fail(500, menuError.message)

  const priced = []
  for (const [id, quantity] of wanted) {
    const item = (menuItems ?? []).find((row) => row.id === id)
    if (!item) fail(400, 'One of the items is no longer on the menu')
    if (item.restaurant_id !== restaurant.id) fail(400, 'Items must come from one restaurant')
    if (!item.is_available) fail(400, `${item.name} is currently unavailable`)
    // Prices always come from the database, never from the browser.
    priced.push({ menu_item_id: item.id, item_name: item.name, unit_price: number(item.price), quantity })
  }

  const subtotal = priced.reduce((sum, line) => sum + line.unit_price * line.quantity, 0)
  const deliveryFee = number(restaurant.delivery_fee, 25)
  const total = subtotal + deliveryFee

  let addressId = clean(body.address_id) || null
  let deliveryAddress = ''

  if (addressId) {
    const { data: address } = await sb
      .from('addresses')
      .select('id, user_id, full_address, city, pincode')
      .eq('id', addressId)
      .eq('user_id', req.auth.user.id)
      .maybeSingle()
    if (!address) fail(400, 'That delivery address was not found')
    deliveryAddress = `${address.full_address}, ${address.city} ${address.pincode}`.trim()
  } else {
    const fullAddress = requireText(body.full_address, 'Delivery address', { min: 6, max: 300 })
    const city = requireText(body.city, 'City', { min: 2, max: 80 })
    const pincode = requireText(body.pincode, 'PIN code', { min: 4, max: 10 })
    const { data: address, error: addressError } = await sb
      .from('addresses')
      .insert({ user_id: req.auth.user.id, full_address: fullAddress, city, pincode })
      .select()
      .single()
    if (addressError) fail(500, `Could not save address: ${addressError.message}`)
    addressId = address.id
    deliveryAddress = `${fullAddress}, ${city} ${pincode}`
  }

  const orderCols = await availableColumns('orders', ORDER_COLUMNS)
  const orderPayload = pick({
    user_id: req.auth.user.id,
    restaurant_id: restaurant.id,
    address_id: addressId,
    total_amount: total,
    subtotal,
    delivery_fee: deliveryFee,
    order_status: 'placed',
    payment_status: 'pending',
    payment_method: paymentMethod,
    delivery_address: deliveryAddress,
    notes: notes || null,
  }, orderCols)

  const { data: order, error: orderError } = await sb
    .from('orders')
    .insert(orderPayload)
    .select()
    .single()
  if (orderError) fail(500, `Could not place order: ${orderError.message}`)

  const { error: itemsError } = await sb.from('order_items').insert(
    priced.map((line) => ({ order_id: order.id, ...line })),
  )
  if (itemsError) fail(500, `Could not save order items: ${itemsError.message}`)

  res.status(201).json({ order: { ...order, order_items: priced } })
}))

/* ------------------------------ owner ----------------------------- */

async function ownedRestaurant(userId) {
  const { data, error } = await sb
    .from('restaurants')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (error) fail(500, error.message)
  return data
}

app.get('/api/owner/restaurant', requireAuth('restaurant_owner', 'admin'), wrap(async (req, res) => {
  const restaurant = await ownedRestaurant(req.auth.user.id)
  if (!restaurant) return res.json({ restaurant: null, menu: [], categories: [] })

  const [{ data: menu }, { data: categories }] = await Promise.all([
    sb.from('menu_items')
      .select('*, categories (name)')
      .eq('restaurant_id', restaurant.id)
      .order('name'),
    sb.from('categories').select('id, name').order('name'),
  ])

  res.json({ restaurant, menu: menu ?? [], categories: categories ?? [] })
}))

app.post('/api/owner/restaurant', requireAuth('restaurant_owner', 'admin'), wrap(async (req, res) => {
  const existing = await ownedRestaurant(req.auth.user.id)
  if (existing) fail(400, 'You already registered a restaurant')

  const body = req.body || {}
  const payload = {
    owner_user_id: req.auth.user.id,
    name: requireText(body.name, 'Restaurant name', { min: 2, max: 120 }),
    description: clean(body.description).slice(0, 600),
    address: requireText(body.address, 'Restaurant address', { min: 5, max: 300 }),
    city: requireText(body.city, 'City', { min: 2, max: 80 }),
    pincode: requireText(body.pincode, 'PIN code', { min: 4, max: 10 }),
    owner_name: requireText(body.owner_name || req.auth.profile.full_name, 'Owner name', { min: 2, max: 120 }),
    owner_phone: requireText(body.owner_phone || req.auth.profile.phone, 'Owner phone', { min: 10, max: 15 }),
    image_url: clean(body.image_url) || null,
    is_active: false,
  }

  const restaurantCols = await availableColumns('restaurants', RESTAURANT_COLUMNS)
  const { data, error } = await sb
    .from('restaurants')
    .insert(pick(payload, restaurantCols))
    .select()
    .single()
  if (error) fail(500, error.message)
  res.status(201).json({ restaurant: data })
}))

app.patch('/api/owner/restaurant', requireAuth('restaurant_owner', 'admin'), wrap(async (req, res) => {
  const restaurant = await ownedRestaurant(req.auth.user.id)
  if (!restaurant) fail(404, 'Register your restaurant first')

  const body = req.body || {}
  const patch = {}
  if (body.name !== undefined) patch.name = requireText(body.name, 'Restaurant name', { min: 2, max: 120 })
  if (body.description !== undefined) patch.description = clean(body.description).slice(0, 600)
  if (body.address !== undefined) patch.address = requireText(body.address, 'Address', { min: 5, max: 300 })
  if (body.city !== undefined) patch.city = requireText(body.city, 'City', { min: 2, max: 80 })
  if (body.pincode !== undefined) patch.pincode = requireText(body.pincode, 'PIN code', { min: 4, max: 10 })
  if (body.image_url !== undefined) patch.image_url = clean(body.image_url) || null
  if (body.delivery_fee !== undefined) patch.delivery_fee = Math.max(0, number(body.delivery_fee, 25))
  // is_active is intentionally not editable here — only an admin approves.
  if (!Object.keys(patch).length) fail(400, 'Nothing to update')
  const restaurantCols = await availableColumns('restaurants', RESTAURANT_COLUMNS)
  patch.updated_at = new Date().toISOString()

  const { data, error } = await sb
    .from('restaurants')
    .update(pick(patch, restaurantCols))
    .eq('id', restaurant.id)
    .eq('owner_user_id', req.auth.user.id)
    .select()
    .single()
  if (error) fail(500, error.message)
  res.json({ restaurant: data })
}))

app.get('/api/owner/menu', requireAuth('restaurant_owner', 'admin'), wrap(async (req, res) => {
  const restaurant = await ownedRestaurant(req.auth.user.id)
  if (!restaurant) return res.json({ menu: [] })
  const { data, error } = await sb
    .from('menu_items')
    .select('*, categories (name)')
    .eq('restaurant_id', restaurant.id)
    .order('name')
  if (error) fail(500, error.message)
  res.json({ menu: data ?? [] })
}))

function menuPayload(body) {
  const payload = {
    name: requireText(body.name, 'Item name', { min: 2, max: 120 }),
    description: clean(body.description).slice(0, 500),
    price: number(body.price, -1),
    is_available: body.is_available === undefined ? true : Boolean(body.is_available),
    is_veg: body.is_veg === undefined ? true : Boolean(body.is_veg),
  }
  if (payload.price < 0) fail(400, 'Enter a valid price')
  payload.image_url = clean(body.image_url) || null
  const categoryId = clean(body.category_id)
  payload.category_id = categoryId || null
  return payload
}

app.post('/api/owner/menu-items', requireAuth('restaurant_owner', 'admin'), wrap(async (req, res) => {
  const restaurant = await ownedRestaurant(req.auth.user.id)
  if (!restaurant) fail(400, 'Register your restaurant before adding dishes')

  const menuCols = await availableColumns('menu_items', MENU_COLUMNS)
  const { data, error } = await sb
    .from('menu_items')
    .insert(pick({ ...menuPayload(req.body || {}), restaurant_id: restaurant.id }, menuCols))
    .select('id, restaurant_id, category_id, name, description, price, image_url, is_available, is_veg')
    .single()
  if (error) fail(500, error.message)
  res.status(201).json({ item: data })
}))

async function ownMenuItem(userId, itemId) {
  const restaurant = await ownedRestaurant(userId)
  if (!restaurant) fail(404, 'Register your restaurant first')
  const { data: item } = await sb
    .from('menu_items')
    .select('id, restaurant_id')
    .eq('id', itemId)
    .maybeSingle()
  if (!item || item.restaurant_id !== restaurant.id) fail(404, 'Menu item not found')
  return item
}

app.patch('/api/owner/menu-items/:id', requireAuth('restaurant_owner', 'admin'), wrap(async (req, res) => {
  const item = await ownMenuItem(req.auth.user.id, req.params.id)
  const body = req.body || {}
  const patch = {}

  if (body.name !== undefined) patch.name = requireText(body.name, 'Item name', { min: 2, max: 120 })
  if (body.description !== undefined) patch.description = clean(body.description).slice(0, 500)
  if (body.price !== undefined) {
    const price = number(body.price, -1)
    if (price < 0) fail(400, 'Enter a valid price')
    patch.price = price
  }
  if (body.category_id !== undefined) patch.category_id = clean(body.category_id) || null
  if (body.image_url !== undefined) patch.image_url = clean(body.image_url) || null
  if (body.is_available !== undefined) patch.is_available = Boolean(body.is_available)
  if (body.is_veg !== undefined) patch.is_veg = Boolean(body.is_veg)
  if (!Object.keys(patch).length) fail(400, 'Nothing to update')
  const menuCols = await availableColumns('menu_items', MENU_COLUMNS)

  const { data, error } = await sb
    .from('menu_items')
    .update(pick(patch, menuCols))
    .eq('id', item.id)
    .select('id, restaurant_id, category_id, name, description, price, image_url, is_available, is_veg')
    .single()
  if (error) fail(500, error.message)
  res.json({ item: data })
}))

app.delete('/api/owner/menu-items/:id', requireAuth('restaurant_owner', 'admin'), wrap(async (req, res) => {
  const item = await ownMenuItem(req.auth.user.id, req.params.id)
  const { error } = await sb.from('menu_items').delete().eq('id', item.id)
  if (error) fail(500, error.message)
  res.json({ ok: true, id: item.id })
}))

app.get('/api/owner/orders', requireAuth('restaurant_owner', 'admin'), wrap(async (req, res) => {
  const restaurant = await ownedRestaurant(req.auth.user.id)
  if (!restaurant) return res.json({ orders: [] })
  const { data, error } = await sb
    .from('orders')
    .select(ORDER_SELECT)
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })
  if (error) fail(500, error.message)
  res.json({ orders: await orderRows(data ?? []) })
}))

app.patch('/api/owner/orders/:id/status', requireAuth('restaurant_owner', 'admin'), wrap(async (req, res) => {
  const restaurant = await ownedRestaurant(req.auth.user.id)
  if (!restaurant) fail(404, 'Register your restaurant first')

  const status = clean(req.body?.status)
  const { data: order } = await sb
    .from('orders')
    .select('id, restaurant_id, order_status')
    .eq('id', req.params.id)
    .maybeSingle()
  if (!order || order.restaurant_id !== restaurant.id) fail(404, 'Order not found')

  const allowed = OWNER_TRANSITIONS[order.order_status] ?? []
  if (!allowed.includes(status)) {
    fail(400, `Cannot move an order from ${order.order_status} to ${status}`)
  }

  const orderCols = await availableColumns('orders', ORDER_COLUMNS)
  const { data, error } = await sb
    .from('orders')
    .update(pick({ order_status: status, updated_at: new Date().toISOString() }, orderCols))
    .eq('id', order.id)
    .select(ORDER_SELECT)
    .single()
  if (error) fail(500, error.message)
  res.json({ order: data })
}))

/* ------------------------------ rider ----------------------------- */

app.get('/api/rider/orders', requireAuth('rider', 'admin'), wrap(async (req, res) => {
  const { data, error } = await sb
    .from('orders')
    .select(ORDER_SELECT)
    .eq('rider_id', req.auth.user.id)
    .order('created_at', { ascending: false })
  if (error) fail(500, error.message)
  res.json({ orders: await orderRows(data ?? []) })
}))

app.patch('/api/rider/orders/:id/status', requireAuth('rider', 'admin'), wrap(async (req, res) => {
  const status = clean(req.body?.status)
  const { data: order } = await sb
    .from('orders')
    .select('id, rider_id, order_status')
    .eq('id', req.params.id)
    .maybeSingle()
  if (!order || order.rider_id !== req.auth.user.id) fail(404, 'Delivery not found')

  const allowed = RIDER_TRANSITIONS[order.order_status] ?? []
  if (!allowed.includes(status)) fail(400, `Cannot move this delivery to ${status}`)

  const patch = { order_status: status, updated_at: new Date().toISOString() }
  if (status === 'delivered') patch.payment_status = 'paid'
  const orderCols = await availableColumns('orders', ORDER_COLUMNS)

  const { data, error } = await sb
    .from('orders')
    .update(pick(patch, orderCols))
    .eq('id', order.id)
    .select(ORDER_SELECT)
    .single()
  if (error) fail(500, error.message)
  res.json({ order: data })
}))

/* ------------------------------ admin ----------------------------- */

app.get('/api/admin/overview', requireAuth('admin'), wrap(async (_req, res) => {
  const [restaurants, profiles, orders, categories] = await Promise.all([
    sb.from('restaurants').select('*').order('created_at', { ascending: false }),
    sb.from('profiles').select('*').order('created_at', { ascending: false }),
    sb.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(100),
    sb.from('categories').select('id, name').order('name'),
  ])
  for (const result of [restaurants, profiles, orders, categories]) {
    if (result.error) fail(500, result.error.message)
  }

  const orderList = await orderRows(orders.data ?? [])
  const people = profiles.data ?? []

  res.json({
    restaurants: restaurants.data ?? [],
    pending: (restaurants.data ?? []).filter((restaurant) => !restaurant.is_active),
    customers: people.filter((person) => person.role === 'customer'),
    riders: people.filter((person) => person.role === 'rider'),
    owners: people.filter((person) => person.role === 'restaurant_owner'),
    admins: people.filter((person) => person.role === 'admin'),
    categories: categories.data ?? [],
    orders: orderList,
    counts: {
      restaurants: (restaurants.data ?? []).length,
      active_restaurants: (restaurants.data ?? []).filter((restaurant) => restaurant.is_active).length,
      pending: (restaurants.data ?? []).filter((restaurant) => !restaurant.is_active).length,
      customers: people.filter((person) => person.role === 'customer').length,
      riders: people.filter((person) => person.role === 'rider').length,
      orders: orderList.length,
      revenue: orderList
        .filter((order) => order.order_status === 'delivered')
        .reduce((sum, order) => sum + number(order.total_amount), 0),
    },
  })
}))

app.patch('/api/admin/restaurants/:id', requireAuth('admin'), wrap(async (req, res) => {
  const body = req.body || {}
  const patch = { updated_at: new Date().toISOString() }
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active)
  if (body.rejection_reason !== undefined) patch.rejection_reason = clean(body.rejection_reason) || null
  if (!('is_active' in patch) && !('rejection_reason' in patch)) fail(400, 'Nothing to update')

  const restaurantCols = await availableColumns('restaurants', RESTAURANT_COLUMNS)
  const { data, error } = await sb
    .from('restaurants')
    .update(pick(patch, restaurantCols))
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) fail(500, error.message)
  res.json({ restaurant: data })
}))

app.patch('/api/admin/profiles/:id', requireAuth('admin'), wrap(async (req, res) => {
  const body = req.body || {}
  const patch = {}
  if (body.role !== undefined) {
    const role = clean(body.role)
    if (!['customer', 'restaurant_owner', 'rider', 'admin'].includes(role)) fail(400, 'Unknown role')
    if (req.params.id === req.auth.user.id && role !== 'admin') {
      fail(400, 'You cannot remove your own admin access')
    }
    patch.role = role
  }
  if (body.is_blocked !== undefined) {
    if (req.params.id === req.auth.user.id) fail(400, 'You cannot block yourself')
    patch.is_blocked = Boolean(body.is_blocked)
  }
  if (!Object.keys(patch).length) fail(400, 'Nothing to update')

  const profileCols = await availableColumns('profiles', PROFILE_COLUMNS)
  const { data, error } = await sb
    .from('profiles')
    .update(pick(patch, profileCols))
    .eq('id', req.params.id)
    .select('*')
    .single()
  if (error) fail(500, error.message)
  res.json({ profile: data })
}))

app.patch('/api/admin/orders/:id/assign', requireAuth('admin'), wrap(async (req, res) => {
  const riderId = clean(req.body?.rider_id)
  if (!riderId) fail(400, 'Choose a rider')

  const { data: rider } = await sb
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', riderId)
    .maybeSingle()
  if (!rider || rider.role !== 'rider') fail(400, 'That account is not a rider')

  const orderCols = await availableColumns('orders', ORDER_COLUMNS)
  const { data, error } = await sb
    .from('orders')
    .update(pick({ rider_id: riderId, updated_at: new Date().toISOString() }, orderCols))
    .eq('id', req.params.id)
    .select(ORDER_SELECT)
    .single()
  if (error) fail(500, error.message)
  res.json({ order: data })
}))

app.post('/api/admin/categories', requireAuth('admin'), wrap(async (req, res) => {
  const name = requireText(req.body?.name, 'Category name', { min: 2, max: 60 })
  const { data, error } = await sb
    .from('categories')
    .insert({ name, image_url: clean(req.body?.image_url) || null })
    .select('id, name')
    .single()
  if (error) fail(400, error.message)
  res.status(201).json({ category: data })
}))

app.patch('/api/admin/categories/:id', requireAuth('admin'), wrap(async (req, res) => {
  const patch = {}
  if (req.body?.name !== undefined) patch.name = requireText(req.body.name, 'Category name', { min: 2, max: 60 })
  if (req.body?.image_url !== undefined) patch.image_url = clean(req.body.image_url) || null
  if (!Object.keys(patch).length) fail(400, 'Nothing to update')
  const { data, error } = await sb.from('categories').update(patch).eq('id', req.params.id).select('id, name').single()
  if (error) fail(400, error.message)
  res.json({ category: data })
}))

app.delete('/api/admin/categories/:id', requireAuth('admin'), wrap(async (req, res) => {
  const { error } = await sb.from('categories').delete().eq('id', req.params.id)
  if (error) fail(400, error.message)
  res.json({ ok: true })
}))

/* ----------------------------- uploads ---------------------------- */

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

app.post('/api/uploads', requireAuth('restaurant_owner', 'admin'), wrap(async (req, res) => {
  const dataUrl = clean(req.body?.dataUrl)
  const match = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) fail(400, 'Choose an image file')
  const [, mime, base64] = match
  const extension = IMAGE_TYPES[mime]
  if (!extension) fail(400, 'Use a JPG, PNG, WEBP or GIF image')

  const buffer = Buffer.from(base64, 'base64')
  if (buffer.byteLength > 5 * 1024 * 1024) fail(400, 'Images must be 5 MB or smaller')

  const safeName = clean(req.body?.filename).replace(/[^a-z0-9._-]/gi, '').slice(-40) || 'photo'
  const objectPath = `${req.auth.user.id}/${Date.now()}-${safeName.replace(/\.[a-z0-9]+$/i, '')}.${extension}`

  const { error } = await sb.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: mime,
    upsert: true,
    cacheControl: '3600',
  })
  if (error) fail(500, `Upload failed: ${error.message}`)

  const { data } = sb.storage.from(BUCKET).getPublicUrl(objectPath)
  res.status(201).json({ url: data.publicUrl, path: objectPath })
}))

/* ------------------------------ static ---------------------------- */

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' })
})

const distDir = path.resolve(__dirname, '..', 'dist')
app.use(express.static(distDir, { index: false, maxAge: '1h' }))

// Express 5: '/{*splat}' is the pattern that also matches '/'.
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) {
      res.status(200).type('html').send('<!doctype html><h1>Swad MH13</h1><p>Run "npm run build" first.</p>')
    }
  })
})

/* ------------------------------ errors ---------------------------- */

app.use((err, _req, res, _next) => {
  const status = err?.status || 500
  if (status >= 500) console.error('[swad-mh13]', err)
  res.status(status).json({ error: err?.message || 'Something went wrong' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[swad-mh13] listening on 0.0.0.0:${PORT} (supabase: ${configured ? 'configured' : 'MISSING'})`)
})
