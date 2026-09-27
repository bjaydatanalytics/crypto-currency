import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** Adds a lift + accent border on hover. Use for interactive cards only. */
  interactive?: boolean
  /** Slightly lighter fill for cards sitting on top of other cards. */
  raised?: boolean
  as?: 'div' | 'article' | 'section' | 'li'
}

export function Card({
  className,
  interactive,
  raised,
  as = 'div',
  children,
  ...props
}: CardProps) {
  // Union of intrinsic tags: widen so the shared handler props typecheck.
  const Tag = as as React.ElementType
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-line',
        raised ? 'bg-surface-raised' : 'bg-surface',
        interactive &&
          'transition-all duration-300 hover:border-accent/30 hover:bg-surface-raised hover:-translate-y-0.5',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 border-b border-line p-5', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold text-white', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted', className)} {...props} />
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-t border-line p-5', className)} {...props} />
}
