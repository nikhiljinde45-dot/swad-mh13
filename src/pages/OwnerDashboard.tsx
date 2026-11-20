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
  Sheet,
  Spinner,
  StatusPill,
  TextArea,
  Thumb,
  Toggle,
  cx,
} from '../components/kit'
import { ApiError, api, type MenuItemInput } from '../lib/api'
import { useAuth } from '../lib/auth'
import { fileToDataUrl } from '../lib/image'
import { inr, orderTotal, timeAgo } from '../lib/format'
import type { Category, MenuItem, Order, OrderStatus, Restaurant } from '../lib/types'

type Tab = 'menu' | 'orders' | 'profile'

const NEXT_ACTIONS: Partial<Record<OrderStatus, { label: string; status: OrderStatus; variant?: 'primary' | 'secondary' | 'danger' }[]>> = {
  placed: [
    { label: 'Accept order', status: 'accepted' },
    { label: 'Reject', status: 'rejected', variant: 'danger' },
  ],
  accepted: [{ label: 'Start preparing', status: 'preparing' }],
  preparing: [{ label: 'Mark ready for pickup', status: 'ready' }],
  ready: [{ label: 'Hand over to rider', status: 'out_for_delivery', variant: 'secondary' }],
}

const emptyItem = { name: '', description: '', price: '', category_id: '', image_url: '', is_veg: false }

