import type { OrderStatus } from './types'

export const inr = (value: number | null | undefined) =>
  `₹${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}

export const STATUS_STYLE: Record<OrderStatus, string> = {
  placed: 'bg-amber-100 text-amber-800 ring-amber-200',
  accepted: 'bg-sky-100 text-sky-800 ring-sky-200',
  preparing: 'bg-orange-100 text-orange-800 ring-orange-200',
  ready: 'bg-violet-100 text-violet-800 ring-violet-200',
  out_for_delivery: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  delivered: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-slate-200 text-slate-700 ring-slate-300',
  rejected: 'bg-rose-100 text-rose-800 ring-rose-200',
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(1, Math.round((Date.now() - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const initials = (name: string | null | undefined): string =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

export const orderTotal = (order: { total_amount?: number | null; order_items?: { unit_price: number; quantity: number }[] }) => {
  if (typeof order.total_amount === 'number') return order.total_amount
  return (order.order_items ?? []).reduce((sum, line) => sum + line.unit_price * line.quantity, 0)
}
