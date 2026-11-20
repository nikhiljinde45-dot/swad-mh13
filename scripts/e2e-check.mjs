/**
 * End-to-end regression check for Swad MH13 against the real Supabase project.
 *
 * It starts the production server, then drives the public HTTP API exactly like
 * the browser does: register → session → logout → login → restaurant creation →
 * menu create/edit/delete → role isolation. Test rows are removed at the end.
 *
 * Run: node scripts/e2e-check.mjs
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { sb, configured } from '../server/supabase.js'

const PORT = Number(process.env.E2E_PORT || 3311)
const BASE = `http://127.0.0.1:${PORT}`
const stamp = Date.now().toString(36)
const CUSTOMER = { email: `qa.customer.${stamp}@example.com`, password: 'SwadTest!2026' }
const OWNER = { email: `qa.owner.${stamp}@example.com`, password: 'SwadTest!2026' }

const results = []
let failures = 0

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/** Minimal cookie jar: the API authenticates with an httpOnly cookie. */
function makeClient() {
  let cookie = ''
  return {
    get cookie() {
      return cookie
    },
    async call(path, { method = 'GET', body } = {}) {
      const response = await fetch(BASE + path, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const setCookie = response.headers.getSetCookie?.() ?? []
      for (const raw of setCookie) {
        const pair = raw.split(';')[0]
        if (pair.startsWith('swad_session=')) cookie = pair
      }
      const text = await response.text()
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = { raw: text.slice(0, 200) }
      }
      return { status: response.status, json }
    },
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`)
      if (response.ok) return true
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  return false
}

const created = { users: [], restaurants: [], menuItems: [], orders: [] }

async function cleanup() {
  if (!configured) return
  try {
    for (const id of created.menuItems) await sb.from('menu_items').delete().eq('id', id)
    for (const id of created.orders) {
      await sb.from('order_items').delete().eq('order_id', id)
      await sb.from('orders').delete().eq('id', id)
    }
    for (const id of created.restaurants) await sb.from('restaurants').delete().eq('id', id)
    for (const id of created.users) {
      await sb.from('profiles').delete().eq('id', id)
      await sb.auth.admin.deleteUser(id)
    }
  } catch (error) {
    console.log(`cleanup warning: ${error.message}`)
  }
}

async function main() {
  if (!configured) {
    console.log('SKIP  SUPABASE_URL / SUPABASE_SECRET_KEY are not set in this environment')
    process.exit(0)
  }

  const server = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const serverLog = []
  server.stdout.on('data', (chunk) => serverLog.push(chunk.toString()))
  server.stderr.on('data', (chunk) => serverLog.push(chunk.toString()))

  try {
    if (!(await waitForServer())) {
      console.log('FAIL  server did not start')
      console.log(serverLog.join('').slice(-2000))
      process.exit(1)
    }
    check('server starts and /api/health responds', true)

    const guest = makeClient()
    const health = await guest.call('/api/config')
    check('Supabase is configured on the server', health.json?.supabase_configured === true)

    const publicList = await guest.call('/api/restaurants')
    check(
      'public restaurant list loads from Supabase',
      publicList.status === 200 && Array.isArray(publicList.json?.restaurants),
      `${publicList.status}, ${publicList.json?.restaurants?.length ?? 0} rows`,
    )

    /* ---------------- customer registration + session ---------------- */
    const customer = makeClient()
    const reg = await customer.call('/api/auth/register', {
      method: 'POST',
      body: { ...CUSTOMER, full_name: 'QA Customer', phone: '9876543210', role: 'customer' },
    })
    check('customer registration succeeds', reg.status === 201, `${reg.status} ${reg.json?.error ?? ''}`)
    if (reg.json?.user?.id) created.users.push(reg.json.user.id)
    check('new customer is signed in immediately', reg.json?.user?.role === 'customer')
    check('session cookie was issued', customer.cookie.startsWith('swad_session='))

    const me = await customer.call('/api/auth/me')
    check('session persists on /api/auth/me', me.status === 200 && me.json?.user?.email === CUSTOMER.email)

    const adminAttempt = await makeClient().call('/api/auth/register', {
      method: 'POST',
      body: {
        email: `qa.admin.${stamp}@example.com`,
        password: 'SwadTest!2026',
        full_name: 'Sneaky Admin',
        phone: '9876543211',
        role: 'admin',
      },
    })
    check('nobody can self-register as admin', adminAttempt.status === 400, `${adminAttempt.status}`)

    const customerOnOwnerApi = await customer.call('/api/owner/menu')
    check('customer is blocked from owner APIs', customerOnOwnerApi.status === 403, `${customerOnOwnerApi.status}`)
    const customerOnAdminApi = await customer.call('/api/admin/overview')
    check('customer is blocked from admin APIs', customerOnAdminApi.status === 403, `${customerOnAdminApi.status}`)

    const logout = await customer.call('/api/auth/logout', { method: 'POST' })
    check('logout succeeds', logout.status === 200, `${logout.status}`)
    const afterLogout = await customer.call('/api/auth/me')
    check(
      'session is cleared after logout',
      afterLogout.json?.user == null && afterLogout.json?.profile == null,
      `user=${JSON.stringify(afterLogout.json?.user)}`,
    )

    const wrongPassword = await makeClient().call('/api/auth/login', {
      method: 'POST',
      body: { email: CUSTOMER.email, password: 'not-the-password' },
    })
    check('wrong password is rejected with a clear error', wrongPassword.status === 401)

    const login = await customer.call('/api/auth/login', {
      method: 'POST',
      body: CUSTOMER,
    })
    check('customer can log back in', login.status === 200 && login.json?.user?.role === 'customer')

    /* ---------------- owner registration + restaurant ---------------- */
    const owner = makeClient()
    const ownerReg = await owner.call('/api/auth/register', {
      method: 'POST',
      body: {
        ...OWNER,
        full_name: 'QA Owner',
        phone: '9876543212',
        role: 'restaurant_owner',
        restaurant: {
          name: `QA Kitchen ${stamp}`,
          description: 'Automated test kitchen',
          address: '12 Test Road, Nashik',
          city: 'Nashik',
          pincode: '422001',
          image_url: '',
        },
      },
    })
    check('restaurant partner registration succeeds', ownerReg.status === 201, `${ownerReg.status} ${ownerReg.json?.error ?? ''}`)
    if (ownerReg.json?.user?.id) created.users.push(ownerReg.json.user.id)
    const restaurant = ownerReg.json?.restaurant
    if (restaurant?.id) created.restaurants.push(restaurant.id)
    check('restaurant row is created', Boolean(restaurant?.id))
    check('restaurant starts unapproved (is_active = false)', restaurant?.is_active === false)
    check('restaurant is linked to the owner account', Boolean(restaurant?.id) && restaurant.owner_user_id === ownerReg.json?.user?.id)

    const ownerRestaurant = await owner.call('/api/owner/restaurant')
    check(
      'owner sees exactly their own restaurant',
      ownerRestaurant.status === 200 && ownerRestaurant.json?.restaurant?.id === restaurant?.id,
    )

    const hidden = await makeClient().call('/api/restaurants')
    const visibleIds = (hidden.json?.restaurants ?? []).map((row) => row.id)
    check('unapproved restaurant stays hidden from customers', !visibleIds.includes(restaurant?.id))

    /* ---------------- menu management ---------------- */
    const item = await owner.call('/api/owner/menu-items', {
      method: 'POST',
      body: { name: 'QA Misal Pav', description: 'Test dish', price: 120, is_available: true },
    })
    check('owner can add a menu item', item.status === 201, `${item.status} ${item.json?.error ?? ''}`)
    const itemId = item.json?.item?.id
    if (itemId) created.menuItems.push(itemId)
    check('menu item stores the owner price', Number(item.json?.item?.price) === 120)

    const edited = await owner.call(`/api/owner/menu-items/${itemId}`, {
      method: 'PATCH',
      body: { price: 150, is_available: false },
    })
    check('owner can edit price and availability', edited.status === 200 && Number(edited.json?.item?.price) === 150)

    const menu = await owner.call('/api/owner/menu')
    check('owner menu lists the new item', (menu.json?.menu ?? []).some((row) => row.id === itemId))

    const otherOwner = makeClient()
    const otherReg = await otherOwner.call('/api/auth/register', {
      method: 'POST',
      body: {
        email: `qa.other.${stamp}@example.com`,
        password: 'SwadTest!2026',
        full_name: 'QA Other Owner',
        phone: '9876543213',
        role: 'restaurant_owner',
        restaurant: {
          name: `QA Other Kitchen ${stamp}`,
          description: 'Second test kitchen',
          address: '99 Other Street, Nashik',
          city: 'Nashik',
          pincode: '422002',
          image_url: '',
        },
      },
    })
    if (otherReg.json?.user?.id) created.users.push(otherReg.json.user.id)
    if (otherReg.json?.restaurant?.id) created.restaurants.push(otherReg.json.restaurant.id)

    const crossEdit = await otherOwner.call(`/api/owner/menu-items/${itemId}`, {
      method: 'PATCH',
      body: { price: 1 },
    })
    check("one owner cannot edit another owner's menu item", crossEdit.status === 404, `${crossEdit.status}`)

    const deleted = await owner.call(`/api/owner/menu-items/${itemId}`, { method: 'DELETE' })
    check('owner can delete a menu item', deleted.status === 200)

    const guestOrder = await makeClient().call('/api/orders', {
      method: 'POST',
      body: { restaurant_id: restaurant?.id, items: [{ menu_item_id: itemId, quantity: 1 }] },
    })
    check('ordering requires a signed-in customer', guestOrder.status === 401, `${guestOrder.status}`)
  } finally {
    await cleanup()
    server.kill('SIGTERM')
    if (failures > 0) {
      console.log('\n--- server log ---')
      console.log(serverLog.join('').slice(-3000) || '(empty)')
    }
  }

  console.log(`\n${results.length - failures}/${results.length} checks passed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