export default function OwnerDashboard() {
  const { profile, role } = useAuth()
  const [tab, setTab] = useState<Tab>('menu')
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [itemSheet, setItemSheet] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [itemForm, setItemForm] = useState({ ...emptyItem })

  const [profileForm, setProfileForm] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    pincode: '',
    image_url: '',
    delivery_fee: '0',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.owner.restaurant()
      setRestaurant(result.restaurant)
      setMenu(result.menu)
      setCategories(result.categories)
      if (result.restaurant) {
        setProfileForm({
          name: result.restaurant.name ?? '',
          description: result.restaurant.description ?? '',
          address: result.restaurant.address ?? '',
          city: result.restaurant.city ?? '',
          pincode: result.restaurant.pincode ?? '',
          image_url: result.restaurant.image_url ?? '',
          delivery_fee: String(result.restaurant.delivery_fee ?? 0),
        })
        const orderResult = await api.owner.orders()
        setOrders(orderResult.orders)
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load your restaurant.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'restaurant_owner') void load()
    else setLoading(false)
  }, [role, load])

  const refreshOrders = async () => {
    try {
      const result = await api.owner.orders()
      setOrders(result.orders)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not refresh orders.')
    }
  }

  const openNewItem = () => {
    setEditing(null)
    setItemForm({ ...emptyItem })
    setItemSheet(true)
  }

  const openEditItem = (item: MenuItem) => {
    setEditing(item)
    setItemForm({
      name: item.name ?? '',
      description: item.description ?? '',
      price: String(item.price ?? ''),
      category_id: item.category_id ?? '',
      image_url: item.image_url ?? '',
      is_veg: Boolean(item.is_veg),
    })
    setItemSheet(true)
  }

  const pickItemImage = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await fileToDataUrl(file)
      const uploaded = await api.upload(dataUrl, file.name)
      setItemForm((current) => ({ ...current, image_url: uploaded.url }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload that image.')
    } finally {
      setBusy(false)
    }
  }

  const saveItem = async () => {
    setError(null)
    const price = Number(itemForm.price)
    if (itemForm.name.trim().length < 2) {
      setError('Give the item a name.')
      return
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('Enter a price greater than zero.')
      return
    }

    const payload: MenuItemInput = {
      name: itemForm.name.trim(),
      description: itemForm.description.trim(),
      price,
      category_id: itemForm.category_id || null,
      image_url: itemForm.image_url || null,
      is_veg: itemForm.is_veg,
    }

    setBusy(true)
    try {
      if (editing) {
        const result = await api.owner.updateMenuItem(editing.id, payload)
        setMenu((current) => current.map((item) => (item.id === result.item.id ? result.item : item)))
        setNotice('Item updated.')
      } else {
        const result = await api.owner.addMenuItem(payload)
        setMenu((current) => [...current, result.item])
        setNotice('Item added to your menu.')
      }
      setItemSheet(false)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save the item.')
    } finally {
      setBusy(false)
    }
  }

  const toggleAvailable = async (item: MenuItem) => {
    const next = !item.is_available
    setMenu((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, is_available: next } : entry)),
    )
    try {
      await api.owner.updateMenuItem(item.id, { is_available: next })
    } catch (cause) {
      setMenu((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, is_available: !next } : entry)),
      )
      setError(cause instanceof ApiError ? cause.message : 'Could not update availability.')
    }
  }

  const removeItem = async (item: MenuItem) => {
    if (!window.confirm(`Delete "${item.name}" from your menu?`)) return
    setBusy(true)
    try {
      await api.owner.deleteMenuItem(item.id)
      setMenu((current) => current.filter((entry) => entry.id !== item.id))
      setNotice('Item deleted.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not delete the item.')
    } finally {
      setBusy(false)
    }
  }

  const setOrderStatus = async (order: Order, status: OrderStatus) => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.owner.setOrderStatus(order.id, status)
      setOrders((current) => current.map((entry) => (entry.id === order.id ? result.order : entry)))
      setNotice(`Order marked ${status.replace(/_/g, ' ')}.`)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update the order.')
    } finally {
      setBusy(false)
    }
  }

  const saveProfile = async () => {
    setError(null)
    if (profileForm.name.trim().length < 2) {
      setError('Restaurant name is required.')
      return
    }
    setBusy(true)
    try {
      const result = await api.owner.updateRestaurant({
        name: profileForm.name.trim(),
        description: profileForm.description.trim(),
        address: profileForm.address.trim(),
        city: profileForm.city.trim(),
        pincode: profileForm.pincode.trim(),
        image_url: profileForm.image_url || null,
        delivery_fee: Number(profileForm.delivery_fee) || 0,
      })
      setRestaurant(result.restaurant)
      setNotice('Restaurant details saved.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save the details.')
    } finally {
      setBusy(false)
    }
  }

  const pickRestaurantImage = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      const uploaded = await api.upload(dataUrl, file.name)
      setProfileForm((current) => ({ ...current, image_url: uploaded.url }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload that image.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Spinner label="Loading your restaurant…" />
      </AppShell>
    )
  }

  if (role !== 'restaurant_owner') {
    return (
      <AppShell>
        <Alert tone="warning">This dashboard is for restaurant partner accounts.</Alert>
      </AppShell>
    )
  }

  if (!restaurant) {
    return (
      <AppShell>
        <EmptyState
          title="No restaurant yet"
          message="Register your restaurant to start adding dishes and receiving orders."
          action={
            <Button onClick={() => window.location.assign('/register?role=owner')}>
              Register a restaurant
            </Button>
          }
        />
      </AppShell>
    )
  }

  const pendingCount = orders.filter((order) => order.order_status === 'placed').length

  return (
    <AppShell>
      <div className="space-y-4">
        <Card className="flex items-center gap-3">
          <Thumb src={restaurant.image_url} alt={restaurant.name} className="h-14 w-14 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-slate-900">{restaurant.name}</p>
            <p className="text-[11px] text-slate-500">
              {restaurant.city ? `${restaurant.city} · ` : ''}
              {menu.length} menu items · {pendingCount} new order{pendingCount === 1 ? '' : 's'}
            </p>
          </div>
          <span
            className={cx(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1',
              restaurant.is_active
                ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                : 'bg-amber-100 text-amber-800 ring-amber-200',
            )}
          >
            {restaurant.is_active ? 'Live' : 'Pending approval'}
          </span>
        </Card>

        {!restaurant.is_active && (
          <Alert tone="warning">
            Your restaurant is waiting for admin approval. You can add dishes now — it becomes
            visible to customers once approved.
            {restaurant.rejection_reason ? ` Note from admin: ${restaurant.rejection_reason}` : ''}
          </Alert>
        )}

        {notice && <Alert tone="success">{notice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {(['menu', 'orders', 'profile'] as Tab[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cx(
                'flex-1 rounded-lg py-1.5 text-xs font-bold capitalize transition-colors',
                tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
              )}
            >
              {id === 'profile' ? 'Details' : id}
            </button>
          ))}
        </div>

        {tab === 'menu' && (
          <div className="space-y-3">
            <Button full onClick={openNewItem}>
              + Add a dish
            </Button>
            {menu.length === 0 ? (
              <EmptyState title="Your menu is empty" message="Add your first dish to get started." />
            ) : (
              <div className="space-y-2">
                {menu.map((item) => (
                  <Card key={item.id} className="flex items-center gap-3">
                    <Thumb src={item.image_url} alt={item.name} className="h-14 w-14 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {inr(item.price)} · {item.categories?.name || 'Uncategorised'}
                        {item.is_available ? '' : ' · hidden'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Toggle
                        checked={Boolean(item.is_available)}
                        onChange={() => void toggleAvailable(item)}
                        label={`Availability of ${item.name}`}
                        disabled={busy}
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEditItem(item)}
                          className="text-[11px] font-bold text-orange-700 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeItem(item)}
                          className="text-[11px] font-bold text-rose-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Incoming orders
              </p>
              <button
                type="button"
                onClick={() => void refreshOrders()}
                className="text-xs font-bold text-orange-700 hover:underline"
              >
                Refresh
              </button>
            </div>
            {orders.length === 0 ? (
              <EmptyState title="No orders yet" message="New orders will appear here." />
            ) : (
              orders.map((order) => (
                <Card key={order.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900">
                        {inr(orderTotal(order))} · {order.order_items?.length ?? 0} item
                        {(order.order_items?.length ?? 0) === 1 ? '' : 's'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {timeAgo(order.created_at)} · {order.payment_method?.toUpperCase() || 'COD'}
                      </p>
                    </div>
                    <StatusPill status={order.order_status} />
                  </div>

                  <div className="space-y-0.5">
                    {(order.order_items ?? []).map((line, index) => (
                      <p key={line.id ?? index} className="text-xs text-slate-600">
                        {line.quantity} × {line.item_name}
                      </p>
                    ))}
                  </div>

                  {order.delivery_address && (
                    <p className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                      {order.delivery_address}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {(NEXT_ACTIONS[order.order_status] ?? []).map((action) => (
                      <Button
                        key={action.status}
                        size="sm"
                        variant={action.variant ?? 'primary'}
                        loading={busy}
                        onClick={() => void setOrderStatus(order, action.status)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'profile' && (
          <Card className="space-y-3">
            <Field label="Restaurant image">
              <div className="flex items-center gap-3">
                <Thumb
                  src={profileForm.image_url || null}
                  alt={profileForm.name || 'Restaurant'}
                  className="h-16 w-16 rounded-xl"
                />
                <label className="cursor-pointer rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
                  {busy ? 'Uploading…' : 'Change photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void pickRestaurantImage(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </Field>
            <Field label="Restaurant name">
              <Input
                value={profileForm.name}
                onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
              />
            </Field>
            <Field label="Description">
              <TextArea
                value={profileForm.description}
                onChange={(event) =>
                  setProfileForm({ ...profileForm, description: event.target.value })
                }
              />
            </Field>
            <Field label="Address">
              <TextArea
                value={profileForm.address}
                onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="City">
                <Input
                  value={profileForm.city}
                  onChange={(event) => setProfileForm({ ...profileForm, city: event.target.value })}
                />
              </Field>
              <Field label="PIN code">
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={profileForm.pincode}
                  onChange={(event) =>
                    setProfileForm({ ...profileForm, pincode: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Delivery fee (₹)">
              <Input
                inputMode="numeric"
                value={profileForm.delivery_fee}
                onChange={(event) =>
                  setProfileForm({ ...profileForm, delivery_fee: event.target.value })
                }
              />
            </Field>
            <Button full loading={busy} onClick={() => void saveProfile()}>
              Save details
            </Button>
            <p className="text-[11px] text-slate-400">
              Signed in as {profile?.email}. Contact an administrator to change your account email.
            </p>
          </Card>
        )}
      </div>

      <Sheet
        open={itemSheet}
        onClose={() => setItemSheet(false)}
        title={editing ? 'Edit dish' : 'Add a dish'}
      >
        <div className="space-y-3">
          <Field label="Dish photo">
            <div className="flex items-center gap-3">
              <Thumb
                src={itemForm.image_url || null}
                alt={itemForm.name || 'Dish'}
                className="h-16 w-16 rounded-xl"
              />
              <label className="cursor-pointer rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
                {busy ? 'Uploading…' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void pickItemImage(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </Field>
          <Field label="Name">
            <Input
              value={itemForm.name}
              onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })}
              placeholder="Veg thali"
            />
          </Field>
          <Field label="Description">
            <TextArea
              value={itemForm.description}
              onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })}
              placeholder="What's in it?"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Price (₹)">
              <Input
                inputMode="decimal"
                value={itemForm.price}
                onChange={(event) => setItemForm({ ...itemForm, price: event.target.value })}
              />
            </Field>
            <Field label="Category">
              <Select
                value={itemForm.category_id}
                onChange={(event) => setItemForm({ ...itemForm, category_id: event.target.value })}
              >
                <option value="">Uncategorised</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={itemForm.is_veg}
              onChange={(event) => setItemForm({ ...itemForm, is_veg: event.target.checked })}
              className="accent-emerald-600"
            />
            Vegetarian
          </label>
          <Button full loading={busy} onClick={() => void saveItem()}>
            {editing ? 'Save changes' : 'Add to menu'}
          </Button>
        </div>
      </Sheet>
    </AppShell>
  )
}
