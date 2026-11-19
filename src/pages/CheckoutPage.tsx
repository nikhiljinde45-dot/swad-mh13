import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { inr } from '../lib/format'
import { useCart, useProfile, useToast } from '../lib/app-state'
import { Button, EmptyState, Field, Icon, SectionTitle, TextArea } from '../components/ui'

const PHONE = /^[6-9]\d{9}$/

export default function CheckoutPage() {
  const { cart, count, subtotal, total, clear } = useCart()
  const { profile, saveProfile } = useProfile()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const [address, setAddress] = useState(profile.address)
  const [notes, setNotes] = useState('')
  const [payment, setPayment] = useState<'cod' | 'upi'>('cod')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  if (!cart.lines.length) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          emoji="🧾"
          title="Nothing to check out"
          body="Your cart is empty — pick a dish first."
          action={
            <Link to="/" className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">
              Browse restaurants
            </Link>
          }
        />
      </div>
    )
  }

  const submit = async () => {
    const nextErrors: Record<string, string> = {}
    if (name.trim().length < 2) nextErrors.name = 'Please enter your full name'
    if (!PHONE.test(phone.trim())) nextErrors.phone = 'Enter a valid 10-digit mobile number'
    if (address.trim().length < 10) nextErrors.address = 'Add a complete delivery address'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    try {
      const { order } = await api.createOrder({
        customer_name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        restaurant_id: cart.restaurantId as string,
        items: cart.lines.map((line) => ({ menu_item_id: line.item.id, qty: line.qty })),
        payment_method: payment,
        notes: notes.trim(),
      })
      saveProfile({ name: name.trim(), phone: phone.trim(), address: address.trim(), id: order.customer_id })
      clear()
      notify('Order placed successfully')
      navigate(`/track/${order.id}`, { replace: true })
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pb-32">
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-ink-300/60 bg-cream/95 px-4 py-3 backdrop-blur pt-safe">
        <Link to="/cart" aria-label="Back to cart" className="grid h-9 w-9 place-items-center rounded-xl bg-white ring-1 ring-ink-300">
          <Icon.Back />
        </Link>
        <div>
          <h1 className="text-base font-extrabold leading-tight text-ink-900">Checkout</h1>
          <p className="text-[11px] text-ink-500">{cart.restaurantName}</p>
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4">
        <section>
          <SectionTitle>Delivery details</SectionTitle>
          <div className="space-y-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
            <div>
              <Field
                label="Full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Rohan Patil"
                autoComplete="name"
                inputMode="text"
              />
              {errors.name && <p className="mt-1 text-[11px] font-semibold text-rose-600">{errors.name}</p>}
            </div>
            <div>
              <Field
                label="Mobile number"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                autoComplete="tel"
                inputMode="numeric"
                hint="Used for delivery updates only."
              />
              {errors.phone && <p className="mt-1 text-[11px] font-semibold text-rose-600">{errors.phone}</p>}
            </div>
            <div>
              <TextArea
                label="Delivery address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Flat / house, street, landmark, area, pincode"
                rows={3}
                autoComplete="street-address"
              />
              {errors.address && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">{errors.address}</p>
              )}
            </div>
            <Field
              label="Delivery notes (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Extra tarri, less spicy, ring the bell…"
            />
          </div>
        </section>

        <section>
          <SectionTitle>Payment method</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'cod', label: 'Cash on delivery', emoji: '💵', hint: 'Pay the rider' },
                { id: 'upi', label: 'UPI', emoji: '📲', hint: 'Pay via app' },
              ] as const
            ).map((option) => {
              const active = payment === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPayment(option.id)}
                  aria-pressed={active}
                  className={`rounded-2xl p-3 text-left transition ${
                    active
                      ? 'bg-brand-50 ring-2 ring-brand-400'
                      : 'bg-white ring-1 ring-ink-300'
                  }`}
                >
                  <span className="text-lg" aria-hidden>
                    {option.emoji}
                  </span>
                  <p className="mt-1 text-xs font-bold text-ink-900">{option.label}</p>
                  <p className="text-[10px] text-ink-500">{option.hint}</p>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <SectionTitle>Order summary</SectionTitle>
          <div className="rounded-2xl bg-white p-4 text-sm shadow-card ring-1 ring-black/5">
            <ul className="space-y-1.5">
              {cart.lines.map(({ item, qty }) => (
                <li key={item.id} className="flex justify-between gap-2 text-ink-700">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-ink-900">{qty}×</span> {item.name}
                  </span>
                  <span className="shrink-0 font-semibold">{inr(item.price * qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1.5 border-t border-dashed border-ink-300 pt-3">
              <div className="flex justify-between text-ink-700">
                <span>Item total</span>
                <span>{inr(subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-700">
                <span>Delivery fee</span>
                <span>{cart.deliveryFee === 0 ? 'FREE' : inr(cart.deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-ink-900">
                <span>To pay</span>
                <span>{inr(total)}</span>
              </div>
            </div>
          </div>
        </section>

        <p className="text-center text-[10px] leading-relaxed text-ink-500">
          By placing this order you agree to Swad MH13’s fair-use policy. Your details are used only
          to deliver this order.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 px-3">
        <div className="mx-auto w-full max-w-lg">
          <Button full size="lg" loading={submitting} onClick={submit} className="shadow-float">
            {submitting ? 'Placing order…' : `Place order • ${inr(total)} (${count})`}
          </Button>
        </div>
      </div>
    </div>
  )
}
