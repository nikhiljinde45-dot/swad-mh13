import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { clockTime, inr, isActive, ORDER_FLOW, STATUS_LABEL, timeAgo } from '../lib/format'
import { useToast } from '../lib/app-state'
import type { AdminStats, Customer, Order, OrderStatus, Restaurant, Rider } from '../lib/types'
import {
  Button,
  EmptyState,
  Field,
  Icon,
  SectionTitle,
  Sheet,
  Spinner,
  StatusPill,
  Tabs,
  Toggle,
} from '../components/ui'

type Tab = 'orders' | 'restaurants' | 'riders' | 'customers'

const EMPTY_RIDER = { name: '', phone: '', area: '', vehicle: 'Bike' }

export default function AdminPanel() {
  const { notify } = useToast()
  const [tab, setTab] = useState<Tab>('orders')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [riders, setRiders] = useState<Rider[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  // rider creation
  const [riderSheet, setRiderSheet] = useState(false)
  const [riderDraft, setRiderDraft] = useState({ ...EMPTY_RIDER })
  const [savingRider, setSavingRider] = useState(false)

  // restaurant editing
  const [editRestaurant, setEditRestaurant] = useState<Restaurant | null>(null)
  const [restDraft, setRestDraft] = useState({ name: '', cuisine: '', area: '', delivery_fee: '', min_order: '' })
  const [savingRest, setSavingRest] = useState(false)

  const loadAll = useCallback(
    async (quiet = false) => {
      try {
        const [statsRes, ordersRes, restRes, ridersRes, customersRes] = await Promise.all([
          api.stats(),
          api.orders(),
          api.restaurants(),
          api.riders(),
          api.customers(),
        ])
        setStats(statsRes.stats)
        setOrders(ordersRes.orders)
        setRestaurants(restRes.restaurants)
        setRiders(ridersRes.riders)
        setCustomers(customersRes.customers)
      } catch (err) {
        if (!quiet) notify((err as Error).message, 'error')
      } finally {
        setLoading(false)
      }
    },
    [notify],
  )

  useEffect(() => {
    loadAll()
    const timer = window.setInterval(() => loadAll(true), 15000)
    return () => window.clearInterval(timer)
  }, [loadAll])

  const activeOrders = useMemo(() => orders.filter((order) => isActive(order.status)), [orders])

  /* ---------------------------- actions ---------------------------- */

  const patchOrder = async (order: Order, patch: { status?: OrderStatus; rider_id?: string | null }) => {
    setBusy(order.id)
    try {
      const { order: updated } = await api.updateOrder(order.id, patch)
      setOrders((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      notify(`Order #${order.code} updated`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const nextStatuses = (status: OrderStatus): OrderStatus[] => {
    const index = ORDER_FLOW.indexOf(status)
    if (index < 0 || index === ORDER_FLOW.length - 1) return []
    return [ORDER_FLOW[index + 1] as OrderStatus, 'cancelled']
  }

  const toggleRestaurant = async (restaurant: Restaurant, next: boolean) => {
    setBusy(restaurant.id)
    try {
      const { restaurant: updated } = await api.updateRestaurant(restaurant.id, { is_open: next })
      setRestaurants((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      notify(`${updated.name} is ${next ? 'open' : 'closed'}`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const openRestaurantEditor = (restaurant: Restaurant) => {
    setEditRestaurant(restaurant)
    setRestDraft({
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      area: restaurant.area,
      delivery_fee: String(restaurant.delivery_fee),
      min_order: String(restaurant.min_order),
    })
  }

  const saveRestaurant = async () => {
    if (!editRestaurant) return
    setSavingRest(true)
    try {
      const { restaurant: updated } = await api.updateRestaurant(editRestaurant.id, {
        name: restDraft.name.trim(),
        cuisine: restDraft.cuisine.trim(),
        area: restDraft.area.trim(),
        delivery_fee: Number(restDraft.delivery_fee) || 0,
        min_order: Number(restDraft.min_order) || 0,
      })
      setRestaurants((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      notify('Restaurant updated')
      setEditRestaurant(null)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setSavingRest(false)
    }
  }

  const addRider = async () => {
    if (!riderDraft.name.trim() || !riderDraft.phone.trim() || !riderDraft.area.trim()) {
      return notify('Name, phone and area are required', 'error')
    }
    setSavingRider(true)
    try {
      const { rider } = await api.createRider({
        name: riderDraft.name.trim(),
        phone: riderDraft.phone.trim(),
        area: riderDraft.area.trim(),
        vehicle: riderDraft.vehicle.trim() || 'Bike',
      })
      setRiders((prev) => [...prev, rider])
      setRiderSheet(false)
      setRiderDraft({ ...EMPTY_RIDER })
      notify(`${rider.name} added as a rider`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setSavingRider(false)
    }
  }

  const setRiderStatus = async (rider: Rider, status: Rider['status']) => {
    try {
      const { rider: updated } = await api.updateRider(rider.id, { status })
      setRiders((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
    } catch (err) {
      notify((err as Error).message, 'error')
    }
  }

  const removeRider = async (rider: Rider) => {
    if (!window.confirm(`Remove rider ${rider.name}?`)) return
    try {
      await api.deleteRider(rider.id)
      setRiders((prev) => prev.filter((row) => row.id !== rider.id))
      notify('Rider removed')
    } catch (err) {
      notify((err as Error).message, 'error')
    }
  }

  const toggleBlocked = async (customer: Customer, next: boolean) => {
    try {
      const { customer: updated } = await api.updateCustomer(customer.id, { is_blocked: next })
      setCustomers((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      notify(next ? `${updated.name} blocked` : `${updated.name} unblocked`)
    } catch (err) {
      notify((err as Error).message, 'error')
    }
  }

  const removeCustomer = async (customer: Customer) => {
    if (!window.confirm(`Delete customer ${customer.name}? Their past orders are kept.`)) return
    try {
      await api.deleteCustomer(customer.id)
      setCustomers((prev) => prev.filter((row) => row.id !== customer.id))
      notify('Customer deleted')
    } catch (err) {
      notify((err as Error).message, 'error')
    }
  }

  if (loading) return <Spinner label="Loading admin console" />

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Live orders', value: stats?.active_orders ?? 0, emoji: '📦' },
          { label: 'Revenue', value: inr(stats?.revenue ?? 0), emoji: '💵' },
          { label: 'Restaurants', value: `${stats?.open_restaurants ?? 0}/${stats?.restaurants ?? 0}`, emoji: '🏪' },
          { label: 'Riders online', value: `${stats?.online_riders ?? 0}/${stats?.riders ?? 0}`, emoji: '🛵' },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-3 shadow-card ring-1 ring-black/5">
            <span className="text-base" aria-hidden>
              {card.emoji}
            </span>
            <p className="mt-0.5 text-base font-extrabold text-ink-900">{card.value}</p>
            <p className="text-[10px] text-ink-500">{card.label}</p>
          </div>
        ))}
      </div>

      <Tabs
        tabs={[
          { id: 'orders', label: 'Orders', badge: activeOrders.length },
          { id: 'restaurants', label: 'Restaurants', badge: restaurants.length },
          { id: 'riders', label: 'Riders', badge: riders.length },
          { id: 'customers', label: 'Customers', badge: customers.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Orders */}
      {tab === 'orders' && (
        <div className="space-y-3">
          <SectionTitle>All orders ({orders.length})</SectionTitle>
          {orders.length === 0 ? (
            <EmptyState emoji="🧾" title="No orders yet" body="Customer orders will appear here." />
          ) : (
            orders.map((order) => (
              <div key={order.id} className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink-900">
                      #{order.code} • {inr(order.total)}
                    </p>
                    <p className="text-[11px] text-ink-500">
                      {order.restaurant_name} → {order.customer_name}
                    </p>
                    <p className="text-[10px] text-ink-500">
                      {timeAgo(order.created_at)} • {order.payment_method === 'cod' ? 'COD' : 'UPI'}
                    </p>
                  </div>
                  <StatusPill status={order.status} />
                </div>

                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-500">
                      Assigned rider
                    </span>
                    <select
                      value={order.rider_id ?? ''}
                      onChange={(event) =>
                        patchOrder(order, { rider_id: event.target.value || null })
                      }
                      className="w-full rounded-xl border border-ink-300 bg-white px-2.5 py-2 text-xs font-semibold text-ink-900 outline-none focus:border-brand-400"
                    >
                      <option value="">Unassigned</option>
                      {riders.map((rider) => (
                        <option key={rider.id} value={rider.id}>
                          {rider.name} ({rider.status})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-500">
                      Move to status
                    </span>
                    <select
                      value=""
                      onChange={(event) => {
                        if (event.target.value) patchOrder(order, { status: event.target.value as OrderStatus })
                      }}
                      className="w-full rounded-xl border border-ink-300 bg-white px-2.5 py-2 text-xs font-semibold text-ink-900 outline-none focus:border-brand-400"
                    >
                      <option value="">Keep “{STATUS_LABEL[order.status]}”</option>
                      {nextStatuses(order.status).map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
                  {order.address}
                  {order.rider_name ? ` • Rider: ${order.rider_name}` : ''}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a
                    href={`tel:${order.phone}`}
                    className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink-900 ring-1 ring-ink-300"
                  >
                    Call customer
                  </a>
                  {busy === order.id && <span className="text-[10px] text-ink-500">Saving…</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Restaurants */}
      {tab === 'restaurants' && (
        <div className="space-y-3">
          <SectionTitle>Restaurants ({restaurants.length})</SectionTitle>
          {restaurants.map((restaurant) => (
            <div key={restaurant.id} className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink-900">{restaurant.name}</p>
                  <p className="text-[11px] text-ink-500">
                    {restaurant.cuisine} • {restaurant.area} • ⭐ {restaurant.rating.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-ink-500">
                    {inr(restaurant.delivery_fee)} delivery • min {inr(restaurant.min_order)} •{' '}
                    {restaurant.delivery_minutes} min
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Toggle
                    checked={restaurant.is_open}
                    onChange={(next) => toggleRestaurant(restaurant, next)}
                    label={`${restaurant.name} accepting orders`}
                  />
                  <button
                    type="button"
                    onClick={() => openRestaurantEditor(restaurant)}
                    className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-bold text-brand-700"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Riders */}
      {tab === 'riders' && (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <SectionTitle>Riders ({riders.length})</SectionTitle>
            <Button size="sm" className="mb-3" onClick={() => setRiderSheet(true)}>
              <Icon.Plus className="h-3.5 w-3.5" /> Add rider
            </Button>
          </div>

          {riders.length === 0 ? (
            <EmptyState emoji="🛵" title="No riders yet" body="Add your first delivery partner." />
          ) : (
            riders.map((rider) => (
              <div key={rider.id} className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">{rider.name}</p>
                    <p className="text-[11px] text-ink-500">
                      {rider.phone} • {rider.area} • {rider.vehicle}
                    </p>
                    <p className="text-[10px] text-ink-500">
                      {rider.deliveries} deliveries • ⭐ {rider.rating.toFixed(1)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRider(rider)}
                    className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(['online', 'busy', 'offline'] as Rider['status'][]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setRiderStatus(rider, status)}
                      aria-pressed={rider.status === status}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-bold capitalize ${
                        rider.status === status ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-ink-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Customers */}
      {tab === 'customers' && (
        <div className="space-y-3">
          <SectionTitle>Customers ({customers.length})</SectionTitle>
          {customers.length === 0 ? (
            <EmptyState emoji="🧑" title="No customers yet" body="Customers appear after their first order." />
          ) : (
            customers.map((customer) => (
              <div key={customer.id} className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">
                      {customer.name}
                      {customer.is_blocked && (
                        <span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700">
                          Blocked
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-ink-500">
                      {customer.phone} • {customer.orders} orders
                    </p>
                    <p className="truncate text-[10px] text-ink-500">{customer.address || 'No address saved'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Toggle
                      checked={!customer.is_blocked}
                      onChange={(next) => toggleBlocked(customer, !next)}
                      label={`${customer.name} active`}
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomer(customer)}
                      className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] text-ink-500">
                  Joined {clockTime(customer.created_at)} • {customer.email || 'no email'}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add rider sheet */}
      <Sheet
        open={riderSheet}
        title="Add delivery rider"
        onClose={() => setRiderSheet(false)}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setRiderSheet(false)}>
              Cancel
            </Button>
            <Button full loading={savingRider} onClick={addRider}>
              Add rider
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field
            label="Full name"
            value={riderDraft.name}
            onChange={(e) => setRiderDraft({ ...riderDraft, name: e.target.value })}
            placeholder="Sagar Patil"
          />
          <Field
            label="Phone"
            value={riderDraft.phone}
            onChange={(e) => setRiderDraft({ ...riderDraft, phone: e.target.value })}
            inputMode="tel"
            placeholder="9876543210"
          />
          <Field
            label="Area"
            value={riderDraft.area}
            onChange={(e) => setRiderDraft({ ...riderDraft, area: e.target.value })}
            placeholder="Gadhinglaj"
          />
          <Field
            label="Vehicle"
            value={riderDraft.vehicle}
            onChange={(e) => setRiderDraft({ ...riderDraft, vehicle: e.target.value })}
            placeholder="Bike"
          />
        </div>
      </Sheet>

      {/* Edit restaurant sheet */}
      <Sheet
        open={Boolean(editRestaurant)}
        title={editRestaurant ? `Edit ${editRestaurant.name}` : 'Edit restaurant'}
        onClose={() => setEditRestaurant(null)}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setEditRestaurant(null)}>
              Cancel
            </Button>
            <Button full loading={savingRest} onClick={saveRestaurant}>
              Save changes
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field
            label="Restaurant name"
            value={restDraft.name}
            onChange={(e) => setRestDraft({ ...restDraft, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Cuisine"
              value={restDraft.cuisine}
              onChange={(e) => setRestDraft({ ...restDraft, cuisine: e.target.value })}
            />
            <Field
              label="Area"
              value={restDraft.area}
              onChange={(e) => setRestDraft({ ...restDraft, area: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Delivery fee ₹"
              value={restDraft.delivery_fee}
              onChange={(e) => setRestDraft({ ...restDraft, delivery_fee: e.target.value.replace(/\D/g, '') })}
              inputMode="numeric"
            />
            <Field
              label="Min order ₹"
              value={restDraft.min_order}
              onChange={(e) => setRestDraft({ ...restDraft, min_order: e.target.value.replace(/\D/g, '') })}
              inputMode="numeric"
            />
          </div>
        </div>
      </Sheet>
    </div>
  )
}
