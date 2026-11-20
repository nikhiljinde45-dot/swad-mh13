import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { inr } from '../lib/format'
import { useCart, useToast } from '../lib/app-state'
import type { MenuItem, Restaurant } from '../lib/types'
import MenuItemRow from '../components/MenuItemRow'
import { EmptyState, FoodThumb, Icon, Spinner, Toggle } from '../components/ui'

export default function RestaurantPage() {
  const { id = '' } = useParams()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [vegOnly, setVegOnly] = useState(false)
  const [query, setQuery] = useState('')

  const { cart, count, subtotal, qtyOf, add, increment, decrement } = useCart()
  const { notify } = useToast()

  useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .restaurant(id)
      .then((data) => {
        if (!alive) return
        setRestaurant(data.restaurant)
        setMenu(data.menu)
      })
      .catch((err: Error) => alive && setError(err.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const visible = menu.filter((item) => {
      const vegOk = !vegOnly || item.is_veg
      const queryOk = !q || `${item.name} ${item.description}`.toLowerCase().includes(q)
      return vegOk && queryOk
    })
    const map = new Map<string, MenuItem[]>()
    for (const item of visible) {
      const key = item.category || 'Menu'
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.entries()]
  }, [menu, vegOnly, query])

  const cartHere = cart.restaurantId === id && count > 0

  if (loading) return <Spinner label="Loading menu" />

  if (error || !restaurant) {
    return (
      <div className="px-4 py-10">
        <EmptyState
          emoji="😕"
          title="Restaurant not found"
          body={error || 'This restaurant is no longer available.'}
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
    <div>
      {/* Cover */}
      <div className="relative">
        <FoodThumb
          emoji={restaurant.emoji}
          accent={restaurant.accent}
          seed={restaurant.name}
          imageUrl={restaurant.image_url}
          className="h-40 w-full"
          emojiClass="text-6xl"
          rounded="rounded-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/20 to-transparent" aria-hidden />

        <Link
          to="/"
          aria-label="Back to restaurants"
          className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-xl bg-white/95 text-ink-900 shadow-card backdrop-blur pt-safe"
        >
          <Icon.Back />
        </Link>

        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 text-white">
          <div className="flex items-center gap-2">
            {restaurant.is_verified && (
              <span className="rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold">
                VERIFIED
              </span>
            )}
            {!restaurant.is_open && (
              <span className="rounded-full bg-rose-500/95 px-2 py-0.5 text-[10px] font-bold">
                CLOSED
              </span>
            )}
          </div>
          <h1 className="mt-1 text-xl font-extrabold leading-tight">{restaurant.name}</h1>
          <p className="text-xs text-white/80">
            {restaurant.cuisine} • {restaurant.area}
          </p>
        </div>
      </div>

      {/* Info strip */}
      <div className="border-b border-ink-300/60 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2 text-center">
          <div className="flex-1">
            <p className="flex items-center justify-center gap-1 text-sm font-bold text-emerald-700">
              <Icon.Star className="h-3.5 w-3.5 text-emerald-600" />
              {Number(restaurant.rating ?? 0).toFixed(1)}
            </p>
            <p className="text-[10px] text-ink-500">{restaurant.rating_count} ratings</p>
          </div>
          <span className="h-8 w-px bg-ink-300/60" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-bold text-ink-900">{restaurant.delivery_minutes} min</p>
            <p className="text-[10px] text-ink-500">Delivery time</p>
          </div>
          <span className="h-8 w-px bg-ink-300/60" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-bold text-ink-900">
              {restaurant.delivery_fee === 0 ? 'Free' : inr(restaurant.delivery_fee)}
            </p>
            <p className="text-[10px] text-ink-500">Delivery fee</p>
          </div>
        </div>
        {restaurant.tagline && (
          <p className="mt-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-medium text-brand-800">
            “{restaurant.tagline}”
          </p>
        )}
      </div>

      {/* Menu controls */}
      <div className="sticky top-0 z-20 border-b border-ink-300/50 bg-cream/95 px-4 py-2.5 backdrop-blur pt-safe">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">
              <Icon.Search className="h-4 w-4" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search in menu"
              aria-label="Search this menu"
              className="w-full rounded-xl border border-ink-300 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-2.5 py-2 ring-1 ring-ink-300">
            <span className="text-[10px] font-bold text-ink-700">VEG</span>
            <Toggle checked={vegOnly} onChange={setVegOnly} label="Show vegetarian items only" />
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 pb-28 pt-3">
        {groups.length === 0 ? (
          <EmptyState
            emoji="🍽️"
            title="No dishes match"
            body="Try clearing the search or the vegetarian filter."
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setVegOnly(false)
                }}
                className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          groups.map(([category, items]) => (
            <section key={category} className="mb-2">
              <h2 className="mb-1 mt-3 text-xs font-bold uppercase tracking-wider text-ink-500">
                {category} <span className="font-medium text-ink-500">({items.length})</span>
              </h2>
              <div>
                {items.map((item) => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    qty={qtyOf(item.id)}
                    onAdd={() => {
                      if (!restaurant.is_open) {
                        notify('This restaurant is currently closed', 'error')
                        return
                      }
                      const switching = cart.restaurantId && cart.restaurantId !== restaurant.id
                      add(item, restaurant)
                      notify(switching ? `Cart replaced with ${restaurant.name}` : `${item.name} added`)
                    }}
                    onInc={() => increment(item.id)}
                    onDec={() => decrement(item.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Sticky cart bar */}
      {cartHere && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-3 pb-1">
          <Link
            to="/cart"
            className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 rounded-2xl bg-emerald-600 px-4 py-3 text-white shadow-float active:bg-emerald-700"
          >
            <span className="text-xs font-semibold">
              {count} item{count > 1 ? 's' : ''} • {inr(subtotal)}
            </span>
            <span className="flex items-center gap-1 text-sm font-bold">
              View cart <Icon.Cart className="h-4 w-4" />
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}
