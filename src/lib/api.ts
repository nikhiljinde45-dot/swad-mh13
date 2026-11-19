import type {
  AdminStats,
  AppConfig,
  CheckoutPayload,
  Customer,
  MenuItem,
  Order,
  OrderStatus,
  Restaurant,
  Rider,
  RiderStatus,
} from './types'

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text()
  let data: unknown = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`Unexpected server response (${res.status})`)
  }
  if (!res.ok) {
    const message = (data as { error?: string })?.error || `Request failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}

const get = <T>(url: string) => fetch(url, { headers: { Accept: 'application/json' } }).then((r) => parse<T>(r))

const send = <T>(url: string, method: string, body?: unknown) =>
  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => parse<T>(r))

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const api = {
  config: () => get<AppConfig>('/api/config'),

  restaurants: (category?: string) =>
    get<{ source: string; restaurants: Restaurant[] }>(`/api/restaurants${qs({ category })}`),

  restaurant: (id: string) =>
    get<{ restaurant: Restaurant; menu: MenuItem[] }>(`/api/restaurants/${encodeURIComponent(id)}`),

  updateRestaurant: (id: string, patch: Partial<Restaurant>) =>
    send<{ restaurant: Restaurant }>(`/api/restaurants/${encodeURIComponent(id)}`, 'PATCH', patch),

  createMenuItem: (payload: Partial<MenuItem> & { restaurant_id: string }) =>
    send<{ item: MenuItem }>('/api/menu-items', 'POST', payload),

  updateMenuItem: (id: string, patch: Partial<MenuItem>) =>
    send<{ item: MenuItem }>(`/api/menu-items/${encodeURIComponent(id)}`, 'PATCH', patch),

  deleteMenuItem: (id: string) =>
    send<{ id: string; deleted: boolean }>(`/api/menu-items/${encodeURIComponent(id)}`, 'DELETE'),

  orders: (params: { customer_id?: string; restaurant_id?: string; rider_id?: string; status?: string } = {}) =>
    get<{ source: string; orders: Order[] }>(`/api/orders${qs(params)}`),

  order: (id: string) => get<{ order: Order }>(`/api/orders/${encodeURIComponent(id)}`),

  createOrder: (payload: CheckoutPayload) => send<{ order: Order }>('/api/orders', 'POST', payload),

  updateOrder: (id: string, patch: { status?: OrderStatus; rider_id?: string | null }) =>
    send<{ order: Order }>(`/api/orders/${encodeURIComponent(id)}`, 'PATCH', patch),

  riders: () => get<{ riders: Rider[] }>('/api/riders'),

  createRider: (payload: Partial<Rider>) => send<{ rider: Rider }>('/api/riders', 'POST', payload),

  updateRider: (id: string, patch: { status?: RiderStatus; name?: string; phone?: string; area?: string; vehicle?: string }) =>
    send<{ rider: Rider }>(`/api/riders/${encodeURIComponent(id)}`, 'PATCH', patch),

  deleteRider: (id: string) =>
    send<{ id: string; deleted: boolean }>(`/api/riders/${encodeURIComponent(id)}`, 'DELETE'),

  customers: () => get<{ customers: Customer[] }>('/api/customers'),

  updateCustomer: (id: string, patch: { is_blocked?: boolean; name?: string; address?: string }) =>
    send<{ customer: Customer }>(`/api/customers/${encodeURIComponent(id)}`, 'PATCH', patch),

  deleteCustomer: (id: string) =>
    send<{ id: string; deleted: boolean }>(`/api/customers/${encodeURIComponent(id)}`, 'DELETE'),

  stats: () => get<{ stats: AdminStats }>('/api/admin/stats'),
}
