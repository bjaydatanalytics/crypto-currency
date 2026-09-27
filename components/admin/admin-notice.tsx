import { ShieldAlert } from 'lucide-react'

/**
 * Standing warning shown on every admin screen.
 *
 * These routes have no access control in this build. The warning stays until a
 * real authorisation layer exists — it is the only thing standing between this
 * scaffolding and someone assuming it is protected.
 */
export function AdminNotice() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-negative/25 bg-negative/[0.06] p-4"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-negative">Unprotected scaffolding — not for deployment</p>
        <p className="mt-1 leading-relaxed text-white/70">
          These admin screens have no authentication or authorisation: any visitor who knows the
          URL can open them. All figures are mock data and no control writes to anything. Put every
          <code className="mx-1 rounded bg-white/[0.06] px-1 py-0.5 text-xs text-white/80">
            /admin
          </code>
          route behind a server-side role check before this is deployed anywhere reachable.
        </p>
      </div>
    </div>
  )
}
