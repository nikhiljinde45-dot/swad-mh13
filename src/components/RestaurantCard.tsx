import { Link } from 'react-router-dom'
import type { Restaurant } from '../lib/types'
import { inr } from '../lib/format'
import { FoodThumb, Icon } from './ui'

export default function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      className="group flex gap-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-black/5 transition active:scale-[0.99]"
    >
      <FoodThumb
        emoji={restaurant.emoji}
        accent={restaurant.accent}
        seed={restaurant.name}
        imageUrl={restaurant.image_url}
        className="h-[86px] w-[86px]"
        emojiClass="text-4xl"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-[15px] font-bold leading-tight text-ink-900">{restaurant.name}</h3>
          <span className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
            <Icon.Star className="h-2.5 w-2.5" />
            {Number(restaurant.rating ?? 0).toFixed(1)}
          </span>
        </div>

        <p className="mt-0.5 truncate text-xs text-ink-500">{restaurant.cuisine}</p>

        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-ink-500">
          <Icon.Pin className="h-3 w-3 shrink-0" />
          {restaurant.area}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-ink-700">
          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-brand-700">
            {restaurant.delivery_minutes} min
          </span>
          <span className="text-ink-300">•</span>
          <span>{restaurant.delivery_fee === 0 ? 'Free delivery' : `${inr(restaurant.delivery_fee)} delivery`}</span>
          <span className="text-ink-300">•</span>
          <span>{inr(restaurant.price_for_two)} for two</span>
        </div>
      </div>

      {!restaurant.is_open && (
        <span className="pointer-events-none absolute" aria-hidden>
          {null}
        </span>
      )}
    </Link>
  )
}
