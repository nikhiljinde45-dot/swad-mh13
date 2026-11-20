import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../components/AppShell'
import { Alert, Button, Field, Input, Spinner } from '../components/kit'
import { ApiError, api } from '../lib/api'

/** Reads the Supabase recovery link tokens from the URL fragment. */
function readRecoveryTokens() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  const params = new URLSearchParams(hash)
  const query = new URLSearchParams(window.location.search)
  return {
    access_token: params.get('access_token') || query.get('access_token') || '',
    error:
      params.get('error_description') ||
      query.get('error_description') ||
      (params.get('error') || query.get('error') ? 'This reset link is no longer valid.' : ''),
  }
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [{ access_token, error: linkError }] = useState(readRecoveryTokens)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(linkError || null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (access_token) window.history.replaceState(null, '', '/reset-password')
  }, [access_token])

  const submit = async () => {
    setError(null)
    if (!access_token) {
      setError('Open the reset link from your email to set a new password.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Both passwords must match.')
      return
    }

    setBusy(true)
    try {
      await api.resetPassword(access_token, password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 1800)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update your password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-orange-50 via-white to-white px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-5">
        <div className="text-center">
          <Brand />
          <h1 className="mt-3 text-lg font-extrabold text-slate-900">Set a new password</h1>
        </div>

        {done ? (
          <Alert tone="success">Password updated. Taking you to sign in…</Alert>
        ) : (
          <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            {error && <Alert tone="error">{error}</Alert>}
            {!access_token && !error && <Spinner label="Checking your reset link…" />}
            <Field label="New password">
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field label="Confirm password">
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </Field>
            <Button full loading={busy} disabled={!access_token} onClick={() => void submit()}>
              Update password
            </Button>
            <p className="text-center text-xs text-slate-500">
              <Link to="/login" className="font-bold text-orange-700 hover:underline">
                Back to sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
