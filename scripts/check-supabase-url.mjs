/**
 * Regression check for Supabase URL resolution (server/store.js).
 * Run: node scripts/check-supabase-url.mjs
 *
 * Verifies that a bare project ref, a full URL, a URL with a trailing slash and
 * an empty configuration all resolve to the expected status fields.
 */
import assert from 'node:assert/strict'

let caseId = 0

async function load(env) {
  for (const key of ['SUPABASE_URL', 'SUPABASE_PROJECT_REF', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    delete process.env[key]
  }
  Object.assign(process.env, env)
  // Distinct query string -> fresh module instance per case.
  const mod = await import(`../server/store.js?case=${++caseId}`)
  return mod.status
}

const bareRef = await load({ SUPABASE_URL: 'vppfluhgfkbamwngadcd' })
assert.equal(bareRef.supabaseUrl, 'https://vppfluhgfkbamwngadcd.supabase.co', 'bare ref expands to project URL')
assert.equal(bareRef.supabaseHost, 'vppfluhgfkbamwngadcd.supabase.co', 'bare ref host')
assert.equal(bareRef.missingKey, true, 'URL without key reports missing key')
assert.equal(bareRef.supabaseConfigured, false, 'URL without key is not configured')

const fullUrl = await load({ SUPABASE_URL: 'https://abcd1234.supabase.co/' })
assert.equal(fullUrl.supabaseUrl, 'https://abcd1234.supabase.co', 'trailing slash is stripped')

const refEnv = await load({ SUPABASE_PROJECT_REF: 'vppfluhgfkbamwngadcd' })
assert.equal(refEnv.supabaseUrl, 'https://vppfluhgfkbamwngadcd.supabase.co', 'SUPABASE_PROJECT_REF fallback works')

const withKey = await load({
  SUPABASE_URL: 'vppfluhgfkbamwngadcd',
  SUPABASE_ANON_KEY: 'test-anon-key',
})
assert.equal(withKey.supabaseConfigured, true, 'URL + anon key is configured')
assert.equal(withKey.missingKey, false, 'key present clears missing-key flag')

const empty = await load({})
assert.equal(empty.supabaseUrl, null, 'no config leaves URL null')
assert.equal(empty.missingKey, false, 'no config does not claim a missing key')

console.log('supabase url resolution: 9 assertions passed')
