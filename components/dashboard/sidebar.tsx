'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/brand/logo'
import { ButtonLink } from '@/components/ui/button'
import { cn, formatMoney } from '@/lib/utils'
import { LogoutButton } from './logout-button'
import { useSummary } from './summary-provider'
import { marketsNav, primaryNav, secondaryNav, type NavEntry } from './sidebar-nav'

function isActive(pathname: string, href: string) {
  const [base] = href.split('#')
  if (base === '/dashboard') return pathname === '/dashboard'
  return pathname === base || pathname.startsWith(`${base}/`)
}

/* ------------------------------------------------------------------ */
/* Balance summary                                                     */
/* ------------------------------------------------------------------ */

/**
 * One wallet figure.
 *
 * The amount and its currency are sized differently but sit on one baseline,
 * so the eye lands on the number rather than reading "0.00 USD" as a phrase.
 */
function WalletLine({ amount, label }: { amount: number; label: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="num text-xl font-semibold tracking-tight text-ink">
        {formatMoney(amount)}
      </span>
      <span className="text-[11px] text-muted">{label}</span>
    </p>
  )
}

function BalanceSummary({ onNavigate }: { onNavigate?: () => void }) {
  const { summary } = useSummary()

  return (
    <div className="border-b border-line px-5 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        Account balance
      </p>

      <div className="mt-3 space-y-1">
        <WalletLine amount={summary.wallets.deposit.usd} label="USD (Deposit Wallet)" />
        <WalletLine amount={summary.wallets.interest.usd} label="USD (Interest Wallet)" />
      </div>

      {/**
       * Shown only when a held asset has no live price behind it. Without this
       * the customer reads a USD total that silently omits part of what they
       * hold, which is worse than an incomplete figure they know is incomplete.
       */}
      {summary.pricesStale && (
        <p className="mt-2 text-[11px] leading-snug text-warn">
          Some prices are unavailable, so these totals may be incomplete.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <ButtonLink
          href="/dashboard/deposits"
          onClick={onNavigate}
          size="sm"
          className="flex-1 shadow-none hover:shadow-none"
        >
          Deposit
        </ButtonLink>
        <ButtonLink
          href="/dashboard/withdrawals"
          onClick={onNavigate}
          variant="navy"
          size="sm"
          className="flex-1"
        >
          Withdraw
        </ButtonLink>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

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
    <ul className="space-y-0.5">
      {entries.map(({ label, href, Icon, planned }) => {
        const active = isActive(pathname, href)
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-accent/10 font-medium text-accent'
                  : 'text-muted hover:bg-elevate/[0.04] hover:text-ink',
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0',
                  active ? 'text-accent' : 'text-muted group-hover:text-ink',
                )}
                aria-hidden="true"
              />
              <span className="truncate">{label}</span>
              {planned && (
                <span className="ml-auto shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted">
                  Soon
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function NavGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 mt-5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/70">
      {children}
    </p>
  )
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[68px] shrink-0 items-center border-b border-line px-5">
        <Logo />
      </div>

      <div className="flex-1 overflow-y-auto">
        <BalanceSummary onNavigate={onNavigate} />

        <nav aria-label="Dashboard" className="p-3">
          <NavList entries={primaryNav} pathname={pathname} onNavigate={onNavigate} />

          <NavGroupLabel>Markets</NavGroupLabel>
          <NavList entries={marketsNav} pathname={pathname} onNavigate={onNavigate} />

          <NavGroupLabel>Account</NavGroupLabel>
          <NavList entries={secondaryNav} pathname={pathname} onNavigate={onNavigate} />

          <div className="my-3 h-px bg-line" role="separator" />

          <LogoutButton onDone={onNavigate} />
        </nav>
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
