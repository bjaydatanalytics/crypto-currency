'use client'

import Link from 'next/link'
import { ShieldAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useAccount } from './account-provider'
import { useSummary } from './summary-provider'

type Tone = 'danger' | 'warn'

const toneStyles: Record<Tone, { icon: string; ring: string }> = {
  danger: { icon: 'text-negative', ring: 'bg-negative/10' },
  warn: { icon: 'text-warn', ring: 'bg-warn/10' },
}

function AlertStrip({
  tone,
  Icon,
  title,
  children,
}: {
  tone: Tone
  Icon: LucideIcon
  title: string
  children: React.ReactNode
}) {
  const styles = toneStyles[tone]

  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 sm:px-5">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${styles.ring}`}
      >
        <Icon className={`h-4 w-4 ${styles.icon}`} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[13px] italic leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  )
}

function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium not-italic text-accent hover:underline">
      {children}
    </Link>
  )
}

/**
 * The account notices above the dashboard figures.
 *
 * Each one is conditional on the state it describes, so a funded account with
 * two-factor already on sees none of them. A banner that is always present is
 * read as decoration and stops carrying information — which matters most for
 * the security prompt, the one notice worth acting on.
 */
export function AccountAlerts() {
  const account = useAccount()
  const { summary } = useSummary()

  const emptyBalance = summary.wallets.deposit.usd === 0 && summary.wallets.locked.usd === 0
  // Null account means no backend; nagging a non-existent user about 2FA is noise.
  const needsTwoFactor = account !== null && !account.twoFactorEnabled

  if (!emptyBalance && !needsTwoFactor) return null

  return (
    <div className="space-y-3">
      {emptyBalance && (
        <AlertStrip tone="danger" Icon={TriangleAlert} title="Empty Balance">
          Your balance is empty. Please make a{' '}
          <InlineLink href="/dashboard/deposits">deposit</InlineLink> for your next investment.
        </AlertStrip>
      )}

      {needsTwoFactor && (
        <AlertStrip tone="warn" Icon={ShieldAlert} title="2FA Authentication">
          To keep your account safe, please enable{' '}
          <InlineLink href="/dashboard/security#two-factor">2FA</InlineLink> security. It adds a
          second check before anyone can sign in or move funds.
        </AlertStrip>
      )}
    </div>
  )
}
