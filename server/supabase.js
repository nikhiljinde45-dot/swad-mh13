import { createClient } from '@supabase/supabase-js'

/* ------------------------------------------------------------------ *
 * Supabase access
 *
 * The service key lives only in server-side environment variables. The
 * browser never receives it: it authenticates through this server and
 * gets an httpOnly session cookie instead.
 * ------------------------------------------------------------------ */

export const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
export const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
export const configured = Boolean(SUPABASE_URL && SERVICE_KEY)

export const BUCKET = 'food-images'
export const COOKIE_NAME = 'swad_session'
export const ROLES = ['customer', 'restaurant_owner', 'rider', 'admin']

/**
 * supabase-js constructs a Realtime client eagerly, and on Node 20 that throws
 * because the runtime has no global WebSocket. This app never opens a realtime
 * socket (it reads through the REST/Auth APIs only), so an inert transport
 * keeps server startup working on every supported Node version.
 */
class InertSocket {
  constructor() {
    this.readyState = 3
  }
  addEventListener() {}
  removeEventListener() {}
  send() {}
  close() {}
}

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { headers: { 'x-application-name': 'swad-mh13' } },
  realtime: { transport: InertSocket },
}

/** Service-role client for database, storage and admin API calls. */
export const sb = configured ? createClient(SUPABASE_URL, SERVICE_KEY, clientOptions) : null

/**
 * Auth-only client for password sign-in and token refresh.
 *
 * supabase-js keeps the signed-in session on the client instance and then sends
 * that user's JWT as the Authorization header on every REST request. Sharing one
 * client would silently downgrade our service-role writes to the signed-in user,
 * so Row Level Security would reject them (this broke restaurant registration).
 * Keeping session creation on its own client leaves `sb` permanently service-role.
 */
export const authSb = configured ? createClient(SUPABASE_URL, SERVICE_KEY, clientOptions) : null

/* ----------------------------- cookies ---------------------------- */

export function readCookie(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim())
    }
  }
  return null
}

function isSecure(req) {
  return req.headers['x-forwarded-proto'] === 'https' || req.secure === true
}

export function writeCookie(req, res, name, value, maxAgeSeconds = 60 * 60 * 24 * 30) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (isSecure(req)) parts.push('Secure')
  res.append('Set-Cookie', parts.join('; '))
}

export function clearCookie(req, res, name) {
  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (isSecure(req)) parts.push('Secure')
  res.append('Set-Cookie', parts.join('; '))
}

/* ---------------------------- sessions ---------------------------- */

export const encodeSession = (tokens) =>
  Buffer.from(JSON.stringify(tokens), 'utf8').toString('base64url')

export function decodeSession(raw) {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    return parsed && typeof parsed.at === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function jwtExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return Number(payload.exp) || 0
  } catch {
    return 0
  }
}

export async function loadProfile(userId) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...data,
    role: data.role || 'customer',
    is_blocked: Boolean(data.is_blocked),
  }
}

/** Resolve the cookie into a user + profile, refreshing the token if needed. */
/**
 * Sessions are stateless JWTs in an httpOnly cookie, so logout also has to
 * invalidate them here: an access token stays valid until it expires, and a
 * refresh token would otherwise mint a new one. Revoked tokens are remembered
 * until their own expiry.
 */
const revokedTokens = new Map()

export function revokeSession(accessToken) {
  if (!accessToken) return
  const expiry = jwtExpiry(accessToken) * 1000
  revokedTokens.set(accessToken, expiry > Date.now() ? expiry : Date.now() + 3_600_000)
  for (const [token, expiresAt] of revokedTokens) {
    if (expiresAt <= Date.now()) revokedTokens.delete(token)
  }
}

export async function resolveSession(req, res) {
  const raw = readCookie(req, COOKIE_NAME)
  const tokens = raw ? decodeSession(raw) : null
  if (!tokens) return null

  if (revokedTokens.has(tokens.at)) {
    clearCookie(req, res, COOKIE_NAME)
    return null
  }

  let user = null

  if (jwtExpiry(tokens.at) * 1000 > Date.now() + 20_000) {
    const { data, error } = await sb.auth.getUser(tokens.at)
    if (!error) user = data?.user ?? null
  }

  if (!user && tokens.rt) {
    const { data, error } = await authSb.auth.refreshSession({ refresh_token: tokens.rt })
    if (!error && data?.session) {
      user = data.session.user
      writeCookie(req, res, COOKIE_NAME, encodeSession({
        at: data.session.access_token,
        rt: data.session.refresh_token,
      }))
    }
  }

  if (!user) {
    clearCookie(req, res, COOKIE_NAME)
    return null
  }

  const profile = await loadProfile(user.id)
  if (!profile) return null
  return { user, profile }
}

/** Sign in with email/password and persist the resulting session. */
export async function startSession(req, res, email, password) {
  const { data, error } = await authSb.auth.signInWithPassword({ email, password })
  if (error || !data?.session) {
    const message = /invalid|credentials/i.test(error?.message || '')
      ? 'Incorrect email or password'
      : error?.message || 'Could not sign in'
    const failure = new Error(message)
    failure.status = 401
    throw failure
  }
  writeCookie(req, res, COOKIE_NAME, encodeSession({
    at: data.session.access_token,
    rt: data.session.refresh_token,
  }))
  return data.session.user
}
