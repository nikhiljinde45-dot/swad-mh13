import { sb, configured } from '../server/supabase.js'

if (!configured) process.exit(1)

const created = await sb.auth.admin.createUser({
  email: `diag.roles.${Date.now().toString(36)}@example.com`,
  password: 'SwadTest!2026',
  email_confirm: true,
  user_metadata: { full_name: 'Role Probe' },
})
if (created.error) {
  console.log('createUser failed:', created.error.message)
  process.exit(1)
}
const id = created.data.user.id

for (const role of ['customer', 'rider', 'admin', 'owner', 'restaurant', 'restaurant_owner', 'partner', 'vendor']) {
  const { error } = await sb.from('profiles').insert({ id, full_name: 'Role Probe', role })
  if (!error) {
    console.log(`ALLOWED   role=${role}`)
    await sb.from('profiles').delete().eq('id', id)
  } else if (/profiles_role_check/.test(error.message)) {
    console.log(`REJECTED  role=${role} (check constraint)`)
  } else {
    console.log(`ERROR     role=${role}: ${error.message}`)
  }
}

// Does the existing table have a phone/email column at all?
const cols = await sb.from('profiles').select('*').limit(1)
console.log('profiles columns:', Object.keys(cols.data?.[0] ?? {}).join(', ') || '(empty table, unknown)')

await sb.auth.admin.deleteUser(id)
