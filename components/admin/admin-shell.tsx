'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ExternalLink,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  Menu,
  Receipt,
  Settings,
  Layers,
  TrendingUp,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { LogoMark } from '@/components/brand/logo'
import { Badge } from '@/components/ui/badge'
import { brand } from '@/lib/config'
import { cn } from '@/lib/utils'

interface AdminEntry {
  label: string
  href: string
  Icon: LucideIcon
}

const adminNav: AdminEntry[] = [
  { label: 'Overview', href: '/admin', Icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', Icon: Users },
  { label: 'Investments', href: '/admin/investments', Icon: TrendingUp },
  { label: 'Transactions', href: '/admin/transactions', Icon: Receipt },
  { label: 'Deposits', href: '/admin/deposits', Icon: ArrowDownToLine },
  { label: 'Deposit addresses', href: '/admin/deposit-addresses', Icon: Wallet },
  { label: 'Withdrawals', href: '/admin/withdrawals', Icon: ArrowUpFromLine },
  { label: 'Plans', href: '/admin/plans', Icon: Layers },
  { label: 'Support', href: '/admin/support', Icon: LifeBuoy },
  { label: 'Market data', href: '/admin/market-data', Icon: LineChart },
  { label: 'Settings', href: '/admin/settings', Icon: Settings },
]

function AdminNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto p-4">
      <ul className="space-y-1">
        {adminNav.map(({ label, href, Icon }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:bg-white/[0.04] hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="mt-6 border-t border-line pt-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          User dashboard
        </Link>
      </div>
    </nav>
  )
}

function AdminSidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-line px-5">
        <LogoMark className="h-7 w-7 text-accent" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-[0.16em] text-white">
            {brand.wordmark}
          </p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Admin</p>
        </div>
      </div>
      <AdminNavList onNavigate={onNavigate} />
    </div>
  )
}

/**
 * Admin shell.
 *
 * Authorisation lives in `app/admin/layout.tsx`, which calls `gateAdmin()` —
 * a server-side role check against the database, not a client-side one. Nothing
 * in this component grants access, and nothing here should ever be the only
 * thing standing between a visitor and an admin screen.
 *
 * The API enforces the same check independently: every handler under
 * /api/admin calls `requireAdmin()`. The page gate and the route guard are
 * deliberately separate, because a page gate cannot protect an endpoint someone
 * calls directly.
 *
 * `data` has no default, on purpose — TypeScript makes every screen state
 * whether its figures are real. This badge used to read "Mock data" on every
 * admin page including Deposits and Withdrawals, where an operator moves actual
 * money; someone crediting a live deposit under a "Mock data" banner could
 * reasonably believe none of it counted. Mislabelling in either direction leads
 * to a decision made on a false premise, so neither gets to be the fallback.
 */
export function AdminShell({
  title,
  description,
  data,
  children,
}: {
  title: string
  description?: string
  /** 'live' — real records. 'mock' — sample figures, not this platform's data. */
  data: 'live' | 'mock'
  children: React.ReactNode
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-base">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] border-r border-line bg-base-800 lg:block">
        <AdminSidebarInner />
      </aside>

      <div className="lg:pl-[240px]">
        <header className="sticky top-0 z-30 border-b border-line bg-base-800/85 backdrop-blur-xl">
          <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open admin navigation"
              className="-ml-1 rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-white sm:text-lg">{title}</h1>
              {description && <p className="truncate text-xs text-muted">{description}</p>}
            </div>
            <Badge
              tone={data === 'live' ? 'success' : 'warn'}
              className="ml-auto shrink-0 normal-case tracking-normal"
              title={
                data === 'live'
                  ? 'Real records from the database. Actions here have real effects.'
                  : 'Sample figures for layout only — not this platform’s data.'
              }
            >
              {data === 'live' ? 'Live data' : 'Mock data'}
            </Badge>
          </div>
        </header>

        <main id="main" className="p-4 sm:p-6">
          {children}
        </main>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Admin navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="absolute inset-y-0 left-0 w-[min(84vw,280px)] border-r border-line bg-base-800"
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close admin navigation"
                className="absolute right-3 top-4 z-10 rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <AdminSidebarInner onNavigate={() => setDrawerOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
