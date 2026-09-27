import { Reveal } from '@/components/ui/reveal'
import { cn } from '@/lib/utils'

/** Standard hero band for inner pages. Renders the page's single h1. */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('relative overflow-hidden border-b border-line', className)}>
      <div className="glow-radial pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-fade opacity-40 [background-size:56px_56px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent)]"
        aria-hidden="true"
      />

      <div className="container-x py-14 sm:py-16 lg:py-20">
        <Reveal className="max-w-3xl">
          {eyebrow && (
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.07] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
              <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
              {eyebrow}
            </span>
          )}
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.08] tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-lg">
              {description}
            </p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </Reveal>
      </div>
    </section>
  )
}

/**
 * Readable column for legal and policy documents.
 * Styles headings, lists and paragraphs consistently without a plugin.
 */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-3xl text-[15px] leading-relaxed text-muted',
        '[&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white',
        '[&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white',
        '[&_p]:mt-4',
        '[&_ul]:mt-4 [&_ul]:space-y-2.5 [&_ul]:pl-5 [&_li]:list-disc [&_li]:marker:text-accent/60',
        '[&_ol]:mt-4 [&_ol]:space-y-2.5 [&_ol]:pl-5 [&_ol>li]:list-decimal',
        '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-accent-bright',
        '[&_strong]:font-medium [&_strong]:text-white',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Marks a legal document as a draft awaiting professional review. */
export function LegalNotice({ documentName }: { documentName: string }) {
  return (
    <div
      role="note"
      className="rounded-xl border border-warn/25 bg-warn/[0.07] p-5 text-sm leading-relaxed"
    >
      <p className="font-medium text-warn">Draft document — not yet legally reviewed</p>
      <p className="mt-2 text-white/70">
        This {documentName} is a structural template showing what the final document must cover. It
        is not legal advice and is not enforceable as drafted. Before launch it must be written or
        reviewed by a qualified lawyer in each jurisdiction the platform operates in, and completed
        with the operator's verified company details, regulatory status and data-processing
        arrangements.
      </p>
    </div>
  )
}
