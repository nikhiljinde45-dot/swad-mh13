import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CartLine } from './types'

const STORAGE_KEY = 'swad-mh13-cart-v1'

interface StoredCart {
  restaurantId: string | null
  restaurantName: string
  lines: CartLine[]
}

const empty: StoredCart = { restaurantId: null, restaurantName: '', lines: [] }

interface CartValue extends StoredCart {
  count: number
  subtotal: number
  add: (restaurantId: string, restaurantName: string, line: Omit<CartLine, 'quantity'>, quantity?: number) => void
  setQuantity: (menuItemId: string, quantity: number) => void
  remove: (menuItemId: string) => void
  clear: () => void
}

const CartContext = createContext<CartValue | null>(null)

function load(): StoredCart {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as StoredCart
    if (!parsed || !Array.isArray(parsed.lines)) return empty
    return {
      restaurantId: parsed.restaurantId ?? null,
      restaurantName: parsed.restaurantName ?? '',
      lines: parsed.lines.filter((line) => line && typeof line.price === 'number'),
    }
  } catch {
    return empty
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<StoredCart>(() => load())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
    } catch {
      /* storage full or blocked — the in-memory cart still works */
    }
  }, [cart])

  const add = useCallback<CartValue['add']>((restaurantId, restaurantName, line, quantity = 1) => {
    setCart((current) => {
      // One restaurant per order, so switching restaurants starts a fresh cart.
      const base =
        current.restaurantId && current.restaurantId !== restaurantId
          ? { restaurantId, restaurantName, lines: [] as CartLine[] }
          : { restaurantId, restaurantName, lines: current.lines }

      const existing = base.lines.find((item) => item.menu_item_id === line.menu_item_id)
      const lines = existing
        ? base.lines.map((item) =>
            item.menu_item_id === line.menu_item_id
              ? { ...item, quantity: Math.min(20, item.quantity + quantity) }
              : item,
          )
        : [...base.lines, { ...line, quantity: Math.min(20, quantity) }]

      return { restaurantId, restaurantName, lines }
    })
  }, [])

  const setQuantity = useCallback<CartValue['setQuantity']>((menuItemId, quantity) => {
    setCart((current) => {
      const lines = current.lines
        .map((line) =>
          line.menu_item_id === menuItemId
            ? { ...line, quantity: Math.max(0, Math.min(20, quantity)) }
            : line,
        )
        .filter((line) => line.quantity > 0)
      return lines.length
        ? { ...current, lines }
        : { restaurantId: null, restaurantName: '', lines: [] }
    })
  }, [])

  const remove = useCallback<CartValue['remove']>((menuItemId) => {
    setCart((current) => {
      const lines = current.lines.filter((line) => line.menu_item_id !== menuItemId)
      return lines.length ? { ...current, lines } : empty
    })
  }, [])

  const clear = useCallback(() => setCart(empty), [])

  const value = useMemo<CartValue>(() => {
    const count = cart.lines.reduce((sum, line) => sum + line.quantity, 0)
    const subtotal = cart.lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
    return { ...cart, count, subtotal, add, setQuantity, remove, clear }
  }, [cart, add, setQuantity, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartValue {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
