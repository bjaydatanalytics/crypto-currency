import Link from 'next/link'

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
