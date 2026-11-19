import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import type { OrderStatus } from '../lib/types'
import { STATUS_SHORT, STATUS_STYLE } from '../lib/format'

/* ------------------------------------------------------------------ */
/* Visual accents                                                      */
/* ------------------------------------------------------------------ */

const ACCENTS: Record<string, string> = {
  red: 'from-rose-500 via-red-500 to-orange-500',
  amber: 'from-amber-400 via-orange-400 to-rose-400',
  emerald: 'from-emerald-400 via-teal-500 to-cyan-500',
  rose: 'from-rose-400 via-pink-500 to-fuchsia-500',
  violet: 'from-violet-500 via-purple-500 to-indigo-500',
  fuchsia: 'from-fuchsia-500 via-pink-500 to-rose-500',
  sky: 'from-sky-400 via-blue-500 to-indigo-500',
  orange: 'from-orange-400 via-orange-500 to-amber-500',
}

const ACCENT_KEYS = Object.keys(ACCENTS)

export function accentClass(accent: string | undefined, seed = '') {
  if (accent && ACCENTS[accent]) return ACCENTS[accent]
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997
  return ACCENTS[ACCENT_KEYS[hash % ACCENT_KEYS.length]]
}

interface FoodThumbProps {
  emoji: string
  accent?: string
  seed?: string
  imageUrl?: string | null
  className?: string
  emojiClass?: string
  rounded?: string
}

/** Photo if the owner uploaded one, otherwise a branded gradient tile. */
export function FoodThumb({
  emoji,
  accent,
  seed = '',
  imageUrl,
  className = '',
  emojiClass = 'text-3xl',
  rounded = 'rounded-2xl',
}: FoodThumbProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(imageUrl) && !failed

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${rounded} bg-gradient-to-br ${accentClass(accent, seed)} ${className}`}
    >
      {showImage ? (
        <img
          src={imageUrl as string}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <span className="absolute -right-3 -top-3 h-10 w-10 rounded-full bg-white/25 blur-md" aria-hidden />
          <span className="absolute -bottom-4 -left-2 h-12 w-12 rounded-full bg-black/10 blur-md" aria-hidden />
          <span className={`absolute inset-0 grid place-items-center ${emojiClass}`} aria-hidden>
            {emoji}
          </span>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconProps = { className?: string }

export const Icon = {
  Home: ({ className = 'h-5 w-5' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M3.5 10.5 12 3.5l8.5 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5V20h13V9.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 20v-5.5h4V20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Receipt: ({ className = 'h-5 w-5' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2v-17Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" strokeLinecap="round" />
    </svg>
  ),
  Cart: ({ className = 'h-5 w-5' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M3 4h2.2l2.3 10.2h9.9L20 7H6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="17.5" cy="19" r="1.4" />
    </svg>
  ),
  Grid: ({ className = 'h-5 w-5' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  ),
  Back: ({ className = 'h-5 w-5' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M14.5 5.5 8 12l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Search: ({ className = 'h-5 w-5' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  ),
  Star: ({ className = 'h-3.5 w-3.5' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.8l2.7 5.9 6.3.7-4.7 4.3 1.3 6.3L12 16.9l-5.6 3.1 1.3-6.3L3 9.4l6.3-.7L12 2.8Z" />
    </svg>
  ),
  Pin: ({ className = 'h-4 w-4' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M12 21s6.5-6.1 6.5-11a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  ),
  Check: ({ className = 'h-4 w-4' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Close: ({ className = 'h-5 w-5' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  ),
  Plus: ({ className = 'h-4 w-4' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  Minus: ({ className = 'h-4 w-4' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden>
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  Bike: ({ className = 'h-5 w-5' }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="5.5" cy="17" r="3" />
      <circle cx="18.5" cy="17" r="3" />
      <path d="M8.5 17h6l-2-7h-3m5-2h3l2 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export function StatusPill({ status, className = '' }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${STATUS_STYLE[status]} ${className}`}
    >
      {STATUS_SHORT[status]}
    </span>
  )
}

export function VegDot({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      title={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border ${
        isVeg ? 'border-emerald-600' : 'border-rose-600'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
    </span>
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  full?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  full = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const variants = {
    primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-300',
    secondary: 'bg-white text-ink-900 ring-1 ring-ink-300 hover:bg-brand-50 active:bg-brand-100',
    ghost: 'bg-transparent text-ink-700 hover:bg-black/5',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3.5 text-[15px]',
  }
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
        variants[variant]
      } ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}

export function QtyStepper({
  qty,
  onInc,
  onDec,
  label = '',
}: {
  qty: number
  onInc: () => void
  onDec: () => void
  label?: string
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl bg-brand-50 ring-1 ring-brand-200">
      <button
        type="button"
        onClick={onDec}
        aria-label={`Remove one ${label}`}
        className="grid h-9 w-9 place-items-center text-brand-700 active:bg-brand-100"
      >
        <Icon.Minus />
      </button>
      <span className="min-w-7 text-center text-sm font-bold text-brand-700" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        onClick={onInc}
        aria-label={`Add one more ${label}`}
        className="grid h-9 w-9 place-items-center text-brand-700 active:bg-brand-100"
      >
        <Icon.Plus />
      </button>
    </div>
  )
}

export function Field({
  label,
  hint,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</span>
      <input
        {...rest}
        className={`w-full rounded-xl border border-ink-300 bg-white px-3.5 py-3 text-sm text-ink-900 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${className}`}
      />
      {hint && <span className="mt-1 block text-[11px] text-ink-500">{hint}</span>}
    </label>
  )
}

export function TextArea({
  label,
  className = '',
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</span>
      <textarea
        {...rest}
        className={`w-full rounded-xl border border-ink-300 bg-white px-3.5 py-3 text-sm text-ink-900 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${className}`}
      />
    </label>
  )
}

export function EmptyState({
  emoji = '🍽️',
  title,
  body,
  action,
}: {
  emoji?: string
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-white/70 px-6 py-12 text-center">
      <span className="mb-3 text-4xl" aria-hidden>
        {emoji}
      </span>
      <p className="text-base font-semibold text-ink-900">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm font-medium text-ink-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}…
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-base font-bold tracking-tight text-ink-900">{children}</h2>
      {action}
    </div>
  )
}

export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-float sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-ink-300/60 px-5 py-3.5">
          <h3 className="text-sm font-bold text-ink-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-black/5"
          >
            <Icon.Close />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-ink-300/60 px-5 py-3 pb-safe">{footer}</div>}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; badge?: number }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
      {tabs.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={active}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
              active ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-ink-300'
            }`}
          >
            {tab.label}
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  active ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-emerald-500' : 'bg-ink-300'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
