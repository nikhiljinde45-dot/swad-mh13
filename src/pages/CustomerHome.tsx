import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Alert, Button, Card, EmptyState, Input, Spinner, Thumb, cx } from '../components/kit'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { inr } from '../lib/format'
import type { Category, Restaurant } from '../lib/types'

export default function CustomerHome() {
  const { user, role } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounce typing so a phone keyboard does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const result = await api.restaurants({ search: query || undefined, category: category || undefined })
        if (signal?.aborted) return
        setRestaurants(result.restaurants)
      } catch (cause) {
        if (signal?.aborted) return
        setError(cause instanceof ApiError ? cause.message : 'Could not load restaurants.')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [query, category],
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    api
      .categories()
      .then((result) => setCategories(result.categories))
      .catch(() => setCategories([]))
  }, [])

  const greeting = useMemo(() => {
    if (!user) return 'Order food you love'
    const hour = new Date().getHours()
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    return `${part}, ${(user.full_name || 'there').split(' ')[0]}`
  }, [user])

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">{greeting}</h1>
          <p className="text-sm text-slate-500">Fresh food from kitchens near you.</p>
        </div>

        {!user && (
          <Card className="flex items-center justify-between gap-3 bg-gradient-to-r from-orange-50 to-rose-50 ring-orange-100">
            <div>
              <p className="text-sm font-bold text-slate-900">Sign in to order</p>
              <p className="text-xs text-slate-600">Track orders and save your addresses.</p>
            </div>
            <Link to="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </Card>
        )}

        {user && role && role !== 'customer' && (
          <Alert tone="info">
            You are signed in as staff. Customer ordering is available from a customer account.
          </Alert>
        )}

        <div>
          <Input
            type="search"
            placeholder="Search restaurants or dishes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search restaurants"
          />
        </div>

        {categories.length > 0 && (
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex gap-2 pb-1">
              <button
                type="button"
                onClick={() => setCategory('')}
                className={cx(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition-colors',
                  category === ''
                    ? 'bg-orange-600 text-white ring-orange-600'
                    : 'bg-white text-slate-600 ring-slate-200',
                )}
              >
                All
              </button>
              {categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id === category ? '' : item.id)}
                  className={cx(
                    'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition-colors',
                    category === item.id
                      ? 'bg-orange-600 text-white ring-orange-600'
                      : 'bg-white text-slate-600 ring-slate-200',
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <Alert tone="error">
            {error}{' '}
            <button type="button" onClick={() => void load()} className="font-bold underline">
              Retry
            </button>
          </Alert>
        )}

        {loading ? (
          <Spinner label="Finding restaurants…" />
        ) : restaurants.length === 0 ? (
          <EmptyState
            title="No restaurants found"
            message={
              query || category
                ? 'Try a different search or category.'
                : 'Approved restaurants will appear here as soon as an admin activates them.'
            }
          />
        ) : (
          <div className="space-y-3">
            {restaurants.map((restaurant) => (
              <Link key={restaurant.id} to={`/restaurants/${restaurant.id}`} className="block">
                <Card className="flex gap-3 transition-shadow hover:shadow-md">
                  <Thumb
                    src={restaurant.image_url}
                    alt={restaurant.name}
                    className="h-20 w-20 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-slate-900">{restaurant.name}</p>
                    <p className="line-clamp-2 text-xs text-slate-500">
                      {restaurant.description || 'Home-style food, freshly prepared.'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                        {restaurant.is_active ? 'Open' : 'Closed'}
                      </span>
                      {restaurant.city && <span>{restaurant.city}</span>}
                      {typeof restaurant.delivery_fee === 'number' && (
                        <span>Delivery {inr(restaurant.delivery_fee)}</span>
                      )}
                      {typeof restaurant.menu_count === 'number' && (
                        <span>{restaurant.menu_count} items</span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
