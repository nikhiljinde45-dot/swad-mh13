import { Link, useNavigate } from 'react-router-dom'
import { inr } from '../lib/format'
import { useCart } from '../lib/app-state'
import { Button, EmptyState, FoodThumb, Icon, QtyStepper, SectionTitle } from '../components/ui'

export default function CartPage() {
  const { cart, count, subtotal, total, increment, decrement, clear } = useCart()
  const navigate = useNavigate()

  if (!cart.lines.length) {
    return (
      <div className="px-4 py-8">
        <h1 className="mb-4 text-xl font-extrabold text-ink-900">Your cart</h1>
        <EmptyState
          emoji="🛒"
          title="Your cart is empty"
          body="Add a misal, thali or biryani from a nearby kitchen to get started."
          action={
            <Link to="/" className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">
              Browse restaurants
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="pb-40">
      <div className="sticky top-0 z-20 border-b border-ink-300/60 bg-cream/95 px-4 py-3 backdrop-blur pt-safe">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold leading-tight text-ink-900">Your cart</h1>
            <p className="text-[11px] font-medium text-ink-500">{cart.restaurantName}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
          >
            Clear cart
          </button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-white px-3 shadow-card ring-1 ring-black/5">
          {cart.lines.map(({ item, qty }) => (
            <div
              key={item.id}
              className="flex items-center gap-3 border-b border-ink-300/40 py-3 last:border-b-0"
            >
              <FoodThumb
                emoji={item.emoji}
                seed={item.name}
                imageUrl={item.image_url}
                className="h-12 w-12"
                emojiClass="text-xl"
                rounded="rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
                <p className="text-[11px] text-ink-500">{inr(item.price)} each</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <QtyStepper
                  qty={qty}
                  onInc={() => increment(item.id)}
                  onDec={() => decrement(item.id)}
                  label={item.name}
                />
                <p className="text-xs font-bold text-ink-900">{inr(item.price * qty)}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          to="/"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700"
        >
          <Icon.Plus className="h-3.5 w-3.5" /> Add more items
        </Link>

        <section className="mt-5">
          <SectionTitle>Bill details</SectionTitle>
          <div className="space-y-2 rounded-2xl bg-white p-4 text-sm shadow-card ring-1 ring-black/5">
            <div className="flex justify-between text-ink-700">
              <span>Item total</span>
              <span className="font-semibold">{inr(subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink-700">
              <span>Delivery fee</span>
              <span className="font-semibold">
                {cart.deliveryFee === 0 ? (
                  <span className="text-emerald-600">FREE</span>
                ) : (
                  inr(cart.deliveryFee)
                )}
              </span>
            </div>
            <div className="flex justify-between text-ink-700">
              <span>Taxes &amp; charges</span>
              <span className="font-semibold text-emerald-600">Included</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-dashed border-ink-300 pt-2.5 text-base font-extrabold text-ink-900">
              <span>To pay</span>
              <span>{inr(total)}</span>
            </div>
          </div>
        </section>

        <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-[11px] font-medium text-brand-800">
          Pay by cash on delivery or UPI. No card details are ever stored.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 px-3">
        <div className="mx-auto w-full max-w-lg">
          <Button full size="lg" onClick={() => navigate('/checkout')} className="shadow-float">
            Checkout • {inr(total)} ({count})
          </Button>
        </div>
      </div>
    </div>
  )
}
