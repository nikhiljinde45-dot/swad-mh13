import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Alert, Button, Card, Field, Input, Spinner, TextArea, cx } from '../components/kit'
import { ApiError, api, type PaymentsConfig } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { inr } from '../lib/format'
import type { Address } from '../lib/types'

export default function CheckoutPage() {
  const { user, role } = useAuth()
  const cart = useCart()
  const navigate = useNavigate()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [selected, setSelected] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ full_address: '', city: '', pincode: '' })
  const [notes, setNotes] = useState('')
  const [payment, setPayment] = useState<'cod' | 'upi' | 'online'>('cod')
  const [payments, setPayments] = useState<PaymentsConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user || role !== 'customer') {
      setLoading(false)
      return
    }    api
      .addresses()
      .then((result) => {
        setAddresses(result.addresses)
        if (result.addresses.length) setSelected(result.addresses[0].id)
        else setAdding(true)
      })
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : 'Could not load addresses.'))
      .finally(() => setLoading(false))
  }, [user, role])

  useEffect(() => {
    api
      .paymentConfig()
      .then((result) => {
        setPayments(result)
        if (!result.online_enabled) setPayment((current) => (current === 'online' ? 'cod' : current))
      })
      .catch(() => setPayments(null))
  }, [])

  const saveAddress = async () => {
    setError(null)
    if (form.full_address.trim().length < 6) {
      setError('Enter your full delivery address.')
      return
    }
    if (form.city.trim().length < 2) {
      setError('Enter your city.')
      return
    }
    if (!/^[1-9][0-9]{5}$/.test(form.pincode.trim())) {
      setError('PIN code must be 6 digits.')
      return
    }

    setBusy(true)
    try {
      const result = await api.createAddress({
        full_address: form.full_address.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim(),
      })
      setAddresses((current) => [result.address, ...current])
      setSelected(result.address.id)
      setAdding(false)
      setForm({ full_address: '', city: '', pincode: '' })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save the address.')
    } finally {
      setBusy(false)
    }
  }

  const placeOrder = async () => {
    setError(null)
    if (!cart.restaurantId || cart.lines.length === 0) {
      setError('Your cart is empty.')
      return
    }
    if (!selected) {
      setError('Add a delivery address first.')
      return
    }

    setBusy(true)
    try {
      const result = await api.placeOrder({
        restaurant_id: cart.restaurantId,
        items: cart.lines.map((line) => ({ menu_item_id: line.menu_item_id, quantity: line.quantity })),
        address_id: selected,
        payment_method: payment,
        notes: notes.trim() || undefined,
      })
      cart.clear()
      const destination =
        result.order.payment_method === 'online'
          ? `/orders?pay=${result.order.id}`
          : `/orders?placed=${result.order.id}`
      navigate(destination, { replace: true })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not place the order.')
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <AppShell>
        <Alert tone="warning">
          Please sign in to check out.{' '}
          <Link to="/login" className="font-bold underline">
            Sign in
          </Link>
        </Alert>
      </AppShell>
    )
  }

  if (role && role !== 'customer') {
    return (
      <AppShell>
        <Alert tone="warning">Only customer accounts can place orders.</Alert>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold text-slate-900">Checkout</h1>

        {error && <Alert tone="error">{error}</Alert>}

        {loading ? (
          <Spinner label="Loading your addresses…" />
        ) : (
          <>
            <Card className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Delivery address
              </p>

              {addresses.map((address) => (
                <label
                  key={address.id}
                  className={cx(
                    'flex cursor-pointer gap-3 rounded-xl p-3 ring-1 transition-colors',
                    selected === address.id
                      ? 'bg-orange-50 ring-orange-300'
                      : 'bg-white ring-slate-200',
                  )}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={selected === address.id}
                    onChange={() => setSelected(address.id)}
                    className="mt-1 accent-orange-600"
                  />
                  <span className="text-sm">
                    <span className="block font-semibold text-slate-900">{address.full_address}</span>
                    <span className="text-xs text-slate-500">
                      {address.city} — {address.pincode}
                    </span>
                  </span>
                </label>
              ))}

              {adding ? (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                  <Field label="Full address" htmlFor="addr-full">
                    <TextArea
                      id="addr-full"
                      value={form.full_address}
                      onChange={(event) => setForm({ ...form, full_address: event.target.value })}
                      placeholder="Flat / house no., building, street, area"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="City" htmlFor="addr-city">
                      <Input
                        id="addr-city"
                        value={form.city}
                        onChange={(event) => setForm({ ...form, city: event.target.value })}
                      />
                    </Field>
                    <Field label="PIN code" htmlFor="addr-pin">
                      <Input
                        id="addr-pin"
                        inputMode="numeric"
                        maxLength={6}
                        value={form.pincode}
                        onChange={(event) => setForm({ ...form, pincode: event.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" loading={busy} onClick={() => void saveAddress()}>
                      Save address
                    </Button>
                    {addresses.length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="text-xs font-bold text-orange-700 hover:underline"
                >
                  + Add another address
                </button>
              )}
            </Card>

            <Card className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment</p>
              <div className="grid grid-cols-2 gap-2">
                {(['cod', 'upi'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPayment(method)}
                    className={cx(
                      'rounded-xl px-3 py-2.5 text-sm font-bold ring-1',
                      payment === method
                        ? 'bg-slate-900 text-white ring-slate-900'
                        : 'bg-white text-slate-700 ring-slate-200',
                    )}
                  >
                    {method === 'cod' ? 'Cash on delivery' : 'UPI on delivery'}
                  </button>
                ))}
              </div>
              {payments?.online_enabled && (
                <button
                  type="button"
                  onClick={() => setPayment('online')}
                  className={cx(
                    'w-full rounded-xl px-3 py-2.5 text-sm font-bold ring-1',
                    payment === 'online'
                      ? 'bg-slate-900 text-white ring-slate-900'
                      : 'bg-white text-slate-700 ring-slate-200',
                  )}
                >
                  Pay online now (UPI QR)
                </button>
              )}
              <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
                {payment === 'online' ? (
                  <>
                    <span className="font-bold text-slate-700">Pay by UPI right after placing the order.</span>{' '}
                    A QR for the exact amount opens next — scan it with any UPI app and the order goes to
                    the kitchen straight away.
                  </>
                ) : (
                  <>
                    <span className="font-bold text-slate-700">
                      Pay the rider on delivery
                    </span>{' '}
                    by cash or UPI.{' '}
                    {payments?.online_enabled
                      ? 'You can also choose “Pay online now” to settle by UPI QR immediately.'
                      : 'Online payment is not set up yet, so the QR option is hidden.'}
                  </>
                )}
              </div>
              <Field label="Notes for the kitchen" hint="Optional">
                <Input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Less spicy, extra chutney…"
                  maxLength={200}
                />
              </Field>
            </Card>

            <Card className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Order summary
              </p>
              {cart.lines.map((line) => (
                <div key={line.menu_item_id} className="flex justify-between text-sm text-slate-700">
                  <span className="truncate pr-2">
                    {line.quantity} × {line.name}
                  </span>
                  <span className="shrink-0 font-semibold">{inr(line.price * line.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5 text-base font-extrabold text-slate-900">
                <span>Item total</span>
                <span>{inr(cart.subtotal)}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Delivery fee is added from the restaurant settings and the final total is verified on
                the server.
              </p>
            </Card>

            <Button
              full
              loading={busy}
              disabled={cart.lines.length === 0}
              onClick={() => void placeOrder()}
            >
              Place order
            </Button>
          </>
        )}
      </div>
    </AppShell>
  )
}
