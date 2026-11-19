import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { inr, isActive, timeAgo } from '../lib/format'
import { useToast } from '../lib/app-state'
import type { Order, Rider, RiderStatus } from '../lib/types'
import {
  Button,
  EmptyState,
  Icon,
  SectionTitle,
  Spinner,
  StatusPill,
  Tabs,
} from '../components/ui'

const RIDER_KEY = 'swad.rider.v1'

const STATUS_TONE: Record<RiderStatus, string> = {
  online: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  busy: 'bg-amber-50 text-amber-700 ring-amber-200',
  offline: 'bg-ink-900/5 text-ink-500 ring-ink-300',
}

export default function RiderPanel() {
  const { notify } = useToast()
  const [riders, setRiders] = useState<Rider[]>([])
  const [riderId, setRiderId] = useState(() => {
    try {
      return localStorage.getItem(RIDER_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [orders, setOrders] = useState<Order[]>([])
  const [available, setAvailable] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'available' | 'done'>('active')
  const [busy, setBusy] = useState('')

  const rider = useMemo(() => riders.find((row) => row.id === riderId) ?? null, [riders, riderId])

  const loadOrders = useCallback(async () => {
    try {
      const [mine, ready] = await Promise.all([
        api.orders(riderId ? { rider_id: riderId } : {}),
        api.orders({ status: 'ready' }),
      ])
      setOrders(riderId ? mine.orders : [])
      setAvailable(ready.orders.filter((order) => !order.rider_id))
    } catch (err) {
      notify((err as Error).message, 'error')
    }
  }, [riderId, notify])

  useEffect(() => {
    api
      .riders()
      .then((data) => {
        setRiders(data.riders)
        setRiderId((current) => current || data.riders[0]?.id || '')
      })
      .catch((err: Error) => notify(err.message, 'error'))
      .finally(() => setLoading(false))
  }, [notify])

  useEffect(() => {
    if (!riders.length) return
    loadOrders()
    const timer = window.setInterval(loadOrders, 10000)
    return () => window.clearInterval(timer)
  }, [loadOrders, riders.length])

  const selectRider = (id: string) => {
    setRiderId(id)
    try {
      localStorage.setItem(RIDER_KEY, id)
    } catch {
      /* ignore */
    }
  }

  const setStatus = async (status: RiderStatus) => {
    if (!rider) return
    setBusy('status')
    try {
      const { rider: updated } = await api.updateRider(rider.id, { status })
      setRiders((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      notify(`You are now ${status}`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const claim = async (order: Order) => {
    if (!rider) return
    setBusy(order.id)
    try {
      await api.updateOrder(order.id, { rider_id: rider.id })
      await api.updateRider(rider.id, { status: 'busy' })
      setRiders((prev) => prev.map((row) => (row.id === rider.id ? { ...row, status: 'busy' } : row)))
      notify(`Order #${order.code} assigned to you`)
      await loadOrders()
      setTab('active')
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const advance = async (order: Order) => {
    setBusy(order.id)
    const next = order.status === 'ready' ? 'out_for_delivery' : 'delivered'
    try {
      await api.updateOrder(order.id, { status: next })
      if (next === 'delivered' && rider) {
        await api.updateRider(rider.id, { status: 'online' })
        setRiders((prev) =>
          prev.map((row) =>
            row.id === rider.id ? { ...row, status: 'online', deliveries: row.deliveries + 1 } : row,
          ),
        )
      }
      notify(next === 'delivered' ? 'Delivery completed 🎉' : 'Order picked up — ride safe!')
      await loadOrders()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const activeOrders = orders.filter((order) => isActive(order.status))
  const doneOrders = orders.filter((order) => !isActive(order.status))
  const visible = tab === 'active' ? activeOrders : tab === 'available' ? available : doneOrders

  const earnings = doneOrders.filter((order) => order.status === 'delivered').length * 25

  if (loading) return <Spinner label="Loading rider console" />

  if (!riders.length) {
    return (
      <EmptyState
        emoji="🛵"
        title="No riders yet"
        body="An admin can add riders from the Admin Console."
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Rider identity + duty status */}
      <section className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-black/5">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-500">
            Signed in as rider
          </span>
          <select
            value={riderId}
            onChange={(event) => selectRider(event.target.value)}
            className="w-full rounded-xl border border-ink-300 bg-white px-3 py-2.5 text-sm font-semibold text-ink-900 outline-none focus:border-brand-400"
          >
            {riders.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} — {row.area}
              </option>
            ))}
          </select>
        </label>

        {rider && (
          <>
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-ink-900/[0.03] p-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-base font-bold text-emerald-700">
                {rider.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">{rider.name}</p>
                <p className="text-[11px] text-ink-500">
                  {rider.vehicle} • {rider.area} • ⭐ {rider.rating.toFixed(1)}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${STATUS_TONE[rider.status]}`}
              >
                {rider.status}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['online', 'busy', 'offline'] as RiderStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={busy === 'status'}
                  onClick={() => setStatus(status)}
                  aria-pressed={rider.status === status}
                  className={`rounded-xl px-2 py-2 text-[11px] font-bold capitalize transition ${
                    rider.status === status
                      ? 'bg-ink-900 text-white'
                      : 'bg-white text-ink-700 ring-1 ring-ink-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Active', value: activeOrders.length, emoji: '📦' },
          { label: 'Completed', value: rider?.deliveries ?? 0, emoji: '✅' },
          { label: 'Earnings', value: inr(earnings), emoji: '💰' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-white p-3 text-center shadow-card ring-1 ring-black/5">
            <span className="text-base" aria-hidden>
              {stat.emoji}
            </span>
            <p className="mt-0.5 text-sm font-extrabold text-ink-900">{stat.value}</p>
            <p className="text-[10px] text-ink-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <Tabs
        tabs={[
          { id: 'active', label: 'My deliveries', badge: activeOrders.length },
          { id: 'available', label: 'Ready to pick', badge: available.length },
          { id: 'done', label: 'History', badge: doneOrders.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <SectionTitle>
            {tab === 'active' ? 'Assigned to you' : tab === 'available' ? 'Waiting for a rider' : 'Completed'}
          </SectionTitle>
          <button
            type="button"
            onClick={loadOrders}
            className="mb-3 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink-700 ring-1 ring-ink-300"
          >
            Refresh
          </button>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            emoji={tab === 'available' ? '🍱' : '🛵'}
            title={
              tab === 'active'
                ? 'No deliveries assigned'
                : tab === 'available'
                  ? 'No packed orders nearby'
                  : 'No completed deliveries yet'
            }
            body={
              tab === 'active'
                ? 'Claim a packed order from “Ready to pick”.'
                : tab === 'available'
                  ? 'Orders marked ready by restaurants show up here.'
                  : 'Delivered orders will be listed here.'
            }
          />
        ) : (
          visible.map((order) => (
            <div key={order.id} className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink-900">#{order.code}</p>
                  <p className="text-[11px] text-ink-500">
                    {order.restaurant_name} • {timeAgo(order.created_at)}
                  </p>
                </div>
                <StatusPill status={order.status} />
              </div>

              <div className="mt-2.5 space-y-1.5 rounded-xl bg-ink-900/[0.03] p-2.5 text-[11px]">
                <p className="flex items-start gap-1.5 text-ink-700">
                  <Icon.Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                  <span>
                    <strong className="text-ink-900">Drop:</strong> {order.address}
                  </span>
                </p>
                <p className="flex items-start gap-1.5 text-ink-700">
                  <Icon.Bike className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
                  <span>
                    <strong className="text-ink-900">Customer:</strong> {order.customer_name} •{' '}
                    {order.phone}
                  </span>
                </p>
                <p className="text-ink-500">
                  {order.items.reduce((sum, line) => sum + line.qty, 0)} items •{' '}
                  {order.payment_method === 'cod' ? `Collect ${inr(order.total)} cash` : 'Prepaid via UPI'}
                </p>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {tab === 'available' && (
                  <Button size="sm" loading={busy === order.id} onClick={() => claim(order)}>
                    Accept delivery
                  </Button>
                )}

                {tab === 'active' && order.status === 'ready' && (
                  <Button size="sm" loading={busy === order.id} onClick={() => advance(order)}>
                    Picked up — start delivery
                  </Button>
                )}

                {tab === 'active' && order.status === 'out_for_delivery' && (
                  <Button size="sm" loading={busy === order.id} onClick={() => advance(order)}>
                    Mark delivered
                  </Button>
                )}

                {tab === 'active' && order.status === 'delivered' && (
                  <p className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
                    Delivery completed
                  </p>
                )}

                {tab === 'active' && (order.status === 'placed' || order.status === 'accepted' || order.status === 'preparing') && (
                  <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
                    Restaurant is still preparing this order
                  </p>
                )}

                <a
                  href={`tel:${order.phone}`}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-ink-900 ring-1 ring-ink-300"
                >
                  Call customer
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="rounded-xl bg-brand-50 px-3 py-2 text-[11px] leading-relaxed text-brand-800">
        Rider payouts in this demo are estimated at ₹25 per delivered order. Connect a payment
        provider in Supabase for real payouts.
      </p>
    </div>
  )
}
