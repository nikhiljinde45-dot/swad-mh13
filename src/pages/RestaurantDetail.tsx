import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Sheet,
  Spinner,
  Thumb,
  cx,
} from '../components/kit'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { inr } from '../lib/format'
import type { MenuItem, Restaurant } from '../lib/types'

export default function RestaurantDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const cart = useCart()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [detail, setDetail] = useState<MenuItem | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    api
      .restaurant(id, controller.signal)
      .then((result) => {
        setRestaurant(result.restaurant)
        setMenu(result.menu)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setError(cause instanceof ApiError ? cause.message : 'Could not load this restaurant.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id])

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>()
    for (const item of menu) {
      if (activeCategory !== 'all' && item.category_id !== activeCategory) continue
      const key = item.categories?.name || 'Other'
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [menu, activeCategory])

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of menu) {
      if (item.category_id) map.set(item.category_id, item.categories?.name || 'Other')
    }
    return [...map.entries()]
  }, [menu])

  const addToCart = (item: MenuItem) => {
    if (!user) {
      navigate('/login', { state: { notice: 'Sign in to start your order.' } })
      return
    }
    cart.add(restaurant!.id, restaurant!.name, {
      menu_item_id: item.id,
      name: item.name,
      price: Number(item.price),
      image_url: item.image_url,
      is_veg: item.is_veg,
    })
    setAdded(item.id)
    setTimeout(() => setAdded((current) => (current === item.id ? null : current)), 1200)
  }

  const cartForThisRestaurant = cart.restaurantId === restaurant?.id

  return (
    <AppShell>
      {loading ? (
        <Spinner label="Loading menu…" />
      ) : error ? (
        <div className="space-y-3">
          <Alert tone="error">{error}</Alert>
          <Link to="/">
            <Button variant="secondary" full>
              Back to restaurants
            </Button>
          </Link>
        </div>
      ) : !restaurant ? (
        <EmptyState title="Restaurant not found" message="It may have been removed." />
      ) : (
        <div className={cx('space-y-4', cartForThisRestaurant && cart.count > 0 && 'pb-16')}>
          <Card className="space-y-2">
            <div className="flex gap-3">
              <Thumb
                src={restaurant.image_url}
                alt={restaurant.name}
                className="h-20 w-20 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-extrabold text-slate-900">{restaurant.name}</h1>
                <p className="line-clamp-2 text-xs text-slate-500">{restaurant.description}</p>
                <p className="mt-1 text-[11px] text-slate-500">{restaurant.address}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
                {restaurant.is_active ? 'Accepting orders' : 'Not accepting orders'}
              </span>
              {typeof restaurant.delivery_fee === 'number' && (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                  Delivery {inr(restaurant.delivery_fee)}
                </span>
              )}
              {restaurant.owner_phone && (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                  {restaurant.owner_phone}
                </span>
              )}
            </div>
            {!restaurant.is_active && (
              <Alert tone="warning">
                This restaurant is not approved yet, so ordering is unavailable.
              </Alert>
            )}
          </Card>

          {categoryOptions.length > 1 && (
            <div className="-mx-4 overflow-x-auto px-4">
              <div className="flex gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={cx(
                    'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1',
                    activeCategory === 'all'
                      ? 'bg-slate-900 text-white ring-slate-900'
                      : 'bg-white text-slate-600 ring-slate-200',
                  )}
                >
                  All items
                </button>
                {categoryOptions.map(([categoryId, name]) => (
                  <button
                    key={categoryId}
                    type="button"
                    onClick={() => setActiveCategory(categoryId === activeCategory ? 'all' : categoryId)}
                    className={cx(
                      'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1',
                      activeCategory === categoryId
                        ? 'bg-slate-900 text-white ring-slate-900'
                        : 'bg-white text-slate-600 ring-slate-200',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {menu.length === 0 ? (
            <EmptyState
              title="No dishes yet"
              message="The restaurant has not added menu items."
            />
          ) : (
            <div className="space-y-4">
              {grouped.map(([categoryName, items]) => (
                <section key={categoryName} className="space-y-2">
                  <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">
                    {categoryName}
                  </h2>
                  {items.map((item) => {
                    const inCart = cart.lines.find((line) => line.menu_item_id === item.id)
                    return (
                      <Card key={item.id} className="flex gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cx(
                                'h-2.5 w-2.5 rounded-full ring-1',
                                item.is_veg === false
                                  ? 'bg-rose-500 ring-rose-600'
                                  : 'bg-emerald-500 ring-emerald-600',
                              )}
                              aria-hidden
                            />
                            <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                          </div>
                          <p className="mt-0.5 text-sm font-extrabold text-slate-900">
                            {inr(item.price)}
                          </p>
                          {item.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.description}</p>
                          )}
                          {!item.is_available && (
                            <p className="mt-1 text-[11px] font-bold text-rose-600">Currently unavailable</p>
                          )}
                          {inCart && (
                            <p className="mt-1 text-[11px] font-bold text-emerald-600">
                              {inCart.quantity} in cart
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <button type="button" onClick={() => setDetail(item)} className="block">
                            <Thumb
                              src={item.image_url}
                              alt={item.name}
                              className="h-16 w-16 rounded-xl"
                            />
                          </button>
                          <Button
                            size="sm"
                            variant={added === item.id ? 'secondary' : 'primary'}
                            disabled={!item.is_available || !restaurant.is_active || role === 'owner' || role === 'rider' || role === 'admin'}
                            onClick={() => addToCart(item)}
                          >
                            {added === item.id ? 'Added' : 'Add'}
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </section>
              ))}
            </div>
          )}

          {cartForThisRestaurant && cart.count > 0 && (
            <div className="fixed inset-x-0 bottom-14 z-20 mx-auto max-w-2xl px-4">
              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-lg"
              >
                <span className="text-sm font-bold">
                  {cart.count} item{cart.count === 1 ? '' : 's'} · {inr(cart.subtotal)}
                </span>
                <span className="text-sm font-extrabold">View cart →</span>
              </button>
            </div>
          )}
        </div>
      )}

      <Sheet open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name ?? ''}>
        {detail && (
          <div className="space-y-3">
            <Thumb src={detail.image_url} alt={detail.name} className="h-44 w-full rounded-2xl" />
            <p className="text-lg font-extrabold text-slate-900">{inr(detail.price)}</p>
            <p className="text-sm text-slate-600">{detail.description || 'No description provided.'}</p>
            <Button
              full
              disabled={!detail.is_available || !restaurant?.is_active}
              onClick={() => {
                addToCart(detail)
                setDetail(null)
              }}
            >
              Add to cart
            </Button>
          </div>
        )}
      </Sheet>
    </AppShell>
  )
}
