import { cn } from '@/lib/utils'

/**
 * Table primitives.
 *
 * Wide financial tables are wrapped in a horizontally scrollable container so
 * they never force the page itself to scroll sideways. On small screens most
 * screens swap the table out for `MobileCardList` instead — see the dashboard
 * tables for the pattern.
 */

export function TableWrap({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('w-full overflow-x-auto', className)} {...props} />
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full min-w-[640px] border-collapse', className)} {...props} />
}

export function Thead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('', className)} {...props} />
}

export function Tbody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('', className)} {...props} />
}

export function Tr({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'border-b border-line last:border-0',
        interactive && 'transition-colors hover:bg-white/[0.03]',
        className,
      )}
      {...props}
    />
  )
}

export function Th({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  )
}

export function Td({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'whitespace-nowrap px-4 py-4 text-sm text-white/90',
        numeric && 'num text-right',
        className,
      )}
      {...props}
    />
  )
}

/** Container used when a table collapses into stacked cards on mobile. */
export function MobileCardList({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn('space-y-3', className)} {...props} />
}

export function MobileCard({ className, ...props }: React.LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={cn('rounded-xl border border-line bg-surface-raised p-4', className)}
      {...props}
    />
  )
}

export function MobileRow({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1.5', className)}>
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      <span className="text-sm text-white/90">{value}</span>
    </div>
  )
}
