import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from '../components/AppShell'
import { Alert, Button, Field, Input } from '../components/kit'
import { ApiError } from '../lib/api'
import { homeFor, useAuth } from '../lib/auth'

type Tab = 'customer' | 'restaurant_owner' | 'rider'

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: 'customer', label: 'Customer', blurb: 'Order food from restaurants near you.' },
  { id: 'restaurant_owner', label: 'Restaurant Partner', blurb: 'Manage your restaurant, menu and orders.' },
  { id: 'rider', label: 'Rider', blurb: 'Deliver assigned orders and update status.' },
]

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [tab, setTab] = useState<Tab>('customer')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const active = TABS.find((item) => item.id === tab) ?? TABS[0]
  const notice = (location.state as { notice?: string } | null)?.notice

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    setBusy(true)
    try {
      const result = await signIn(email.trim(), password)
      navigate(homeFor(result.profile?.role ?? result.user.role), { replace: true })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not sign in. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 py-4">
      <div className="space-y-3 text-center">
        <div className="flex justify-center">
          <Brand />
        </div>
        <p className="text-sm text-slate-500">Sign in to continue. One login works for every panel.</p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={
              'rounded-lg px-2 py-2 text-[11px] font-bold transition-colors ' +
              (tab === item.id ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500')
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <p className="mb-4 text-sm text-slate-600">{active.blurb}</p>

        {notice && (
          <div className="mb-3">
            <Alert tone="success">{notice}</Alert>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label="Email" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label="Password" htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {error && <Alert tone="error">{error}</Alert>}

          <Button type="submit" full loading={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-3 flex items-center justify-between text-xs">
          <Link to="/forgot-password" className="font-semibold text-orange-700 hover:underline">
            Forgot password?
          </Link>
          <Link
            to={`/register?role=${tab}`}
            className="font-semibold text-slate-700 hover:underline"
          >
            Create account
          </Link>
        </div>
      </div>

      <p className="px-2 text-center text-[11px] leading-relaxed text-slate-400">
        Administrator access is never self-selected. It is granted only by the existing admin in the
        database.
      </p>
    </div>
  )
}
