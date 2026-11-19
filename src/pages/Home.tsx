import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { AppConfig, Restaurant } from '../lib/types'
import RestaurantCard from '../components/RestaurantCard'
import { EmptyState, Icon, SectionTitle, Spinner } from '../components/ui'

const FALLBACK_CATEGORIES = [
  { id: 'all', name: 'All', emoji: '🍽️' },
  { id: 'misal', name: 'Misal', emoji: '🥘' },
  { id: 'thali', name: 'Thali', emoji: '🍛' },
  { id: 'biryani', name: 'Biryani', emoji: '🍚' },
  { id: 'fastfood', name: 'Fast Food', emoji: '🍕' },
  { id: 'chinese', name: 'Chinese', emoji: '🍜' },
  { id: 'sweets', name: 'Sweets', emoji: '🍮' },
]

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([api.restaurants(), api.config()])
      .then(([list, cfg]) => {
        if (!alive) return
        setRestaurants(list.restaurants)
        setConfig(cfg)
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const categories = config?.categories?.length ? config.categories : FALLBACK_CATEGORIES

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return restaurants.filter((restaurant) => {
      const matchesCategory = category === 'all' || restaurant.category === category
      const matchesQuery =
        !q || `${restaurant.name} ${restaurant.cuisine} ${restaurant.area}`.toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [restaurants, category, query])

  const openCount = filtered.filter((restaurant) => restaurant.is_open).length

  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-cream/95 pt-safe backdrop-blur">
        <div className="px-4 pb-3 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-rose-600 text-lg shadow-card">
                🍛
              </span>
              <div className="leading-tight">
                <h1 className="text-[17px] font-extrabold tracking-tight text-ink-900">Swad MH13</h1>
                <p className="text-[11px] font-medium text-ink-500">Ghar ka swad, delivered fast</p>
              </div>
            </div>

            <Link
              to="/panels"
              className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-ink-700 shadow-card ring-1 ring-black/5"
            >
              <Icon.Grid className="h-3.5 w-3.5" />
              Panels
            </Link>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-ink-500">
            <Icon.Pin className="h-3.5 w-3.5 text-brand-500" />
            Delivering to
            <span className="text-ink-900">Gadhinglaj, Kolhapur</span>
          </div>

          <div className="relative mt-2.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">
              <Icon.Search className="h-[18px] w-[18px]" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search misal, thali, biryani…"
              aria-label="Search restaurants and dishes"
              className="w-full rounded-2xl border border-ink-300/70 bg-white py-3 pl-10 pr-3 text-sm text-ink-900 shadow-card outline-none transition placeholder:text-ink-500 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {categories.map((cat) => {
            const active = cat.id === category
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                aria-pressed={active}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-brand-500 text-white shadow-card'
                    : 'bg-white text-ink-700 ring-1 ring-black/5'
                }`}
              >
                <span aria-hidden>{cat.emoji}</span>
                {cat.name}
              </button>
            )
          })}
        </div>
      </header>

      <div className="px-4 pt-4">
        {/* Promo */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-900 to-brand-800 p-4 text-white shadow-card">
          <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-brand-500/30 blur-xl" aria-hidden />
          <div className="absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-rose-500/20 blur-xl" aria-hidden />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-200">
              Swad MH13 special
            </p>
            <h2 className="mt-1 text-xl font-extrabold leading-tight">
              ₹40 off your first order
            </h2>
            <p className="mt-1 text-xs text-white/70">
              Fresh from local kitchens in Gadhinglaj &amp; Kolhapur.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold ring-1 ring-white/25">
              USE CODE
              <span className="rounded bg-white px-1.5 py-0.5 text-ink-900">SWAD40</span>
            </div>
          </div>
        </section>

        {config?.mode === 'demo' && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-amber-800 ring-1 ring-amber-200">
            <strong className="font-bold">Demo catalogue.</strong> Add <code>SUPABASE_URL</code> and{' '}
            <code>SUPABASE_ANON_KEY</code> in Settings → Environment variables to use your own
            database. Keys stay on the server.
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
            Could not load restaurants: {error}
          </p>
        )}

        {/* Restaurant list */}
        <section className="mt-5">
          <SectionTitle
            action={
              <span className="text-[11px] font-semibold text-ink-500">
                {openCount} open now
              </span>
            }
          >
            {query || category !== 'all' ? 'Search results' : 'Popular near you'}
          </SectionTitle>

          {loading ? (
            <Spinner label="Finding restaurants" />
          ) : filtered.length === 0 ? (
            <EmptyState
              emoji="🔍"
              title="No restaurants found"
              body="Try another category or search for a different dish."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setCategory('all')
                  }}
                  className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Reset filters
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((restaurant) => (
                <div key={restaurant.id} className="relative">
                  <RestaurantCard restaurant={restaurant} />
                  {!restaurant.is_open && (
                    <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl bg-white/70 backdrop-blur-[1px]">
                      <span className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-bold text-white">
                        Currently closed
                      </span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Trust strip */}
        <section className="mt-6 grid grid-cols-3 gap-2 pb-2">
          {[
            { emoji: '⚡', title: '25 min', body: 'Avg delivery' },
            { emoji: '🛡️', title: 'Hygiene', body: 'Verified kitchens' },
            { emoji: '💸', title: 'No fees', body: 'On ₹299+' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-3 text-center shadow-card ring-1 ring-black/5">
              <span className="text-lg" aria-hidden>
                {item.emoji}
              </span>
              <p className="mt-1 text-xs font-bold text-ink-900">{item.title}</p>
              <p className="text-[10px] text-ink-500">{item.body}</p>
            </div>
          ))}
        </section>

        <p className="pb-4 pt-2 text-center text-[10px] text-ink-500">
          Swad MH13 • Made for Maharashtra’s MH-13 belt
        </p>
      </div>
    </div>
  )
}
