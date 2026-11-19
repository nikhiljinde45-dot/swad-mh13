import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { AppConfig } from '../lib/types'
import { Icon } from '../components/ui'

const PANELS = [
  {
    to: '/owner',
    title: 'Restaurant Owner',
    body: 'Profile, menu, photos, prices and incoming orders.',
    emoji: '👨‍🍳',
    ring: 'ring-amber-200',
    tint: 'from-amber-50 to-orange-50',
  },
  {
    to: '/rider',
    title: 'Delivery Rider',
    body: 'Assigned deliveries and live status updates.',
    emoji: '🛵',
    ring: 'ring-emerald-200',
    tint: 'from-emerald-50 to-teal-50',
  },
  {
    to: '/admin',
    title: 'Admin Console',
    body: 'Customers, restaurants, riders, orders and revenue.',
    emoji: '🛡️',
    ring: 'ring-violet-200',
    tint: 'from-violet-50 to-fuchsia-50',
  },
  {
    to: '/',
    title: 'Customer App',
    body: 'Browse restaurants, order food and track delivery.',
    emoji: '🍛',
    ring: 'ring-brand-200',
    tint: 'from-brand-50 to-rose-50',
  },
]

export default function PanelsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    api
      .config()
      .then(setConfig)
      .catch(() => setConfig(null))
  }, [])

  return (
    <div>
      <div className="rounded-3xl bg-gradient-to-br from-ink-900 via-ink-900 to-brand-800 p-5 text-white shadow-card">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-200">
          Swad MH13 workspace
        </p>
        <h2 className="mt-1 text-xl font-extrabold leading-tight">Four panels, one platform</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/70">
          Customers order, owners cook, riders deliver and admins keep the MH-13 belt running.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold ring-1 ring-white/20">
            React + TypeScript + Tailwind
          </span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold ring-1 ring-white/20">
            {config?.mode === 'supabase' ? 'Supabase connected' : 'Demo data'}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <Link
            key={panel.to}
            to={panel.to}
            className={`group flex items-start gap-3 rounded-2xl bg-gradient-to-br ${panel.tint} p-4 shadow-card ring-1 ${panel.ring} transition active:scale-[0.99]`}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-sm">
              {panel.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-sm font-bold text-ink-900">
                {panel.title}
                <Icon.Back className="h-3.5 w-3.5 rotate-180 text-ink-500 transition group-hover:translate-x-0.5" />
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-700">{panel.body}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
        <h3 className="text-sm font-bold text-ink-900">Supabase status</h3>
        {config?.mode === 'supabase' ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <Icon.Check className="h-4 w-4" /> Connected — reads and writes go to your database.
          </p>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-ink-700">
            Running on the built-in demo catalogue. Add <code className="rounded bg-ink-900/5 px-1">SUPABASE_URL</code>{' '}
            and <code className="rounded bg-ink-900/5 px-1">SUPABASE_ANON_KEY</code> in Settings →
            Environment variables, then run the SQL in <code className="rounded bg-ink-900/5 px-1">supabase/schema.sql</code>.
          </p>
        )}
        {config?.warning && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
            {config.warning}
          </p>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
          Credentials are read only by the Node server. Nothing secret is bundled into the browser.
        </p>
      </div>

      <p className="mt-4 text-center text-[10px] text-ink-500">
        Panels are open demos — add Supabase Auth + row-level policies before going live.
      </p>
    </div>
  )
}
