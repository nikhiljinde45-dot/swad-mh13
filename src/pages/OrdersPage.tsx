import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Alert, Button, Card, EmptyState, Spinner, StatusPill, cx } from '../components/kit'
import { PaymentSheet } from '../components/PaymentSheet'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { inr, orderTotal, timeAgo } from '../lib/format'
import type { Order, OrderStatus } from '../lib/types'

const FLOW: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered']

export default function OrdersPage() {
  const { user, role } = useAuth()
  const [params] = useSearchParams()
  const placed = params.get('placed')
  const payOrder = params.get('pay')
  const [orders, setOrders] = useState<Order[]>([])
  const [openId, setOpenId] = useState<string | null>(placed ?? payOrder)
  const [payId, setPayId] = useState<string | null>(payOrder)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.orders()
      setOrders(result.orders)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load your orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void load()
  }, [user, load])

  if (!user) {
    return (
      <AppShell>
        <EmptyState
          title="Sign in to see your orders"
          message="Your order history lives in your account."
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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-slate-900">Your orders</h1>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-bold text-orange-700 hover:underline"
          >
            Refresh
          </button>
        </div>

        {placed && <Alert tone="success">Order placed! The restaurant will confirm it shortly.</Alert>}
        {role && role !== 'customer' && (
          <Alert tone="info">You are viewing orders as staff. Only your own orders are listed here.</Alert>
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
          <Spinner label="Loading orders…" />
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            message="Your first order will appear here with live status."
            action={
              <Link to="/">
                <Button>Order something</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {orders.map((order) => {
              const open = openId === order.id
              const stepIndex = FLOW.indexOf(order.order_status)
              return (
                <Card key={order.id} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : order.id)}
                    className="flex w-full items-start justify-between gap-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-900">
                        {order.restaurants?.name || 'Restaurant'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {timeAgo(order.created_at)} · {order.order_items?.length ?? 0} item
                        {(order.order_items?.length ?? 0) === 1 ? '' : 's'} · {inr(orderTotal(order))}
                      </p>
                    </div>
                    <StatusPill status={order.order_status} />
                  </button>

                  {open && (
                    <div className="space-y-3 border-t border-dashed border-slate-200 pt-3">
                      <div className="space-y-1">
                        {(order.order_items ?? []).map((line, index) => (
                          <div
                            key={line.id ?? `${line.menu_item_id}-${index}`}
                            className="flex justify-between text-sm text-slate-700"
                          >
                            <span className="truncate pr-2">
                              {line.quantity} × {line.item_name}
                            </span>
                            <span className="shrink-0 font-semibold">
                              {inr(line.unit_price * line.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5 text-sm font-extrabold text-slate-900">
                        <span>Total</span>
                        <span>{inr(orderTotal(order))}</span>
                      </div>

                      {order.delivery_address && (
                        <p className="text-xs text-slate-600">
                          <span className="font-bold">Delivering to:</span> {order.delivery_address}
                        </p>
                      )}

                      <p className="text-xs text-slate-600">
                        <span className="font-bold">Payment:</span>{' '}
                        {order.payment_method === 'upi'
                          ? 'UPI on delivery'
                          : order.payment_method === 'online'
                            ? 'Online UPI'
                            : 'Cash on delivery'}{' '}
                        ·{' '}
                        {order.payment_status === 'paid'
                          ? 'Paid'
                          : order.payment_method === 'online'
                            ? `${inr(orderTotal(order))} due — pay by UPI QR`
                            : `Pay ${inr(orderTotal(order))} on delivery`}
                      </p>

                      {order.payment_status !== 'paid' &&
                        order.payment_method !== 'cod' &&
                        !['cancelled', 'rejected'].includes(order.order_status) && (
                          <Button size="sm" onClick={() => setPayId(order.id)}>
                            Pay {inr(orderTotal(order))} by UPI QR
                          </Button>
                        )}

                      {order.notes && (
                        <p className="text-xs text-slate-600">
                          <span className="font-bold">Note:</span> {order.notes}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-1">
                        {FLOW.map((status, index) => (
                          <span
                            key={status}
                            className={cx(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                              order.order_status === 'cancelled' || order.order_status === 'rejected'
                                ? 'bg-slate-100 text-slate-400'
                                : index <= stepIndex
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-400',
                            )}
                          >
                            {status.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>

                      {order.rider_id && (
                        <p className="text-xs text-slate-600">
                          <span className="font-bold">Rider assigned</span> — tracking starts when the
                          order leaves the kitchen.
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <PaymentSheet
        open={Boolean(payId)}
        orderId={payId}
        allowClaim
        onClose={() => setPayId(null)}
        onPaid={() => void load()}
      />
    </AppShell>
  )
}
