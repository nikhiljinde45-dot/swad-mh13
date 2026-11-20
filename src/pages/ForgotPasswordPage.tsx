import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/AppShell'
import { Alert, Button, Field, Input } from '../components/kit'
import { ApiError, api } from '../lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      const result = await api.forgotPassword(email.trim())
      setSent(result.message)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not send the reset email.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-6">
      <div className="flex justify-center">
        <Brand />
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h1 className="text-lg font-extrabold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-xs text-slate-500">
          We will email you a secure link to set a new password.
        </p>

        {sent ? (
          <div className="mt-4 space-y-3">
            <Alert tone="success">{sent}</Alert>
            <p className="text-xs text-slate-500">
              Check your inbox and spam folder. The link opens the password reset page.
            </p>
            <Link
              to="/login"
              className="block rounded-xl bg-slate-100 px-4 py-2.5 text-center text-sm font-bold text-slate-700"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
            <Field label="Email" htmlFor="fp-email">
              <Input
                id="fp-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            {error && <Alert tone="error">{error}</Alert>}

            <Button type="submit" full loading={busy}>
              Send reset link
            </Button>

            <Link to="/login" className="block text-center text-xs font-semibold text-slate-500">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
