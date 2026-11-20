import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Alert, Button, Card, EmptyState, Spinner, Stat, StatusPill } from '../components/kit'
import { PaymentSheet } from '../components/PaymentSheet'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { inr, orderTotal, timeAgo } from '../lib/format'
import type { Order, OrderStatus } from '../lib/types'

export default function RiderDashboard() {
  const { role, profile } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [payId, setPayId] = useState<string | null>(null)
  // false when the database still lacks orders.rider_id (migration not run yet)
  const [riderReady, setRiderReady] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.rider.orders()
      setOrders(result.orders)
      setRiderReady(result.riderAssignmentReady !== false)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load your deliveries.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'rider') void load()
    else setLoading(false)
  }, [role, load])

  const setStatus = async (order: Order, status: OrderStatus) => {
    setBusyId(order.id)
    setError(null)
    try {
      const result = await api.rider.setStatus(order.id, status)
      setOrders((current) => current.map((entry) => (entry.id === order.id ? result.order : entry)))
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update the delivery.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Spinner label="Loading your deliveries…" />
      </AppShell>
    )
  }

  if (role !== 'rider') {
    return (
      <AppShell>
        <Alert tone="warning">This dashboard is for rider accounts.</Alert>
      </AppShell>
    )
  }

  const active = orders.filter((order) => order.order_status === 'out_for_delivery')
  const ready = orders.filter((order) => order.order_status === 'ready')
  const done = orders.filter((order) => order.order_status === 'delivered')

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Deliveries</h1>
          <p className="text-xs text-slate-500">
            {profile?.full_name ? `${profile.full_name} · ` : ''}only orders assigned to you
          </p>
        </div>

        {error && (
          <Alert tone="error">
            {error}{' '}
            <button type="button" onClick={() => void load()} className="font-bold underline">
              Retry
            </button>
          </Alert>
        )}

        {riderReady === false && (
          <Alert tone="warning">
            Rider assignment is not switched on in the database yet, so no deliveries can reach
            you. An administrator needs to run the SQL in
            supabase/migrations/20261120000000_swad_mh13_auth.sql once.
          </Alert>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Ready" value={ready.length} />
          <Stat label="On the way" value={active.length} />
          <Stat label="Delivered" value={done.length} />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Assigned to you</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-bold text-orange-700 hover:underline"
          >
            Refresh
          </button>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            title="No deliveries assigned"
            message={
              riderReady === false
                ? 'Rider assignment is waiting for the database migration. Nothing is lost — your account is ready.'
                : 'An administrator assigns orders to you once they are ready for pickup.'
            }
          />
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <Card key={order.id} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-slate-900">
                      {order.restaurants?.name || 'Restaurant'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {timeAgo(order.created_at)} · {inr(orderTotal(order))} ·{' '}
                      {order.payment_method?.toUpperCase() || 'COD'}
                    </p>
                  </div>
                  <StatusPill status={order.order_status} />
                </div>

                <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                  <p className="font-bold text-slate-900">Deliver to</p>
                  <p>{order.delivery_address || 'Address shared by the restaurant'}</p>
                </div>

                {order.payment_status !== 'paid' && (
                  <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-800">
                    <p>
                      Collect {inr(orderTotal(order))} (
                      {order.payment_method === 'online'
                        ? 'UPI QR'
                        : order.payment_method === 'upi'
                          ? 'UPI'
                          : 'cash'}
                      ) on delivery
                    </p>
                    {(order.payment_method === 'upi' || order.payment_method === 'online') && (
                      <button
                        type="button"
                        onClick={() => setPayId(order.id)}
                        className="mt-1 underline decoration-amber-700"
                      >
                        Show payment QR
                      </button>
                    )}
                  </div>
                )}

                {order.notes && (
                  <p className="text-[11px] text-slate-600">
                    <span className="font-bold">Note:</span> {order.notes}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {order.order_status === 'ready' && (
                    <Button
                      size="sm"
                      loading={busyId === order.id}
                      onClick={() => void setStatus(order, 'out_for_delivery')}
                    >
                      Start delivery
                    </Button>
                  )}
                  {order.order_status === 'out_for_delivery' && (
                    <Button
                      size="sm"
                      loading={busyId === order.id}
                      onClick={() => void setStatus(order, 'delivered')}
                    >
                      Mark delivered
                    </Button>
                  )}
                  {order.order_status === 'delivered' && (
                    <p className="text-[11px] font-bold text-emerald-700">Completed</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PaymentSheet
        open={Boolean(payId)}
        orderId={payId}
        onClose={() => setPayId(null)}
        onPaid={() => void load()}
      />
    </AppShell>
  )
}
