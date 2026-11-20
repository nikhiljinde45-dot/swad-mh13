export type Role = 'customer' | 'owner' | 'rider' | 'admin'

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected'

export interface User {
  id: string
  email: string
  full_name: string
  phone: string
  role: Role
}

export interface Profile extends User {
  is_blocked?: boolean
  created_at?: string
}

export interface Category {
  id: string
  name: string
  image_url?: string | null
}

export interface Restaurant {
  id: string
  owner_user_id?: string
  name: string
  description: string | null
  image_url: string | null
  address: string
  city?: string | null
  pincode?: string | null
  owner_name?: string | null
  owner_phone?: string | null
  is_active: boolean
  rejection_reason?: string | null
  delivery_fee?: number | null
  menu_count?: number
  created_at?: string
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  is_veg?: boolean
  categories?: { name: string } | null
}

export interface Address {
  id: string
  user_id: string
  full_address: string
  city: string
  pincode: string
  created_at?: string
}

export interface OrderItem {
  id?: string
  order_id?: string
  menu_item_id: string | null
  item_name: string
  quantity: number
  unit_price: number
}

export interface Order {
  id: string
  user_id: string
  restaurant_id: string
  address_id: string | null
  total_amount: number
  subtotal?: number | null
  delivery_fee?: number | null
  order_status: OrderStatus
  payment_status?: string | null
  payment_method?: string | null
  delivery_address?: string | null
  notes?: string | null
  rider_id?: string | null
  created_at: string
  updated_at?: string | null
  restaurants?: Pick<Restaurant, 'id' | 'name' | 'image_url' | 'address'> | null
  order_items?: OrderItem[]
  customer?: { id: string; full_name: string | null; phone: string | null } | null
}

export interface AdminOverview {
  restaurants: Restaurant[]
  pending: Restaurant[]
  customers: Profile[]
  riders: Profile[]
  owners: Profile[]
  admins: Profile[]
  categories: Category[]
  orders: Order[]
  counts: {
    restaurants: number
    active_restaurants: number
    pending: number
    customers: number
    riders: number
    orders: number
    revenue: number
  }
}

export interface SetupReport {
  ready: boolean
  missing: string[]
}

export interface AppConfig {
  app: string
  supabase_url: string | null
  supabase_configured: boolean
  storage_bucket: string
  statuses: OrderStatus[]
  setup: SetupReport
}

export interface CartLine {
  menu_item_id: string
  name: string
  price: number
  quantity: number
  image_url: string | null
  is_veg?: boolean
}
