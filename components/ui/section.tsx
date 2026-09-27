import { cn } from '@/lib/utils'
import { Reveal } from './reveal'

interface SectionHeadingProps {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: 'left' | 'center'
  className?: string
  /** Heading level — keeps the document outline correct per page. */
  as?: 'h1' | 'h2' | 'h3'
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
  as: Tag = 'h2',
}: SectionHeadingProps) {
  return (
    <Reveal className={cn(align === 'center' && 'text-center', className)}>
      {eyebrow && (
        <span
          className={cn(
            'mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.07] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-accent',
          )}
        >
          <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
          {eyebrow}
        </span>
      )}
      <Tag
        className={cn(
          'text-balance font-semibold tracking-tight',
          Tag === 'h1'
            ? 'text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.06]'
            : 'text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.12]',
        )}
      >
        {title}
      </Tag>
      {description && (
        <p
          className={cn(
            'mt-4 text-[15px] leading-relaxed text-muted sm:text-base',
            align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-2xl',
          )}
        >
          {description}
        </p>
      )}
    </Reveal>
  )
}

export function Section({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('py-16 sm:py-20 lg:py-28', className)} {...props}>
      {children}
    </section>
  )
}
