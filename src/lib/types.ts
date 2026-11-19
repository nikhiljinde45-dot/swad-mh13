export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

export type RiderStatus = 'online' | 'busy' | 'offline'

export interface Restaurant {
  id: string
  name: string
  cuisine: string
  area: string
  category: string
  rating: number
  rating_count: number
  delivery_minutes: number
  delivery_fee: number
  min_order: number
  price_for_two: number
  is_open: boolean
  is_verified: boolean
  accent: string
  emoji: string
  tagline: string
  phone: string
  image_url: string | null
}

export interface MenuItem {
  id: string
  restaurant_id: string
  name: string
  description: string
  price: number
  category: string
  is_veg: boolean
  is_available: boolean
  is_bestseller: boolean
  emoji: string
  image_url: string | null
}

export interface OrderLine {
  menu_item_id: string
  name: string
  price: number
  qty: number
  emoji: string
}

export interface Order {
  id: string
  code: string
  customer_id: string
  customer_name: string
  phone: string
  address: string
  restaurant_id: string
  restaurant_name: string
  restaurant_area: string
  items: OrderLine[]
  subtotal: number
  delivery_fee: number
  total: number
  status: OrderStatus
  rider_id: string | null
  rider_name: string | null
  rider_phone: string | null
  payment_method: 'cod' | 'upi'
  notes: string
  created_at: string
  updated_at: string
}

export interface Rider {
  id: string
  name: string
  phone: string
  area: string
  vehicle: string
  status: RiderStatus
  deliveries: number
  rating: number
}

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  address: string
  orders: number
  created_at: string
  is_blocked: boolean
}

export interface Category {
  id: string
  name: string
  emoji: string
}

export interface AppConfig {
  app: string
  mode: 'supabase' | 'demo'
  supabase_configured: boolean
  warning: string | null
  statuses: OrderStatus[]
  flow: OrderStatus[]
  categories: Category[]
}

export interface AdminStats {
  restaurants: number
  open_restaurants: number
  riders: number
  online_riders: number
  customers: number
  orders: number
  active_orders: number
  delivered_orders: number
  revenue: number
}

export interface Profile {
  id: string
  name: string
  phone: string
  address: string
}

export interface CheckoutPayload {
  customer_id?: string
  customer_name: string
  phone: string
  address: string
  restaurant_id: string
  items: { menu_item_id: string; qty: number }[]
  payment_method: 'cod' | 'upi'
  notes?: string
}
