'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { cn } from '@/lib/utils'
import { accountInitials, accountName, useAccount } from './account-provider'
import { primaryNav, secondaryNav, transferNav, type NavEntry } from './sidebar-nav'

function isActive(pathname: string, href: string) {
  const [base] = href.split('#')
  if (base === '/dashboard') return pathname === '/dashboard'
  return pathname === base || pathname.startsWith(`${base}/`)
}

function NavList({
  entries,
  pathname,
  onNavigate,
}: {
  entries: NavEntry[]
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <ul className="space-y-1">
      {entries.map(({ label, href, Icon }) => {
        const active = isActive(pathname, href)
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:bg-white/[0.04] hover:text-white',
              )}
            >
              <Icon
                className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-muted group-hover:text-white')}
                aria-hidden="true"
              />
              <span className="truncate">{label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const account = useAccount()
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[68px] shrink-0 items-center border-b border-line px-5">
        <Logo />
      </div>

      <nav aria-label="Dashboard" className="flex-1 overflow-y-auto p-4">
        <NavList entries={primaryNav} pathname={pathname} onNavigate={onNavigate} />

        <p className="mb-2 mt-6 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted/70">
          Transfers
        </p>
        <NavList entries={transferNav} pathname={pathname} onNavigate={onNavigate} />

        <div className="my-5 h-px bg-line" role="separator" />

        <NavList entries={secondaryNav} pathname={pathname} onNavigate={onNavigate} />
      </nav>

      <div className="shrink-0 border-t border-line p-4">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-xs font-semibold text-accent"
            aria-hidden="true"
          >
            {accountInitials(account)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{accountName(account)}</p>
            <p className="truncate text-[11px] text-muted">
              {account ? account.email : 'No backend configured'}
            </p>
          </div>
        </div>

        <Link
          href="/"
          onClick={onNavigate}
          className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logout
        </Link>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-line bg-base-800 lg:block">
      <SidebarContent />
    </aside>
  )
}
