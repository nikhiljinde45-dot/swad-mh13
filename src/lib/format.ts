import type { OrderStatus } from './types'

export const inr = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Order placed',
  accepted: 'Restaurant accepted',
  preparing: 'Preparing your food',
  ready: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const STATUS_SHORT: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const STATUS_HINT: Record<OrderStatus, string> = {
  placed: 'Waiting for the restaurant to accept your order.',
  accepted: 'The restaurant has accepted your order.',
  preparing: 'Your food is being freshly prepared.',
  ready: 'Packed and waiting for the rider to pick it up.',
  out_for_delivery: 'Your rider is on the way to your address.',
  delivered: 'Enjoy your meal! Thanks for ordering with Swad MH13.',
  cancelled: 'This order was cancelled.',
}

/** Tailwind classes for status pills (static strings so Tailwind can see them). */
export const STATUS_STYLE: Record<OrderStatus, string> = {
  placed: 'bg-sky-50 text-sky-700 ring-sky-200',
  accepted: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  preparing: 'bg-amber-50 text-amber-700 ring-amber-200',
  ready: 'bg-violet-50 text-violet-700 ring-violet-200',
  out_for_delivery: 'bg-orange-50 text-orange-700 ring-orange-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export const ORDER_FLOW: OrderStatus[] = [
  'placed',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
]

export const isActive = (status: OrderStatus) =>
  status !== 'delivered' && status !== 'cancelled'

export function timeAgo(iso: string) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function clockTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
