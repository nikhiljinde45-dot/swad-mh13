import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { homeFor, roleLabel, useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import type { Role } from '../lib/types'
import { cx } from './kit'

const icons: Record<string, ReactNode> = {
  home: (
    <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
  ),
  orders: (
    <path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h5" />
  ),
  store: <path d="M3 9h18v11H3zM3 9l2-6h14l2 6M9 20v-6h6v6" />,
  bike: <path d="M4 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 14h6l3-6h3" />,
  shield: <path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5z" />,
  cart: <path d="M3 4h2l2.5 12h11L21 8H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />,
}

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      {icons[name]}
    </svg>
  )
}

interface NavItem {
  to: string
  label: string
  icon: keyof typeof icons
}

function navFor(role: Role | null, isSignedIn: boolean): NavItem[] {
  if (!isSignedIn) {
    return [
      { to: '/', label: 'Restaurants', icon: 'home' },
      { to: '/login', label: 'Sign in', icon: 'shield' },
    ]
  }
  if (role === 'owner') {
    return [
      { to: '/owner', label: 'Restaurant', icon: 'store' },
      { to: '/owner/orders', label: 'Orders', icon: 'orders' },
    ]
  }
  if (role === 'rider') {
    return [{ to: '/rider', label: 'Deliveries', icon: 'bike' }]
  }
  if (role === 'admin') {
    return [
      { to: '/admin', label: 'Admin', icon: 'shield' },
      { to: '/admin/orders', label: 'Orders', icon: 'orders' },
    ]
  }
  return [
    { to: '/', label: 'Home', icon: 'home' },
    { to: '/orders', label: 'Orders', icon: 'orders' },
    { to: '/cart', label: 'Cart', icon: 'cart' },
  ]
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-sm font-black text-white shadow-sm">
        S
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-extrabold tracking-tight text-slate-900">Swad MH13</span>
        {!compact && (
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-orange-600">
            Ghar ka swad
          </span>
        )}
      </span>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, role, signOut } = useAuth()
  const cart = useCart()
  const navigate = useNavigate()
  const items = navFor(role, Boolean(user))

  const onSignOut = async () => {
    await signOut()
    cart.clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-20">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
          <NavLink to={user ? homeFor(role) : '/'} className="shrink-0">
            <Brand />
          </NavLink>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 sm:block">
                  {roleLabel(role)}
                </span>
                {role === 'customer' && (
                  <NavLink
                    to="/cart"
                    className="relative rounded-xl px-2 py-1.5 text-slate-600 hover:bg-slate-100"
                    aria-label="Cart"
                  >
                    <Icon name="cart" />
                    {cart.count > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-600 px-1 text-[10px] font-bold text-white">
                        {cart.count}
                      </span>
                    )}
                  </NavLink>
                )}
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Log out
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                className="rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700"
              >
                Sign in
              </NavLink>
            )}
          </div>
        </div>
        {user && profile?.full_name && (
          <div className="mx-auto max-w-2xl px-4 pb-1.5 text-[11px] text-slate-500">
            Signed in as <span className="font-semibold text-slate-700">{profile.full_name}</span>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-stretch">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cx(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-orange-600' : 'text-slate-500 hover:text-slate-800',
                )
              }
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
