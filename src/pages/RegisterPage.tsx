import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Brand } from '../components/AppShell'
import { Alert, Button, Field, Input, TextArea } from '../components/kit'
import { ApiError, api } from '../lib/api'
import { homeFor, useAuth } from '../lib/auth'
import { fileToDataUrl } from '../lib/image'

type Tab = 'customer' | 'restaurant_owner' | 'rider'

const TABS: { id: Tab; label: string }[] = [
  { id: 'customer', label: 'Customer' },
  { id: 'restaurant_owner', label: 'Restaurant Partner' },
  { id: 'rider', label: 'Rider' },
]

interface FormState {
  full_name: string
  phone: string
  email: string
  password: string
  confirm: string
  restaurant_name: string
  description: string
  address: string
  city: string
  pincode: string
}

const initial: FormState = {
  full_name: '',
  phone: '',
  email: '',
  password: '',
  confirm: '',
  restaurant_name: '',
  description: '',
  address: '',
  city: '',
  pincode: '',
}

export default function RegisterPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const initialTab = (params.get('role') as Tab) || 'customer'
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initialTab) ? initialTab : 'customer')
  const [form, setForm] = useState<FormState>(initial)
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const needsRestaurant = tab === 'restaurant_owner'

  const heading = useMemo(() => {
    if (tab === 'restaurant_owner') return 'Register your restaurant'
    if (tab === 'rider') return 'Join as a delivery rider'
    return 'Create your customer account'
  }, [tab])

  const pickLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setLogo(file)
      setLogoPreview(await fileToDataUrl(file, 700, 0.8))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that image')
    }
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (form.full_name.trim().length < 2) next.full_name = 'Enter your full name.'
    if (!/^[0-9+\-\s]{7,15}$/.test(form.phone.trim())) next.phone = 'Enter a valid phone number.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (form.password.length < 6) next.password = 'Use at least 6 characters.'
    if (form.password !== form.confirm) next.confirm = 'Passwords do not match.'

    if (needsRestaurant) {
      if (form.restaurant_name.trim().length < 2) next.restaurant_name = 'Enter the restaurant name.'
      if (form.address.trim().length < 5) next.address = 'Enter the restaurant address.'
      if (form.city.trim().length < 2) next.city = 'Enter the city.'
      if (!/^[1-9][0-9]{5}$/.test(form.pincode.trim())) next.pincode = 'PIN code must be 6 digits.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!validate()) return

    setBusy(true)
    try {
      setStage('Creating your account…')
      const result = await signUp({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        role: tab,
        restaurant: needsRestaurant
          ? {
              name: form.restaurant_name.trim(),
              description: form.description.trim(),
              address: form.address.trim(),
              city: form.city.trim(),
              pincode: form.pincode.trim(),
            }
          : undefined,
      })

      // Upload the logo only after the account exists, so the request is authenticated.
      if (needsRestaurant && logo && result.restaurant) {
        setStage('Uploading your restaurant photo…')
        try {
          const dataUrl = await fileToDataUrl(logo, 1000, 0.82)
          const uploaded = await api.upload(dataUrl, `restaurant-${result.restaurant.id}`)
          await api.owner.updateRestaurant({ image_url: uploaded.url })
        } catch {
          // A failed photo must not lose the account or the restaurant record.
          navigate('/owner', {
            replace: true,
            state: { notice: 'Account created. Upload your restaurant photo from the dashboard.' },
          })
          return
        }
      }

      navigate(homeFor(result.profile?.role ?? tab), {
        replace: true,
        state: needsRestaurant
          ? { notice: 'Registration submitted. Your restaurant is pending admin approval.' }
          : { notice: 'Welcome to Swad MH13!' },
      })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create the account. Try again.')
    } finally {
      setBusy(false)
      setStage('')
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-2">
      <div className="flex justify-center">
        <Brand />
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
        <h1 className="text-lg font-extrabold text-slate-900">{heading}</h1>
        <p className="mt-1 text-xs text-slate-500">
          {tab === 'restaurant_owner'
            ? 'Your restaurant stays hidden until an administrator approves it.'
            : tab === 'rider'
              ? 'An administrator assigns deliveries to your rider account.'
              : 'Order from restaurants across Maharashtra.'}
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <Field label="Full name" error={errors.full_name} htmlFor="reg-name">
            <Input id="reg-name" autoComplete="name" value={form.full_name} onChange={set('full_name')} />
          </Field>

          <Field label="Phone number" error={errors.phone} htmlFor="reg-phone">
            <Input
              id="reg-phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              value={form.phone}
              onChange={set('phone')}
            />
          </Field>

          <Field label="Email" error={errors.email} htmlFor="reg-email">
            <Input
              id="reg-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Password" error={errors.password} htmlFor="reg-password">
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
              />
            </Field>
            <Field label="Confirm" error={errors.confirm} htmlFor="reg-confirm">
              <Input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={set('confirm')}
              />
            </Field>
          </div>

          {needsRestaurant && (
            <div className="space-y-3 rounded-xl bg-orange-50/60 p-3 ring-1 ring-orange-100">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-700">
                Restaurant details
              </p>

              <Field label="Restaurant name" error={errors.restaurant_name} htmlFor="reg-rname">
                <Input
                  id="reg-rname"
                  value={form.restaurant_name}
                  onChange={set('restaurant_name')}
                  placeholder="Swad MH13 Kitchen"
                />
              </Field>

              <Field label="Description" hint="Cuisine, specialities, timings" htmlFor="reg-desc">
                <TextArea
                  id="reg-desc"
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Home-style Maharashtrian thalis, misal pav and more."
                />
              </Field>

              <Field label="Restaurant address" error={errors.address} htmlFor="reg-addr">
                <TextArea id="reg-addr" value={form.address} onChange={set('address')} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="City" error={errors.city} htmlFor="reg-city">
                  <Input id="reg-city" value={form.city} onChange={set('city')} placeholder="Pune" />
                </Field>
                <Field label="PIN code" error={errors.pincode} htmlFor="reg-pin">
                  <Input
                    id="reg-pin"
                    inputMode="numeric"
                    maxLength={6}
                    value={form.pincode}
                    onChange={set('pincode')}
                    placeholder="411001"
                  />
                </Field>
              </div>

              <Field label="Restaurant photo" hint="JPG or PNG, resized automatically">
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Restaurant preview" className="h-16 w-16 rounded-xl object-cover" />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-xl bg-white text-xs font-bold text-orange-400 ring-1 ring-orange-100">
                      Logo
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={pickLogo}
                    className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-orange-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                  />
                </div>
              </Field>
            </div>
          )}

          {error && <Alert tone="error">{error}</Alert>}
          {busy && stage && <Alert tone="info">{stage}</Alert>}

          <Button type="submit" full loading={busy}>
            {tab === 'restaurant_owner' ? 'Submit registration' : 'Create account'}
          </Button>
        </form>

        <p className="mt-3 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-orange-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
