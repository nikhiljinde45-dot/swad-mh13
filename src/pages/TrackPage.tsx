import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import {
  clockTime,
  inr,
  isActive,
  ORDER_FLOW,
  STATUS_HINT,
  STATUS_LABEL,
  timeAgo,
} from '../lib/format'
import type { Order } from '../lib/types'
import { Button, EmptyState, Icon, Spinner, StatusPill } from '../components/ui'

export default function TrackPage() {
  const { id = '' } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      else setRefreshing(true)
      try {
        const data = await api.order(id)
        setOrder(data.order)
        setError('')
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [id],
  )

  useEffect(() => {
    load()
  }, [load])

  // Poll while the order is still in progress.
  useEffect(() => {
    if (!order || !isActive(order.status)) return
    const timer = window.setInterval(() => load(true), 8000)
    return () => window.clearInterval(timer)
  }, [order, load])

  if (loading) return <Spinner label="Loading order" />

  if (error || !order) {
    return (
      <div className="px-4 py-10">
        <EmptyState
          emoji="🧾"
          title="Order not found"
          body={error || 'This order may have been removed.'}
          action={
            <Link to="/orders" className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">
              Back to orders
            </Link>
          }
        />
      </div>
    )
  }

  const stepIndex = order.status === 'cancelled' ? -1 : ORDER_FLOW.indexOf(order.status)
  const cancelled = order.status === 'cancelled'
  const delivered = order.status === 'delivered'

  return (
    <div className="pb-10">
      <div className="sticky top-0 z-20 border-b border-ink-300/60 bg-cream/95 px-4 py-3 backdrop-blur pt-safe">
        <div className="flex items-center gap-2">
          <Link to="/orders" aria-label="Back to orders" className="grid h-9 w-9 place-items-center rounded-xl bg-white ring-1 ring-ink-300">
            <Icon.Back />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-extrabold leading-tight text-ink-900">
              Order #{order.code}
            </h1>
            <p className="text-[11px] text-ink-500">
              {order.restaurant_name} • {timeAgo(order.created_at)}
            </p>
          </div>
          <StatusPill status={order.status} />
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4">
        {/* Live status card */}
        <section
          className={`relative overflow-hidden rounded-3xl p-4 text-white shadow-card ${
            cancelled
              ? 'bg-gradient-to-br from-rose-600 to-rose-800'
              : delivered
                ? 'bg-gradient-to-br from-emerald-600 to-teal-700'
                : 'bg-gradient-to-br from-ink-900 via-ink-900 to-brand-800'
          }`}
        >
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
            {cancelled ? 'Cancelled' : delivered ? 'Completed' : 'Live tracking'}
          </p>
          <h2 className="mt-1 text-xl font-extrabold leading-tight">
            {cancelled ? 'Order cancelled' : STATUS_LABEL[order.status]}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-white/75">{STATUS_HINT[order.status]}</p>
          {!cancelled && !delivered && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold ring-1 ring-white/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Auto-refreshing every 8s
            </p>
          )}
        </section>

        {/* Progress timeline */}
        {!cancelled && (
          <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
            <ol className="space-y-0">
              {ORDER_FLOW.map((status, index) => {
                const done = index <= stepIndex
                const current = index === stepIndex
                const last = index === ORDER_FLOW.length - 1
                return (
                  <li key={status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                          done
                            ? 'bg-emerald-500 text-white'
                            : 'bg-ink-900/5 text-ink-500 ring-1 ring-ink-300'
                        }`}
                      >
                        {done ? <Icon.Check className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      {!last && (
                        <span
                          className={`my-0.5 w-0.5 flex-1 rounded ${done ? 'bg-emerald-400' : 'bg-ink-300'}`}
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className={`pb-4 ${last ? 'pb-0' : ''}`}>
                      <p
                        className={`text-xs font-bold ${
                          current ? 'text-brand-700' : done ? 'text-ink-900' : 'text-ink-500'
                        }`}
                      >
                        {STATUS_LABEL[status]}
                      </p>
                      <p className="text-[10px] text-ink-500">
                        {done
                          ? index === stepIndex
                            ? `Updated ${clockTime(order.updated_at)}`
                            : 'Done'
                          : 'Pending'}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {/* Rider */}
        <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900">Delivery partner</h3>
            <Icon.Bike className="h-5 w-5 text-brand-600" />
          </div>
          {order.rider_name ? (
            <div className="mt-2 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {order.rider_name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{order.rider_name}</p>
                <p className="text-[11px] text-ink-500">Assigned to your order</p>
              </div>
              {order.rider_phone && (
                <a
                  href={`tel:${order.rider_phone}`}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white"
                >
                  Call
                </a>
              )}
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-ink-500">
              A rider will be assigned once the restaurant packs your food.
            </p>
          )}
        </section>

        {/* Items */}
        <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
          <h3 className="text-sm font-bold text-ink-900">Your items</h3>
          <ul className="mt-2 space-y-1.5 text-xs">
            {order.items.map((line) => (
              <li key={line.menu_item_id} className="flex justify-between gap-2 text-ink-700">
                <span className="min-w-0 truncate">
                  <span className="font-bold text-ink-900">{line.qty}×</span> {line.name}
                </span>
                <span className="shrink-0 font-semibold">{inr(line.price * line.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t border-dashed border-ink-300 pt-2.5 text-xs">
            <div className="flex justify-between text-ink-700">
              <span>Item total</span>
              <span>{inr(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink-700">
              <span>Delivery</span>
              <span>{order.delivery_fee === 0 ? 'FREE' : inr(order.delivery_fee)}</span>
            </div>
            <div className="flex justify-between pt-1 text-sm font-extrabold text-ink-900">
              <span>Total ({order.payment_method === 'cod' ? 'Cash' : 'UPI'})</span>
              <span>{inr(order.total)}</span>
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
          <h3 className="text-sm font-bold text-ink-900">Delivering to</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-700">{order.address}</p>
          <p className="mt-1 text-[11px] text-ink-500">
            {order.customer_name} • {order.phone}
          </p>
          {order.notes && (
            <p className="mt-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] text-brand-800">
              Note: {order.notes}
            </p>
          )}
        </section>

        <div className="flex gap-2">
          <Button variant="secondary" full onClick={() => load(true)} loading={refreshing}>
            Refresh status
          </Button>
          <Link
            to="/"
            className="flex w-full items-center justify-center rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Order again
          </Link>
        </div>
      </div>
    </div>
  )
}
