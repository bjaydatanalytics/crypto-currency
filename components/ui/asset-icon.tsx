import { cn } from '@/lib/utils'

const sizes = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
}

/**
 * Ticker chip used instead of third-party coin logos.
 *
 * Drawing the symbol ourselves avoids shipping other projects' trademarked
 * artwork and keeps every asset visually consistent.
 */
export function AssetIcon({
  symbol,
  color,
  size = 'md',
  className,
}: {
  symbol: string
  color: string
  size?: keyof typeof sizes
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-semibold tracking-tight',
        sizes[size],
        className,
      )}
      style={{
        backgroundColor: `${color}1F`,
        borderColor: `${color}4D`,
        color,
      }}
    >
      {symbol.slice(0, 3)}
    </span>
  )
}

/** Signed change value with consistent colour + sign handling. */
export function ChangePill({
  value,
  className,
  showBackground = true,
}: {
  value: number
  className?: string
  showBackground?: boolean
}) {
  const positive = value >= 0
  return (
    <span
      className={cn(
        'num inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium',
        positive ? 'text-positive' : 'text-negative',
        showBackground && (positive ? 'bg-positive/10' : 'bg-negative/10'),
        className,
      )}
    >
      {positive ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  )
}
