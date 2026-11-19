import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { clockTime, inr, isActive, timeAgo } from '../lib/format'
import { useToast } from '../lib/app-state'
import { fileToCompressedDataUrl } from '../lib/image'
import type { MenuItem, Order, Restaurant } from '../lib/types'
import {
  Button,
  EmptyState,
  Field,
  FoodThumb,
  Icon,
  SectionTitle,
  Sheet,
  Spinner,
  StatusPill,
  Tabs,
  TextArea,
  Toggle,
  VegDot,
} from '../components/ui'

type Tab = 'orders' | 'menu' | 'profile'

const EMPTY_ITEM = {
  name: '',
  price: '',
  category: 'Mains',
  description: '',
  emoji: '🍽️',
  is_veg: true,
  is_available: true,
  is_bestseller: false,
  image_url: null as string | null,
}

export default function OwnerPanel() {
  const { notify } = useToast()
  const [tab, setTab] = useState<Tab>('orders')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [restaurantId, setRestaurantId] = useState('')
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  // item editor
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [draft, setDraft] = useState({ ...EMPTY_ITEM })
  const [savingItem, setSavingItem] = useState(false)

  // profile form
  const [profile, setProfile] = useState({
    name: '',
    cuisine: '',
    area: '',
    tagline: '',
    phone: '',
    delivery_fee: '',
    min_order: '',
    delivery_minutes: '',
    image_url: null as string | null,
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const profilePhoto = useRef<HTMLInputElement>(null)
  const itemPhoto = useRef<HTMLInputElement>(null)

  /* ---------------------------- data ---------------------------- */

  useEffect(() => {
    api
      .restaurants()
      .then((data) => {
        setRestaurants(data.restaurants)
        if (data.restaurants.length) setRestaurantId((current) => current || data.restaurants[0].id)
      })
      .catch((err: Error) => notify(err.message, 'error'))
      .finally(() => setLoading(false))
  }, [notify])

  const load = useCallback(
    async (id: string, quiet = false) => {
      if (!id) return
      try {
        const [detail, orderList] = await Promise.all([api.restaurant(id), api.orders({ restaurant_id: id })])
        setRestaurant(detail.restaurant)
        setMenu(detail.menu)
        setOrders(orderList.orders)
        setProfile({
          name: detail.restaurant.name,
          cuisine: detail.restaurant.cuisine,
          area: detail.restaurant.area,
          tagline: detail.restaurant.tagline ?? '',
          phone: detail.restaurant.phone ?? '',
          delivery_fee: String(detail.restaurant.delivery_fee ?? 0),
          min_order: String(detail.restaurant.min_order ?? 0),
          delivery_minutes: String(detail.restaurant.delivery_minutes ?? 30),
          image_url: detail.restaurant.image_url ?? null,
        })
      } catch (err) {
        if (!quiet) notify((err as Error).message, 'error')
      }
    },
    [notify],
  )

  useEffect(() => {
    load(restaurantId)
  }, [restaurantId, load])

  // Live-ish order refresh for the owner.
  useEffect(() => {
    if (!restaurantId) return
    const timer = window.setInterval(() => load(restaurantId, true), 12000)
    return () => window.clearInterval(timer)
  }, [restaurantId, load])

  const activeOrders = useMemo(() => orders.filter((order) => isActive(order.status)), [orders])
  const pastOrders = useMemo(() => orders.filter((order) => !isActive(order.status)), [orders])

  /* --------------------------- actions -------------------------- */

  const changeStatus = async (order: Order, status: Order['status']) => {
    setBusy(order.id)
    try {
      const { order: updated } = await api.updateOrder(order.id, { status })
      setOrders((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      notify(`Order #${order.code} → ${status.replace(/_/g, ' ')}`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const toggleOpen = async (next: boolean) => {
    if (!restaurant) return
    setBusy('open')
    try {
      const { restaurant: updated } = await api.updateRestaurant(restaurant.id, { is_open: next })
      setRestaurant(updated)
      notify(next ? 'Restaurant is now accepting orders' : 'Restaurant closed for orders')
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const openEditor = (item?: MenuItem) => {
    setEditing(item ?? null)
    setDraft(
      item
        ? {
            name: item.name,
            price: String(item.price),
            category: item.category,
            description: item.description,
            emoji: item.emoji,
            is_veg: item.is_veg,
            is_available: item.is_available,
            is_bestseller: item.is_bestseller,
            image_url: item.image_url,
          }
        : { ...EMPTY_ITEM },
    )
    setEditorOpen(true)
  }

  const saveItem = async () => {
    if (!restaurant) return
    const price = Number(draft.price)
    if (!draft.name.trim()) return notify('Item name is required', 'error')
    if (!Number.isFinite(price) || price <= 0) return notify('Enter a valid price', 'error')

    setSavingItem(true)
    try {
      const payload = {
        restaurant_id: restaurant.id,
        name: draft.name.trim(),
        price,
        category: draft.category.trim() || 'Mains',
        description: draft.description.trim(),
        emoji: draft.emoji || '🍽️',
        is_veg: draft.is_veg,
        is_available: draft.is_available,
        is_bestseller: draft.is_bestseller,
        image_url: draft.image_url,
      }
      if (editing) {
        const { item } = await api.updateMenuItem(editing.id, payload)
        setMenu((prev) => prev.map((row) => (row.id === item.id ? item : row)))
        notify('Item updated')
      } else {
        const { item } = await api.createMenuItem(payload)
        setMenu((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))
        notify('Item added to menu')
      }
      setEditorOpen(false)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setSavingItem(false)
    }
  }

  const removeItem = async (item: MenuItem) => {
    if (!window.confirm(`Delete “${item.name}” from the menu?`)) return
    try {
      await api.deleteMenuItem(item.id)
      setMenu((prev) => prev.filter((row) => row.id !== item.id))
      notify('Item deleted')
    } catch (err) {
      notify((err as Error).message, 'error')
    }
  }

  const saveProfile = async () => {
    if (!restaurant) return
    setSavingProfile(true)
    try {
      const { restaurant: updated } = await api.updateRestaurant(restaurant.id, {
        name: profile.name.trim(),
        cuisine: profile.cuisine.trim(),
        area: profile.area.trim(),
        tagline: profile.tagline.trim(),
        phone: profile.phone.trim(),
        delivery_fee: Number(profile.delivery_fee) || 0,
        min_order: Number(profile.min_order) || 0,
        delivery_minutes: Number(profile.delivery_minutes) || 30,
        image_url: profile.image_url,
      })
      setRestaurant(updated)
      setRestaurants((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      notify('Restaurant profile saved')
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const pickPhoto = async (file: File | undefined, target: 'profile' | 'item') => {
    if (!file) return
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      if (target === 'profile') setProfile((prev) => ({ ...prev, image_url: dataUrl }))
      else setDraft((prev) => ({ ...prev, image_url: dataUrl }))
      notify('Photo ready — remember to save')
    } catch (err) {
      notify((err as Error).message, 'error')
    }
  }

  /* ----------------------------- UI ----------------------------- */

  if (loading) return <Spinner label="Loading your restaurant" />

  if (!restaurants.length) {
    return <EmptyState emoji="🏪" title="No restaurant found" body="Add a restaurant row in Supabase to get started." />
  }

  return (
    <div className="space-y-4">
      {/* Restaurant selector + status */}
      <section className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-black/5">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-500">
            Managing restaurant
          </span>
          <select
            value={restaurantId}
            onChange={(event) => setRestaurantId(event.target.value)}
            className="w-full rounded-xl border border-ink-300 bg-white px-3 py-2.5 text-sm font-semibold text-ink-900 outline-none focus:border-brand-400"
          >
            {restaurants.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} — {row.area}
              </option>
            ))}
          </select>
        </label>

        {restaurant && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-ink-900/[0.03] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-bold text-ink-900">
                {restaurant.is_open ? 'Accepting orders' : 'Closed for orders'}
              </p>
              <p className="text-[10px] text-ink-500">
                {inr(restaurant.delivery_fee)} delivery • {restaurant.delivery_minutes} min • min{' '}
                {inr(restaurant.min_order)}
              </p>
            </div>
            <Toggle checked={restaurant.is_open} onChange={toggleOpen} label="Accepting orders" />
          </div>
        )}
      </section>

      <Tabs
        tabs={[
          { id: 'orders', label: 'Orders', badge: activeOrders.length },
          { id: 'menu', label: 'Menu', badge: menu.length },
          { id: 'profile', label: 'Profile' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Orders */}
      {tab === 'orders' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Live orders</SectionTitle>
            <button
              type="button"
              onClick={() => load(restaurantId)}
              className="mb-3 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink-700 ring-1 ring-ink-300"
            >
              Refresh
            </button>
          </div>

          {activeOrders.length === 0 ? (
            <EmptyState emoji="🧑‍🍳" title="No live orders" body="New orders will appear here automatically." />
          ) : (
            activeOrders.map((order) => (
              <div key={order.id} className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink-900">#{order.code}</p>
                    <p className="text-[11px] text-ink-500">
                      {order.customer_name} • {timeAgo(order.created_at)}
                    </p>
                  </div>
                  <StatusPill status={order.status} />
                </div>

                <ul className="mt-2 space-y-1 rounded-xl bg-ink-900/[0.03] p-2.5 text-[11px]">
                  {order.items.map((line) => (
                    <li key={line.menu_item_id} className="flex justify-between gap-2 text-ink-700">
                      <span className="min-w-0 truncate">
                        <span className="font-bold text-ink-900">{line.qty}×</span> {line.name}
                      </span>
                      <span>{inr(line.price * line.qty)}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
                  {order.address}
                  {order.notes ? ` • Note: ${order.notes}` : ''}
                </p>

                <div className="mt-2.5 flex items-center justify-between">
                  <p className="text-sm font-extrabold text-ink-900">{inr(order.total)}</p>
                  <p className="text-[10px] font-semibold uppercase text-ink-500">
                    {order.payment_method === 'cod' ? 'Cash on delivery' : 'UPI'}
                  </p>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  {order.status === 'placed' && (
                    <>
                      <Button size="sm" loading={busy === order.id} onClick={() => changeStatus(order, 'accepted')}>
                        Accept order
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => changeStatus(order, 'cancelled')}>
                        Reject
                      </Button>
                    </>
                  )}
                  {order.status === 'accepted' && (
                    <Button size="sm" onClick={() => changeStatus(order, 'preparing')}>
                      Start preparing
                    </Button>
                  )}
                  {order.status === 'preparing' && (
                    <Button size="sm" onClick={() => changeStatus(order, 'ready')}>
                      Mark ready for pickup
                    </Button>
                  )}
                  {order.status === 'ready' && (
                    <p className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700">
                      Packed — waiting for a rider to pick it up
                    </p>
                  )}
                  {order.status === 'out_for_delivery' && (
                    <p className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold text-orange-700">
                      {order.rider_name ?? 'Rider'} is delivering this order
                    </p>
                  )}
                </div>
              </div>
            ))
          )}

          {pastOrders.length > 0 && (
            <section className="pt-2">
              <SectionTitle>Completed &amp; cancelled</SectionTitle>
              <div className="space-y-2">
                {pastOrders.slice(0, 10).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 shadow-card ring-1 ring-black/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink-900">
                        #{order.code} • {order.customer_name}
                      </p>
                      <p className="text-[10px] text-ink-500">
                        {clockTime(order.created_at)} • {inr(order.total)}
                      </p>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Menu */}
      {tab === 'menu' && (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <SectionTitle>Menu items ({menu.length})</SectionTitle>
            <Button size="sm" className="mb-3" onClick={() => openEditor()}>
              <Icon.Plus className="h-3.5 w-3.5" /> Add item
            </Button>
          </div>

          {menu.length === 0 ? (
            <EmptyState
              emoji="🍲"
              title="Your menu is empty"
              body="Add your first dish — name, price, category and an optional photo."
              action={<Button onClick={() => openEditor()}>Add first item</Button>}
            />
          ) : (
            <div className="space-y-2">
              {menu.map((item) => (
                <div key={item.id} className="rounded-2xl bg-white p-3 shadow-card ring-1 ring-black/5">
                  <div className="flex gap-3">
                    <FoodThumb
                      emoji={item.emoji}
                      seed={item.name}
                      imageUrl={item.image_url}
                      className="h-14 w-14"
                      emojiClass="text-2xl"
                      rounded="rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <VegDot isVeg={item.is_veg} />
                        <p className="min-w-0 truncate text-sm font-bold text-ink-900">{item.name}</p>
                      </div>
                      <p className="text-[11px] text-ink-500">
                        {item.category} • {inr(item.price)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Toggle
                          checked={item.is_available}
                          onChange={async (next) => {
                            try {
                              const { item: updated } = await api.updateMenuItem(item.id, { is_available: next })
                              setMenu((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
                            } catch (err) {
                              notify((err as Error).message, 'error')
                            }
                          }}
                          label={`Available: ${item.name}`}
                        />
                        <span className="text-[10px] font-semibold text-ink-500">
                          {item.is_available ? 'Available' : 'Sold out'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditor(item)}
                        className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-bold text-brand-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile */}
      {tab === 'profile' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
            <SectionTitle>Restaurant profile</SectionTitle>

            <div className="flex items-center gap-3">
              <FoodThumb
                emoji={restaurant?.emoji ?? '🏪'}
                accent={restaurant?.accent}
                seed={profile.name}
                imageUrl={profile.image_url}
                className="h-16 w-16"
                emojiClass="text-2xl"
                rounded="rounded-2xl"
              />
              <div>
                <Button size="sm" variant="secondary" onClick={() => profilePhoto.current?.click()}>
                  Upload cover photo
                </Button>
                {profile.image_url && (
                  <button
                    type="button"
                    onClick={() => setProfile((prev) => ({ ...prev, image_url: null }))}
                    className="mt-1 block text-[11px] font-semibold text-rose-600"
                  >
                    Remove photo
                  </button>
                )}
                <input
                  ref={profilePhoto}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => pickPhoto(event.target.files?.[0], 'profile')}
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <Field label="Restaurant name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cuisine" value={profile.cuisine} onChange={(e) => setProfile({ ...profile, cuisine: e.target.value })} />
                <Field label="Area" value={profile.area} onChange={(e) => setProfile({ ...profile, area: e.target.value })} />
              </div>
              <Field label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} inputMode="tel" />
              <TextArea
                label="Tagline"
                rows={2}
                value={profile.tagline}
                onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                placeholder="Kolhapuri misal with three tarris…"
              />
              <div className="grid grid-cols-3 gap-2">
                <Field
                  label="Delivery ₹"
                  value={profile.delivery_fee}
                  onChange={(e) => setProfile({ ...profile, delivery_fee: e.target.value.replace(/\D/g, '') })}
                  inputMode="numeric"
                />
                <Field
                  label="Min order ₹"
                  value={profile.min_order}
                  onChange={(e) => setProfile({ ...profile, min_order: e.target.value.replace(/\D/g, '') })}
                  inputMode="numeric"
                />
                <Field
                  label="Minutes"
                  value={profile.delivery_minutes}
                  onChange={(e) => setProfile({ ...profile, delivery_minutes: e.target.value.replace(/\D/g, '') })}
                  inputMode="numeric"
                />
              </div>
              <Button full loading={savingProfile} onClick={saveProfile}>
                Save profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Item editor sheet */}
      <Sheet
        open={editorOpen}
        title={editing ? 'Edit menu item' : 'Add menu item'}
        onClose={() => setEditorOpen(false)}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button full loading={savingItem} onClick={saveItem}>
              {editing ? 'Save changes' : 'Add to menu'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <FoodThumb
              emoji={draft.emoji}
              seed={draft.name}
              imageUrl={draft.image_url}
              className="h-16 w-16"
              emojiClass="text-2xl"
              rounded="rounded-2xl"
            />
            <div>
              <Button size="sm" variant="secondary" onClick={() => itemPhoto.current?.click()}>
                Upload food photo
              </Button>
              {draft.image_url && (
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, image_url: null }))}
                  className="mt-1 block text-[11px] font-semibold text-rose-600"
                >
                  Remove photo
                </button>
              )}
              <input
                ref={itemPhoto}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => pickPhoto(event.target.files?.[0], 'item')}
              />
              <p className="mt-1 text-[10px] text-ink-500">Photos are compressed on-device.</p>
            </div>
          </div>

          <Field label="Item name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Kolhapuri Misal" />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Price ₹"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/\D/g, '') })}
              inputMode="numeric"
              placeholder="120"
            />
            <Field label="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Misal" />
          </div>
          <TextArea
            label="Description"
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Sprouted moth beans, spicy tarri, farsan and onion"
          />
          <Field
            label="Emoji (used if no photo)"
            value={draft.emoji}
            onChange={(e) => setDraft({ ...draft, emoji: e.target.value.slice(0, 4) })}
            placeholder="🍲"
          />

          <div className="space-y-2 rounded-xl bg-ink-900/[0.03] p-3">
            {[
              { key: 'is_veg' as const, label: 'Vegetarian' },
              { key: 'is_available' as const, label: 'Available to order' },
              { key: 'is_bestseller' as const, label: 'Bestseller badge' },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-700">{row.label}</span>
                <Toggle
                  checked={draft[row.key]}
                  onChange={(next) => setDraft((prev) => ({ ...prev, [row.key]: next }))}
                  label={row.label}
                />
              </div>
            ))}
          </div>
        </div>
      </Sheet>
    </div>
  )
}
