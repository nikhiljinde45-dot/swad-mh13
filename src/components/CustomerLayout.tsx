import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCart } from '../lib/app-state'
import { Icon } from './ui'

const navItems = [
  { to: '/', label: 'Home', icon: Icon.Home, end: true },
  { to: '/orders', label: 'Orders', icon: Icon.Receipt, end: false },
  { to: '/cart', label: 'Cart', icon: Icon.Cart, end: false, badge: true },
  { to: '/panels', label: 'Panels', icon: Icon.Grid, end: false },
]

export default function CustomerLayout() {
  const { count } = useCart()
  const location = useLocation()

  return (
    <div className="min-h-dvh bg-cream">
      <div className="mx-auto min-h-dvh w-full max-w-lg bg-cream pb-24 shadow-[0_0_60px_-30px_rgba(16,24,40,0.25)]">
        <main key={location.pathname} className="animate-[fadeIn_.18s_ease-out]">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Customer navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-300/60 bg-white/95 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-lg items-stretch justify-around px-2 pb-safe">
          {navItems.map((item) => {
            const NavIcon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold transition-colors ${
                    isActive ? 'text-brand-600' : 'text-ink-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <NavIcon className={`h-[22px] w-[22px] ${isActive ? 'stroke-[2.1]' : ''}`} />
                      {item.badge && count > 0 && (
                        <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
                          {count}
                        </span>
                      )}
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
