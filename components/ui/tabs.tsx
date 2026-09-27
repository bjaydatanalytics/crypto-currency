'use client'

import { motion } from 'framer-motion'
import { useId } from 'react'
import { cn } from '@/lib/utils'

export interface TabItem {
  value: string
  label: string
  count?: number
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
  /** `pill` for filter bars, `underline` for section navigation. */
  variant?: 'pill' | 'underline'
  size?: 'sm' | 'md'
}

export function Tabs({
  items,
  value,
  onChange,
  className,
  variant = 'pill',
  size = 'md',
}: TabsProps) {
  // Unique per instance so multiple tab bars don't share a layout animation
  const layoutId = useId()

  return (
    <div
      role="tablist"
      className={cn(
        'no-scrollbar flex gap-1 overflow-x-auto',
        variant === 'pill' && 'rounded-xl border border-line bg-surface p-1',
        variant === 'underline' && 'border-b border-line',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative shrink-0 whitespace-nowrap font-medium transition-colors',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
              variant === 'pill' && 'rounded-lg',
              variant === 'underline' && 'pb-3',
              active ? 'text-black' : 'text-muted hover:text-white',
              variant === 'underline' && active && 'text-accent',
            )}
          >
            {active && variant === 'pill' && (
              <motion.span
                layoutId={`${layoutId}-pill`}
                className="absolute inset-0 rounded-lg bg-accent"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            {active && variant === 'underline' && (
              <motion.span
                layoutId={`${layoutId}-underline`}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] num',
                    active && variant === 'pill'
                      ? 'bg-black/15 text-black'
                      : 'bg-white/[0.08] text-muted',
                  )}
                >
                  {item.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
