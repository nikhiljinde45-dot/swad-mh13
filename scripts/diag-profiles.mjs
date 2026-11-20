import { sb, configured } from '../server/supabase.js'

if (!configured) {
  console.log('not configured')
  process.exit(1)
}

function show(label, error) {
  if (!error) return console.log(`${label}: ok`)
  console.log(`${label}: FAIL message=${error.message} code=${error.code} details=${error.details} hint=${error.hint}`)
}

// What columns does profiles actually expose?
const probe = await sb.from('profiles').select('*').limit(1)
if (probe.error) show('select profiles', probe.error)
else console.log('profiles row keys:', Object.keys(probe.data?.[0] ?? {}).join(', ') || '(table empty)')

// Insert attempts with the server key for each role.
for (const role of ['customer', 'owner', 'rider']) {
  const id = crypto.randomUUID()
  const { error } = await sb.from('profiles').insert({ id, full_name: 'Diag Probe', role })
  show(`insert profile role=${role}`, error)
  if (!error) await sb.from('profiles').delete().eq('id', id)
}

// Same path register() uses: admin createUser + upsert profile.
const email = `diag.${Date.now().toString(36)}@example.com`
const created = await sb.auth.admin.createUser({
  email,
  password: 'SwadTest!2026',
  email_confirm: true,
  user_metadata: { full_name: 'Diag Owner', phone: '9876500000', role: 'owner' },
})
if (created.error) {
  show('admin createUser', created.error)
} else {
  console.log('admin createUser: ok, id =', created.data.user.id)
  const auto = await sb.from('profiles').select('id, role').eq('id', created.data.user.id)
  console.log('profile auto-created by trigger?', auto.data?.length ? JSON.stringify(auto.data[0]) : 'no row')
  const up = await sb
    .from('profiles')
    .upsert({ id: created.data.user.id, full_name: 'Diag Owner', phone: '9876500000', email, role: 'owner' }, { onConflict: 'id' })
  show('upsert profile role=owner', up.error)
  await sb.from('profiles').delete().eq('id', created.data.user.id)
  await sb.auth.admin.deleteUser(created.data.user.id)
}
