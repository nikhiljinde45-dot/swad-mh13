import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  Stat,
  StatusPill,
  Thumb,
  cx,
} from '../components/kit'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { inr, orderTotal, timeAgo } from '../lib/format'
import type { AdminOverview, Order, Profile, Restaurant } from '../lib/types'

type Tab = 'overview' | 'restaurants' | 'people' | 'orders' | 'categories'

export default function AdminDashboard() {
  const { role } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.admin.overview())
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load the admin overview.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'admin') void load()
    else setLoading(false)
  }, [role, load])

  const approve = async (restaurant: Restaurant, active: boolean) => {
    setBusy(restaurant.id)
    setError(null)
    try {
      const reason = active
        ? undefined
        : window.prompt('Reason for rejection (shown to the owner)', 'Please complete your details') ||
          'Rejected by admin'
      await api.admin.setRestaurantActive(restaurant.id, active, reason)
      setNotice(active ? `${restaurant.name} approved.` : `${restaurant.name} rejected.`)
      await load()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update the restaurant.')
    } finally {
      setBusy(null)
    }
  }

  const setPerson = async (person: Profile, patch: { role?: Profile['role']; is_blocked?: boolean }) => {
    setBusy(person.id)
    setError(null)
    try {
      await api.admin.setProfile(person.id, patch)
      setNotice('Account updated.')
      await load()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update the account.')
    } finally {
      setBusy(null)
    }
  }

  const assignRider = async (order: Order, riderId: string) => {
    if (!riderId) return
    setBusy(order.id)
    setError(null)
    try {
      await api.admin.assignRider(order.id, riderId)
      setNotice('Rider assigned.')
      await load()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not assign the rider.')
    } finally {
      setBusy(null)
    }
  }

  const addCategory = async () => {
    if (newCategory.trim().length < 2) {
      setError('Enter a category name.')
      return
    }
    setBusy('new-category')
    setError(null)
    try {
      await api.admin.addCategory(newCategory.trim())
      setNewCategory('')
      setNotice('Category added.')
      await load()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not add the category.')
    } finally {
      setBusy(null)
    }
  }

  const removeCategory = async (id: string, name: string) => {
    if (!window.confirm(`Delete the category "${name}"?`)) return
    setBusy(id)
    setError(null)
    try {
      await api.admin.deleteCategory(id)
      setNotice('Category deleted.')
      await load()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not delete the category.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Spinner label="Loading admin data…" />
      </AppShell>
    )
  }

  if (role !== 'admin') {
    return (
      <AppShell>
        <Alert tone="warning">Administrator access only.</Alert>
      </AppShell>
    )
  }

  if (!data) {
    return (
      <AppShell>
        <Alert tone="error">
          {error || 'Could not load admin data.'}{' '}
          <button type="button" onClick={() => void load()} className="font-bold underline">
            Retry
          </button>
        </Alert>
      </AppShell>
    )
  }

  const riders = data.riders
  const assignable = data.orders.filter((order) =>
    ['ready', 'out_for_delivery'].includes(order.order_status),
  )

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-slate-900">Admin</h1>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-bold text-orange-700 hover:underline"
          >
            Refresh
          </button>
        </div>

        {notice && <Alert tone="success">{notice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}

        <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4">
          {(['overview', 'restaurants', 'people', 'orders', 'categories'] as Tab[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cx(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize transition-colors',
                tab === id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200',
              )}
            >
              {id}
              {id === 'restaurants' && data.counts.pending > 0 ? ` (${data.counts.pending})` : ''}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Restaurants" value={data.counts.restaurants} hint={`${data.counts.active_restaurants} live`} />
              <Stat label="Pending approval" value={data.counts.pending} />
              <Stat label="Customers" value={data.counts.customers} />
              <Stat label="Riders" value={data.counts.riders} />
              <Stat label="Orders" value={data.counts.orders} />
              <Stat label="Delivered revenue" value={inr(data.counts.revenue)} />
            </div>

            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Waiting for approval
            </p>
            {data.pending.length === 0 ? (
              <EmptyState title="Nothing pending" message="New restaurant registrations appear here." />
            ) : (
              data.pending.map((restaurant) => (
                <Card key={restaurant.id} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Thumb src={restaurant.image_url} alt={restaurant.name} className="h-12 w-12 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{restaurant.name}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {restaurant.address}
                        {restaurant.city ? `, ${restaurant.city}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" loading={busy === restaurant.id} onClick={() => void approve(restaurant, true)}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busy === restaurant.id}
                      onClick={() => void approve(restaurant, false)}
                    >
                      Reject
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'restaurants' && (
          <div className="space-y-2">
            {data.restaurants.length === 0 ? (
              <EmptyState title="No restaurants" message="Partner registrations will show here." />
            ) : (
              data.restaurants.map((restaurant) => (
                <Card key={restaurant.id} className="flex items-center gap-3">
                  <Thumb src={restaurant.image_url} alt={restaurant.name} className="h-12 w-12 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{restaurant.name}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {restaurant.city || 'No city'} · {restaurant.is_active ? 'Live' : 'Hidden'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={restaurant.is_active ? 'secondary' : 'primary'}
                    loading={busy === restaurant.id}
                    onClick={() => void approve(restaurant, !restaurant.is_active)}
                  >
                    {restaurant.is_active ? 'Unlist' : 'Approve'}
                  </Button>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'people' && (
          <div className="space-y-4">
            {(
              [
                ['Customers', data.customers],
                ['Riders', data.riders],
                ['Owners', data.owners],
                ['Admins', data.admins],
              ] as [string, Profile[]][]
            ).map(([label, people]) => (
              <div key={label} className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {label} ({people.length})
                </p>
                {people.length === 0 ? (
                  <p className="text-xs text-slate-400">Nobody here yet.</p>
                ) : (
                  people.map((person) => (
                    <Card key={person.id} className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {person.full_name || 'Unnamed'}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {person.email || 'No email'} {person.phone ? `· ${person.phone}` : ''}
                          </p>
                        </div>
                        <span
                          className={cx(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1',
                            person.is_blocked
                              ? 'bg-rose-100 text-rose-700 ring-rose-200'
                              : 'bg-slate-100 text-slate-600 ring-slate-200',
                          )}
                        >
                          {person.is_blocked ? 'Blocked' : person.role}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {person.role !== 'admin' && (
                          <Select
                            className="max-w-32 py-1 text-xs"
                            value={person.role}
                            disabled={busy === person.id}
                            onChange={(event) =>
                              void setPerson(person, { role: event.target.value as Profile['role'] })
                            }
                          >
                            <option value="customer">customer</option>
                            <option value="restaurant_owner">restaurant owner</option>
                            <option value="rider">rider</option>
                          </Select>
                        )}
                        <Button
                          size="sm"
                          variant={person.is_blocked ? 'secondary' : 'danger'}
                          loading={busy === person.id}
                          disabled={person.role === 'admin'}
                          onClick={() => void setPerson(person, { is_blocked: !person.is_blocked })}
                        >
                          {person.is_blocked ? 'Unblock' : 'Block'}
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            {data.riderAssignmentReady === false && (
              <Alert tone="warning">
                Rider assignment needs one database step. Run the SQL in
                supabase/migrations/20261120000000_swad_mh13_auth.sql in your Supabase SQL editor;
                it adds orders.rider_id. Riders cannot receive deliveries until then.
              </Alert>
            )}
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Assign riders ({assignable.length} ready)
            </p>
            {data.orders.length === 0 ? (
              <EmptyState title="No orders yet" message="Customer orders will appear here." />
            ) : (
              data.orders.map((order) => (
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

                  {order.delivery_address && (
                    <p className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                      {order.delivery_address}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <Select
                      className="flex-1 py-1 text-xs"
                      value={order.rider_id || ''}
                      disabled={busy === order.id || riders.length === 0}
                      onChange={(event) => void assignRider(order, event.target.value)}
                    >
                      <option value="">
                        {riders.length === 0 ? 'No riders registered' : 'Assign a rider…'}
                      </option>
                      {riders.map((rider) => (
                        <option key={rider.id} value={rider.id}>
                          {rider.full_name || rider.email}
                        </option>
                      ))}
                    </Select>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'categories' && (
          <div className="space-y-3">
            <Card className="space-y-2">
              <Field label="New category">
                <div className="flex gap-2">
                  <Input
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    placeholder="Biryani, Snacks, Desserts…"
                  />
                  <Button loading={busy === 'new-category'} onClick={() => void addCategory()}>
                    Add
                  </Button>
                </div>
              </Field>
            </Card>
            {data.categories.length === 0 ? (
              <EmptyState title="No categories" message="Add a few so partners can tag their dishes." />
            ) : (
              data.categories.map((category) => (
                <Card key={category.id} className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{category.name}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === category.id}
                    onClick={() => void removeCategory(category.id, category.name)}
                  >
                    Delete
                  </Button>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
