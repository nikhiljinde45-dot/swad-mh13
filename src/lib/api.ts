import type {
  Address,
  AdminOverview,
  AppConfig,
  Category,
  MenuItem,
  Order,
  OrderStatus,
  Profile,
  Restaurant,
  Role,
  User,
} from './types'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type RequestOptions = { method?: string; body?: unknown; signal?: AbortSignal }

async function request<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0)
  }

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const message =
      (payload as { error?: string } | null)?.error || `Request failed (${response.status})`
    throw new ApiError(message, response.status)
  }

  return payload as T
}

export interface RegisterPayload {
  email: string
  password: string
  full_name: string
  phone: string
  role: 'customer' | 'restaurant_owner' | 'rider'
  restaurant?: {
    name: string
    description?: string
    address: string
    city: string
    pincode: string
    image_url?: string | null
  }
}

export interface AuthResult {
  user: User
  profile: Profile
  restaurant?: Restaurant | null
}

export interface MenuItemInput {
  name: string
  description?: string
  price: number
  category_id?: string | null
  image_url?: string | null
  is_available?: boolean
  is_veg?: boolean
}

export const api = {
  config: () => request<AppConfig>('/api/config'),

  me: () => request<{ user: User | null; profile: Profile | null }>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<AuthResult>('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload: RegisterPayload) =>
    request<AuthResult>('/api/auth/register', { method: 'POST', body: payload }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    request<{ ok: boolean; message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),
  changePassword: (password: string) =>
    request<{ ok: boolean }>('/api/auth/password', { method: 'POST', body: { password } }),
  resetPassword: (accessToken: string, password: string) =>
    request<{ ok: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      body: { access_token: accessToken, password },
    }),

  categories: () => request<{ categories: Category[] }>('/api/categories'),
  restaurants: (params: { search?: string; category?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.search) query.set('search', params.search)
    if (params.category) query.set('category', params.category)
    const suffix = query.toString()
    return request<{ restaurants: Restaurant[] }>(`/api/restaurants${suffix ? `?${suffix}` : ''}`)
  },
  restaurant: (id: string, signal?: AbortSignal) =>
    request<{ restaurant: Restaurant; menu: MenuItem[] }>(`/api/restaurants/${id}`, { signal }),

  addresses: () => request<{ addresses: Address[] }>('/api/addresses'),
  createAddress: (payload: { full_address: string; city: string; pincode: string }) =>
    request<{ address: Address }>('/api/addresses', { method: 'POST', body: payload }),
  deleteAddress: (id: string) =>
    request<{ ok: boolean }>(`/api/addresses/${id}`, { method: 'DELETE' }),

  placeOrder: (payload: {
    restaurant_id: string
    items: { menu_item_id: string; quantity: number }[]
    address_id?: string
    full_address?: string
    city?: string
    pincode?: string
    payment_method?: 'cod' | 'upi'
    notes?: string
  }) => request<{ order: Order }>('/api/orders', { method: 'POST', body: payload }),
  paymentConfig: () =>
    request<{
      online_enabled: boolean
      provider: string | null
      currency: string
      methods: { id: 'cod' | 'upi'; label: string }[]
    }>('/api/payments/config'),
  orders: () => request<{ orders: Order[] }>('/api/orders'),
  order: (id: string) => request<{ order: Order }>(`/api/orders/${id}`),

  upload: (dataUrl: string, filename: string) =>
    request<{ url: string; path: string }>('/api/uploads', {
      method: 'POST',
      body: { dataUrl, filename },
    }),

  owner: {
    restaurant: () =>
      request<{ restaurant: Restaurant | null; menu: MenuItem[]; categories: Category[] }>(
        '/api/owner/restaurant',
      ),
    createRestaurant: (payload: {
      name: string
      description?: string
      address: string
      city: string
      pincode: string
      owner_name?: string
      owner_phone?: string
      image_url?: string | null
    }) => request<{ restaurant: Restaurant }>('/api/owner/restaurant', { method: 'POST', body: payload }),
    updateRestaurant: (payload: Partial<Restaurant>) =>
      request<{ restaurant: Restaurant }>('/api/owner/restaurant', { method: 'PATCH', body: payload }),
    addMenuItem: (payload: MenuItemInput) =>
      request<{ item: MenuItem }>('/api/owner/menu-items', { method: 'POST', body: payload }),
    updateMenuItem: (id: string, payload: Partial<MenuItemInput>) =>
      request<{ item: MenuItem }>(`/api/owner/menu-items/${id}`, { method: 'PATCH', body: payload }),
    deleteMenuItem: (id: string) =>
      request<{ ok: boolean; id: string }>(`/api/owner/menu-items/${id}`, { method: 'DELETE' }),
    orders: () => request<{ orders: Order[] }>('/api/owner/orders'),
    setOrderStatus: (id: string, status: OrderStatus) =>
      request<{ order: Order }>(`/api/owner/orders/${id}/status`, {
        method: 'PATCH',
        body: { status },
      }),
  },

  rider: {
    orders: () =>
      request<{ orders: Order[]; riderAssignmentReady?: boolean }>('/api/rider/orders'),
    setStatus: (id: string, status: OrderStatus) =>
      request<{ order: Order }>(`/api/rider/orders/${id}/status`, {
        method: 'PATCH',
        body: { status },
      }),
  },

  admin: {
    overview: () => request<AdminOverview>('/api/admin/overview'),
    setRestaurantActive: (id: string, isActive: boolean, rejectionReason?: string) =>
      request<{ restaurant: Restaurant }>(`/api/admin/restaurants/${id}`, {
        method: 'PATCH',
        body: { is_active: isActive, rejection_reason: rejectionReason ?? null },
      }),
    setProfile: (id: string, patch: { role?: Role; is_blocked?: boolean }) =>
      request<{ profile: Profile }>(`/api/admin/profiles/${id}`, { method: 'PATCH', body: patch }),
    assignRider: (orderId: string, riderId: string) =>
      request<{ order: Order }>(`/api/admin/orders/${orderId}/assign`, {
        method: 'PATCH',
        body: { rider_id: riderId },
      }),
    addCategory: (name: string) =>
      request<{ category: Category }>('/api/admin/categories', { method: 'POST', body: { name } }),
    updateCategory: (id: string, name: string) =>
      request<{ category: Category }>(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        body: { name },
      }),
    deleteCategory: (id: string) =>
      request<{ ok: boolean }>(`/api/admin/categories/${id}`, { method: 'DELETE' }),
  },
}
