import { FlaskConical } from 'lucide-react'
import { platform } from '@/lib/config'

/**
 * Site-wide capability banner.
 *
 * States precisely what is and isn't available on this deployment. It changes
 * with the flags rather than being a single fixed "demo" message, because the
 * accurate statement differs: a build with real accounts but no custodian is
 * not a demo, but it also cannot take a deposit.
 *
 * Deliberately not dismissible — a visitor landing mid-journey still needs it.
 */
export function DemoBanner() {
  // Everything is live; nothing to disclose.
  if (!platform.demoMode && platform.custodyEnabled && platform.tradingEnabled) return null

  const message = platform.demoMode ? (
    <>
      <span className="font-medium text-accent">Demonstration build</span>
      <span className="mx-1.5 text-muted">·</span>
      All prices, balances and transactions are sample data. No real funds or orders are
      involved.
    </>
  ) : (
    <>
      <span className="font-medium text-accent">Limited availability</span>
      <span className="mx-1.5 text-muted">·</span>
      Accounts and market data are live.{' '}
      {!platform.custodyEnabled && 'Deposits and withdrawals are not yet available. '}
      {!platform.tradingEnabled && 'Trading is not yet available.'}
    </>
  )

  return (
    <div className="relative z-[55] border-b border-accent/15 bg-accent/[0.06]">
      <div className="container-x flex items-center justify-center gap-2.5 py-2 text-center">
        <FlaskConical className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
        <p className="text-[12px] leading-snug text-white/80">{message}</p>
      </div>
    </div>
  )
}
