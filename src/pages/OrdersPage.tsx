import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { inr, isActive, STATUS_LABEL, timeAgo } from '../lib/format'
import { useProfile } from '../lib/app-state'
import type { Order } from '../lib/types'
import { EmptyState, Icon, SectionTitle, Spinner, StatusPill, Tabs } from '../components/ui'

type Filter = 'active' | 'past'

export default function OrdersPage() {
  const { profile } = useProfile()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('active')

  const load = useCallback(() => {
    setError('')
    api
      .orders()
      .then((data) => {
        const mine = profile.phone
          ? data.orders.filter((order) => order.phone === profile.phone)
          : data.orders
        setOrders(mine)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [profile.phone])

  useEffect(() => {
    load()
  }, [load])

  const active = orders.filter((order) => isActive(order.status))
  const past = orders.filter((order) => !isActive(order.status))
  const visible = filter === 'active' ? active : past

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-20 border-b border-ink-300/60 bg-cream/95 px-4 pb-2.5 pt-3 backdrop-blur pt-safe">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold leading-tight text-ink-900">My orders</h1>
            <p className="text-[11px] text-ink-500">
              {profile.phone ? `For ${profile.phone}` : 'All recent orders on this device'}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink-700 ring-1 ring-ink-300"
          >
            Refresh
          </button>
        </div>
        <div className="mt-2.5">
          <Tabs
            tabs={[
              { id: 'active', label: 'Active', badge: active.length },
              { id: 'past', label: 'Past', badge: past.length },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </div>

      <div className="px-4 pt-4">
        {error && (
          <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        )}

        {loading ? (
          <Spinner label="Loading your orders" />
        ) : visible.length === 0 ? (
          <EmptyState
            emoji={filter === 'active' ? '🛵' : '📜'}
            title={filter === 'active' ? 'No active orders' : 'No past orders yet'}
            body={
              filter === 'active'
                ? 'Order something delicious and track it live here.'
                : 'Your delivered orders will show up here.'
            }
            action={
              <Link to="/" className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">
                Order food
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {visible.map((order) => (
              <Link
                key={order.id}
                to={`/track/${order.id}`}
                className="block rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-black/5 active:bg-brand-50/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">{order.restaurant_name}</p>
                    <p className="text-[11px] text-ink-500">
                      #{order.code} • {timeAgo(order.created_at)}
                    </p>
                  </div>
                  <StatusPill status={order.status} />
                </div>

                <p className="mt-2 line-clamp-1 text-xs text-ink-700">
                  {order.items.map((line) => `${line.qty}× ${line.name}`).join(', ')}
                </p>

                <div className="mt-2 flex items-center justify-between border-t border-ink-300/40 pt-2">
                  <p className="text-xs font-bold text-ink-900">{inr(order.total)}</p>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-700">
                    {isActive(order.status) ? 'Track order' : STATUS_LABEL[order.status]}
                    <Icon.Back className="h-3.5 w-3.5 rotate-180" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <section className="mt-6">
          <SectionTitle>Need help?</SectionTitle>
          <div className="rounded-2xl bg-white p-4 text-xs leading-relaxed text-ink-700 shadow-card ring-1 ring-black/5">
            Call the Swad MH13 helpline at <strong className="text-ink-900">+91 90000 00013</strong>{' '}
            for order issues, refunds or rider support.
          </div>
        </section>
      </div>
    </div>
  )
}
