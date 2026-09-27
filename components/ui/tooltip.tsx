'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'bottom'
  className?: string
}

/**
 * Hover + focus tooltip. Focus support matters here: several tooltips carry
 * risk and demo-data caveats that keyboard users must be able to reach.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className={cn(
              'absolute left-1/2 z-50 w-max max-w-[260px] -translate-x-1/2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs font-normal leading-relaxed text-white/90 shadow-xl',
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            )}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/** Small "i" affordance that opens a tooltip — used beside figures and terms. */
export function InfoTip({ content, className }: { content: React.ReactNode; className?: string }) {
  return (
    <Tooltip content={content}>
      <button
        type="button"
        aria-label="More information"
        className={cn('text-muted transition-colors hover:text-accent', className)}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  )
}
