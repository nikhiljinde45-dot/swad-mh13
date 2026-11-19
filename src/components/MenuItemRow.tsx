import type { MenuItem } from '../lib/types'
import { inr } from '../lib/format'
import { FoodThumb, Icon, QtyStepper, VegDot } from './ui'

export default function MenuItemRow({
  item,
  qty,
  onAdd,
  onInc,
  onDec,
}: {
  item: MenuItem
  qty: number
  onAdd: () => void
  onInc: () => void
  onDec: () => void
}) {
  const soldOut = !item.is_available

  return (
    <div className="flex gap-3 border-b border-ink-300/40 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <VegDot isVeg={item.is_veg} />
          {item.is_bestseller && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
              Bestseller
            </span>
          )}
        </div>

        <h4 className={`mt-1.5 text-[15px] font-bold leading-snug ${soldOut ? 'text-ink-500' : 'text-ink-900'}`}>
          {item.name}
        </h4>
        <p className="mt-0.5 text-sm font-semibold text-ink-700">{inr(item.price)}</p>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">{item.description}</p>
        )}
        {soldOut && <p className="mt-1 text-[11px] font-semibold text-rose-600">Currently unavailable</p>}
      </div>

      <div className="relative w-[92px] shrink-0">
        <FoodThumb
          emoji={item.emoji}
          seed={item.name}
          imageUrl={item.image_url}
          className="h-[92px] w-[92px]"
          emojiClass="text-3xl"
          rounded="rounded-xl"
        />

        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2">
          {qty > 0 ? (
            <QtyStepper qty={qty} onInc={onInc} onDec={onDec} label={item.name} />
          ) : (
            <button
              type="button"
              onClick={onAdd}
              disabled={soldOut}
              className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-600 shadow-card ring-1 ring-brand-200 transition active:scale-95 disabled:text-ink-500 disabled:ring-ink-300"
            >
              {soldOut ? 'Sold out' : (<><Icon.Plus className="h-3 w-3" /> Add</>)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
