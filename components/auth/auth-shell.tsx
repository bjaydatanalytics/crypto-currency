import Link from 'next/link'
import { FlaskConical } from 'lucide-react'

/** Shared heading + demo disclosure for every auth screen. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div>
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted">{description}</p>

      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn/[0.07] p-3.5">
        <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-white/75">
          Demonstration build — this form is not connected to an account system. Nothing is created
          or stored, and no credentials are transmitted.
        </p>
      </div>

      <div className="mt-7">{children}</div>

      {footer && <div className="mt-7 text-center text-sm text-muted">{footer}</div>}
    </div>
  )
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-accent underline underline-offset-4 transition-colors hover:text-accent-bright"
    >
      {children}
    </Link>
  )
}
