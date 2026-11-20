import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as db from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3000)

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '8mb' }))

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)

/* ----------------------------- meta ----------------------------- */

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'Swad MH13', mode: db.status.mode, time: new Date().toISOString() })
})

app.get('/api/config', (_req, res) => {
  res.json({
    app: 'Swad MH13',
    mode: db.status.mode,
    supabase_url: db.status.supabaseUrl,
    supabase_configured: db.status.supabaseConfigured,
    supabase_key_missing: db.status.missingKey,
    supabase_key_kind: db.status.keyKind,
    missing_tables: db.status.missingTables,
    warning: db.status.warning,
    statuses: db.ORDER_STATUSES,
    flow: db.ORDER_FLOW,
    categories: db.listCategories(),
  })
})

/* -------------------------- restaurants ------------------------- */

app.get('/api/restaurants', wrap(async (req, res) => {
  const restaurants = await db.listRestaurants({ category: req.query.category })
  res.json({ source: db.status.mode, restaurants })
}))

app.get('/api/restaurants/:id', wrap(async (req, res) => {
  const restaurant = await db.getRestaurant(req.params.id)
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' })
  const menu = await db.listMenu(req.params.id)
  res.json({ source: db.status.mode, restaurant, menu })
}))

app.patch('/api/restaurants/:id', wrap(async (req, res) => {
  const restaurant = await db.updateRestaurant(req.params.id, req.body || {})
  res.json({ restaurant })
}))

/* --------------------------- menu items ------------------------- */

app.post('/api/menu-items', wrap(async (req, res) => {
  const item = await db.createMenuItem(req.body || {})
  res.status(201).json({ item })
}))

app.patch('/api/menu-items/:id', wrap(async (req, res) => {
  const item = await db.updateMenuItem(req.params.id, req.body || {})
  res.json({ item })
}))

app.delete('/api/menu-items/:id', wrap(async (req, res) => {
  const result = await db.deleteMenuItem(req.params.id)
  res.json(result)
}))

/* ----------------------------- orders --------------------------- */

app.get('/api/orders', wrap(async (req, res) => {
  const orders = await db.listOrders({
    customer_id: req.query.customer_id,
    restaurant_id: req.query.restaurant_id,
    rider_id: req.query.rider_id,
    status: req.query.status,
  })
  res.json({ source: db.status.mode, orders })
}))

app.get('/api/orders/:id', wrap(async (req, res) => {
  const order = await db.getOrder(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  res.json({ order })
}))

app.post('/api/orders', wrap(async (req, res) => {
  const order = await db.createOrder(req.body || {})
  res.status(201).json({ order })
}))

app.patch('/api/orders/:id', wrap(async (req, res) => {
  const order = await db.updateOrder(req.params.id, req.body || {})
  res.json({ order })
}))

/* ----------------------------- riders --------------------------- */

app.get('/api/riders', wrap(async (_req, res) => {
  const riders = await db.listRiders()
  res.json({ source: db.status.mode, riders })
}))

app.post('/api/riders', wrap(async (req, res) => {
  const rider = await db.createRider(req.body || {})
  res.status(201).json({ rider })
}))

app.patch('/api/riders/:id', wrap(async (req, res) => {
  const rider = await db.updateRider(req.params.id, req.body || {})
  res.json({ rider })
}))

app.delete('/api/riders/:id', wrap(async (req, res) => {
  const result = await db.deleteRider(req.params.id)
  res.json(result)
}))

/* --------------------------- customers -------------------------- */

app.get('/api/customers', wrap(async (_req, res) => {
  const customers = await db.listCustomers()
  res.json({ source: db.status.mode, customers })
}))

app.get('/api/customers/:id', wrap(async (req, res) => {
  const customer = await db.getCustomer(req.params.id)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  res.json({ customer })
}))

app.patch('/api/customers/:id', wrap(async (req, res) => {
  const customer = await db.updateCustomer(req.params.id, req.body || {})
  res.json({ customer })
}))

app.delete('/api/customers/:id', wrap(async (req, res) => {
  const result = await db.deleteCustomer(req.params.id)
  res.json(result)
}))

/* ----------------------------- admin ---------------------------- */

app.get('/api/admin/stats', wrap(async (_req, res) => {
  const summary = await db.stats()
  res.json({ source: db.status.mode, stats: summary })
}))

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' })
})

/* ------------------------- static client ------------------------ */

const distDir = path.resolve(__dirname, '..', 'dist')
app.use(express.static(distDir, { index: false, maxAge: '1h' }))

// SPA fallback — Express 5 requires a named wildcard, and "{*splat}" (not "/*splat")
// is what also matches the root path "/".
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(200).type('html').send('<!doctype html><h1>Swad MH13</h1><p>Run "npm run build" to generate the client bundle.</p>')
  })
})

/* --------------------------- errors ---------------------------- */

app.use((err, _req, res, _next) => {
  const message = err?.message || 'Something went wrong'
  const status = /not found/i.test(message) ? 404 : /required|valid|empty|available|closed|Cannot move|Unknown status|No updatable|Nothing to update/i.test(message) ? 400 : 500
  if (status >= 500) console.error('[swad-mh13]', err)
  res.status(status).json({ error: message })
})

await db.init()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[swad-mh13] server on http://0.0.0.0:${PORT} (data mode: ${db.status.mode})`)
})
