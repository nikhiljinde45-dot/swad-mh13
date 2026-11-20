import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Alert, Button, Card, EmptyState, QtyStepper, Spinner, Thumb } from '../components/kit'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { inr } from '../lib/format'
import type { Restaurant } from '../lib/types'

export default function CartPage() {
  const { user, role } = useAuth()
  const cart = useCart()
  const navigate = useNavigate()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(cart.restaurantId))

  useEffect(() => {
    if (!cart.restaurantId) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    api
      .restaurant(cart.restaurantId, controller.signal)
      .then((result) => setRestaurant(result.restaurant))
      .catch((cause) => {
        if (controller.signal.aborted) return
        setError(cause instanceof ApiError ? cause.message : 'Could not load the restaurant.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [cart.restaurantId])

  const deliveryFee = Number(restaurant?.delivery_fee ?? 0)
  const total = cart.subtotal + deliveryFee
  const blocked = role && role !== 'customer'

  if (!user) {
    return (
      <AppShell>
        <EmptyState
          title="Sign in to view your cart"
          message="Your cart is saved on this device."
          action={
            <Link to="/login">
              <Button>Sign in</Button>
            </Link>
          }
        />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Your cart</h1>
          {cart.restaurantName && (
            <p className="text-sm text-slate-500">from {cart.restaurantName}</p>
          )}
        </div>

        {blocked && <Alert tone="warning">Only customer accounts can place orders.</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        {restaurant && !restaurant.is_active && (
          <Alert tone="warning">
            This restaurant is not accepting orders right now. You can keep your cart for later.
          </Alert>
        )}

        {loading ? (
          <Spinner />
        ) : cart.lines.length === 0 ? (
          <EmptyState
            title="Your cart is empty"
            message="Browse restaurants and add something tasty."
            action={
              <Link to="/">
                <Button>Browse restaurants</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {cart.lines.map((line) => (
                <Card key={line.menu_item_id} className="flex items-center gap-3">
                  <Thumb src={line.image_url} alt={line.name} className="h-14 w-14 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{line.name}</p>
                    <p className="text-xs text-slate-500">{inr(line.price)} each</p>
                    <p className="text-sm font-extrabold text-slate-900">
                      {inr(line.price * line.quantity)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <QtyStepper
                      value={line.quantity}
                      onChange={(next) => cart.setQuantity(line.menu_item_id, next)}
                      min={1}
                    />
                    <button
                      type="button"
                      onClick={() => cart.remove(line.menu_item_id)}
                      className="text-[11px] font-bold text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="space-y-1.5">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Item total</span>
                <span>{inr(cart.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Delivery fee</span>
                <span>{deliveryFee ? inr(deliveryFee) : 'Free'}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5 text-base font-extrabold text-slate-900">
                <span>To pay</span>
                <span>{inr(total)}</span>
              </div>
              <p className="pt-1 text-[11px] text-slate-400">
                Final amounts are recalculated on the server before your order is created.
              </p>
            </Card>

            <Button full disabled={Boolean(blocked)} onClick={() => navigate('/checkout')}>
              Proceed to checkout
            </Button>

            <button
              type="button"
              onClick={() => cart.clear()}
              className="w-full text-center text-xs font-semibold text-slate-500 hover:text-rose-600"
            >
              Clear cart
            </button>
          </>
        )}
      </div>
    </AppShell>
  )
}
