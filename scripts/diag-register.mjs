import { sb, configured } from '../server/supabase.js'
import { availableColumns, pick, PROFILE_COLUMNS } from '../server/schema.js'

if (!configured) process.exit(1)

console.log('availableColumns(profiles):', JSON.stringify(await availableColumns('profiles', PROFILE_COLUMNS)))

// Is this key actually privileged?
const list = await sb.auth.admin.listUsers({ page: 1, perPage: 1 })
console.log('admin.listUsers:', list.error ? `FAIL ${list.error.message}` : 'ok (service role confirmed)')

const email = `diag2.${Date.now().toString(36)}@example.com`
for (const role of ['customer', 'restaurant_owner']) {
  const created = await sb.auth.admin.createUser({
    email: `${role}.${email}`,
    password: 'SwadTest!2026',
    email_confirm: true,
    user_metadata: { full_name: 'Diag Two', phone: '9876500001', role },
  })
  if (created.error) {
    console.log(`[${role}] createUser FAIL: ${created.error.message}`)
    continue
  }
  const id = created.data.user.id

  const auto = await sb.from('profiles').select('id, role').eq('id', id)
  console.log(`[${role}] trigger-created profile:`, auto.data?.length ? JSON.stringify(auto.data[0]) : `none (err=${auto.error?.message ?? '-'})`)

  const payload = pick({ id, full_name: 'Diag Two', phone: '9876500001', email, role }, await availableColumns('profiles', PROFILE_COLUMNS))
  console.log(`[${role}] upsert payload keys:`, Object.keys(payload).join(','))

  const up = await sb.from('profiles').upsert(payload, { onConflict: 'id' })
  if (up.error) {
    console.log(`[${role}] upsert FAIL: ${up.error.message} | code=${up.error.code} details=${up.error.details} hint=${up.error.hint}`)
  } else {
    console.log(`[${role}] upsert OK`)
  }

  const after = await sb.from('profiles').select('id, role, full_name').eq('id', id)
  console.log(`[${role}] row after upsert:`, JSON.stringify(after.data ?? after.error?.message))

  await sb.from('profiles').delete().eq('id', id)
  await sb.auth.admin.deleteUser(id)
}
