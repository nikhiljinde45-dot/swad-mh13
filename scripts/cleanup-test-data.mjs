/**
 * Removes test accounts created by scripts/e2e-check.mjs and by diagnostics.
 * Only touches @example.com addresses with a qa./diag. prefix, so real users of
 * the restaurant are never affected.
 *
 * Run: node scripts/cleanup-test-data.mjs
 */
import { sb, configured } from '../server/supabase.js'

if (!configured) {
  console.log('Supabase is not configured in this environment')
  process.exit(0)
}

const isTestAccount = (email) => /^(qa|diag)[.-]/i.test(email || '') && /@example\.com$/i.test(email || '')

let page = 1
const users = []
for (;;) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
  if (error) {
    console.log('listUsers failed:', error.message)
    process.exit(1)
  }
  users.push(...data.users)
  if (data.users.length < 200) break
  page += 1
}

const targets = users.filter((user) => isTestAccount(user.email))
console.log(`found ${targets.length} test account(s) of ${users.length} total`)

for (const user of targets) {
  const { data: restaurants } = await sb.from('restaurants').select('id').eq('owner_user_id', user.id)
  for (const restaurant of restaurants ?? []) {
    await sb.from('menu_items').delete().eq('restaurant_id', restaurant.id)
    await sb.from('restaurants').delete().eq('id', restaurant.id)
  }
  await sb.from('profiles').delete().eq('id', user.id)
  const { error } = await sb.auth.admin.deleteUser(user.id)
  console.log(`removed ${user.email}${error ? ` (auth delete failed: ${error.message})` : ''}`)
}

const leftovers = await sb.from('restaurants').select('id, name, owner_user_id').like('name', 'Diag%')
for (const row of leftovers.data ?? []) {
  await sb.from('menu_items').delete().eq('restaurant_id', row.id)
  await sb.from('restaurants').delete().eq('id', row.id)
  console.log(`removed stray restaurant ${row.name}`)
}

console.log('cleanup complete')
