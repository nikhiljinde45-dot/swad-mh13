import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { MenuItem, Profile, Restaurant } from './types'

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

type Tone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  message: string
  tone: Tone
}

const ToastContext = createContext<{ notify: (message: string, tone?: Tone) => void }>({
  notify: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const notify = useCallback((message: string, tone: Tone = 'success') => {
    counter.current += 1
    const id = counter.current
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2800)
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto w-full max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-float ring-1 ${
              toast.tone === 'error'
                ? 'bg-rose-600 text-white ring-rose-700'
                : toast.tone === 'info'
                  ? 'bg-ink-900 text-white ring-ink-900'
                  : 'bg-emerald-600 text-white ring-emerald-700'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/* Cart                                                                */
/* ------------------------------------------------------------------ */

const CART_KEY = 'swad.cart.v1'

export interface CartLine {
  item: MenuItem
  qty: number
}

interface CartState {
  restaurantId: string | null
  restaurantName: string
  deliveryFee: number
  lines: CartLine[]
}

const emptyCart: CartState = { restaurantId: null, restaurantName: '', deliveryFee: 0, lines: [] }

function loadCart(): CartState {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return emptyCart
    const parsed = JSON.parse(raw) as CartState
    if (!parsed || !Array.isArray(parsed.lines)) return emptyCart
    return {
      restaurantId: parsed.restaurantId ?? null,
      restaurantName: parsed.restaurantName ?? '',
      deliveryFee: Number(parsed.deliveryFee) || 0,
      lines: parsed.lines.filter((line) => line?.item?.id && line.qty > 0),
    }
  } catch {
    return emptyCart
  }
}

interface CartApi {
  cart: CartState
  count: number
  subtotal: number
  total: number
  qtyOf: (itemId: string) => number
  add: (item: MenuItem, restaurant: Restaurant) => void
  setQty: (itemId: string, qty: number) => void
  increment: (itemId: string) => void
  decrement: (itemId: string) => void
  clear: () => void
}

const CartContext = createContext<CartApi | null>(null)

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <AppProviders>')
  return ctx
}

function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>(loadCart)

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch {
      /* storage full or blocked — cart still works for this session */
    }
  }, [cart])

  const add = useCallback((item: MenuItem, restaurant: Restaurant) => {
    setCart((prev) => {
      const sameRestaurant = prev.restaurantId === restaurant.id
      const base: CartState = sameRestaurant
        ? prev
        : {
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            deliveryFee: Number(restaurant.delivery_fee) || 0,
            lines: [],
          }
      const existing = base.lines.find((line) => line.item.id === item.id)
      const lines = existing
        ? base.lines.map((line) =>
            line.item.id === item.id ? { ...line, qty: Math.min(30, line.qty + 1) } : line,
          )
        : [...base.lines, { item, qty: 1 }]
      return { ...base, lines }
    })
  }, [])

  const setQty = useCallback((itemId: string, qty: number) => {
    setCart((prev) => {
      const lines = prev.lines
        .map((line) => (line.item.id === itemId ? { ...line, qty: Math.min(30, qty) } : line))
        .filter((line) => line.qty > 0)
      if (!lines.length) return emptyCart
      return { ...prev, lines }
    })
  }, [])

  const increment = useCallback(
    (itemId: string) => {
      setCart((prev) => ({
        ...prev,
        lines: prev.lines.map((line) =>
          line.item.id === itemId ? { ...line, qty: Math.min(30, line.qty + 1) } : line,
        ),
      }))
    },
    [],
  )

  const decrement = useCallback((itemId: string) => {
    setCart((prev) => {
      const lines = prev.lines
        .map((line) => (line.item.id === itemId ? { ...line, qty: line.qty - 1 } : line))
        .filter((line) => line.qty > 0)
      if (!lines.length) return emptyCart
      return { ...prev, lines }
    })
  }, [])

  const clear = useCallback(() => setCart(emptyCart), [])

  const value = useMemo<CartApi>(() => {
    const count = cart.lines.reduce((sum, line) => sum + line.qty, 0)
    const subtotal = cart.lines.reduce((sum, line) => sum + line.item.price * line.qty, 0)
    return {
      cart,
      count,
      subtotal,
      total: subtotal + (count > 0 ? cart.deliveryFee : 0),
      qtyOf: (itemId: string) => cart.lines.find((line) => line.item.id === itemId)?.qty ?? 0,
      add,
      setQty,
      increment,
      decrement,
      clear,
    }
  }, [cart, add, setQty, increment, decrement, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

/* ------------------------------------------------------------------ */
/* Customer profile                                                    */
/* ------------------------------------------------------------------ */

const PROFILE_KEY = 'swad.profile.v1'

interface ProfileApi {
  profile: Profile
  saveProfile: (patch: Partial<Profile>) => void
}

const ProfileContext = createContext<ProfileApi | null>(null)

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside <AppProviders>')
  return ctx
}

function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Profile
        return {
          id: parsed.id ?? '',
          name: parsed.name ?? '',
          phone: parsed.phone ?? '',
          address: parsed.address ?? '',
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    return { id: '', name: '', phone: '', address: '' }
  })

  const saveProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const value = useMemo(() => ({ profile, saveProfile }), [profile, saveProfile])
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

/* ------------------------------------------------------------------ */

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ProfileProvider>
        <CartProvider>{children}</CartProvider>
      </ProfileProvider>
    </ToastProvider>
  )
}
