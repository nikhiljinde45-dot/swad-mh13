import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Icon } from './ui'
import { api } from '../lib/api'
import type { AppConfig } from '../lib/types'

const TITLES: Record<string, string> = {
  '/panels': 'Choose a panel',
  '/owner': 'Restaurant Owner',
  '/rider': 'Delivery Rider',
  '/admin': 'Admin Console',
}

export default function PanelLayout() {
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'Partner'
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    api
      .config()
      .then(setConfig)
      .catch(() => setConfig(null))
  }, [])

  const missing = config?.missing_tables ?? []

  return (
    <div className="min-h-dvh bg-ink-900/[0.03]">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 pt-safe backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/panels"
            aria-label="Back to panels"
            className="grid h-9 w-9 place-items-center rounded-xl text-ink-700 ring-1 ring-ink-300 transition hover:bg-brand-50"
          >
            <Icon.Back />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-brand-600">
              Swad MH13
            </p>
            <h1 className="truncate text-sm font-bold text-ink-900">{title}</h1>
          </div>
          <Link
            to="/"
            className="shrink-0 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-200"
          >
            Customer app
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        {missing.length > 0 && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900"
          >
            <strong className="font-bold">Database tables missing:</strong>{' '}
            <span className="font-mono">{missing.join(', ')}</span>. Run{' '}
            <code className="rounded bg-amber-900/10 px-1 py-0.5 font-mono">supabase/schema.sql</code>{' '}
            in your Supabase SQL editor to create them. Until then those panels run on built-in demo
            data, so you can still test them.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
