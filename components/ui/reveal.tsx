'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'

interface RevealProps {
  children: React.ReactNode
  className?: string
  delay?: number
  /** Distance travelled on enter, in px. */
  y?: number
  as?: 'div' | 'section' | 'li' | 'article'
}

/**
 * Scroll-triggered fade + rise. Animates once, and collapses to a plain fade
 * when the visitor prefers reduced motion.
 */
export function Reveal({ children, className, delay = 0, y = 20, as = 'div' }: RevealProps) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as]

  return (
    <MotionTag
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(className)}
    >
      {children}
    </MotionTag>
  )
}

/** Parent that staggers its `RevealItem` children as the group scrolls in. */
export function RevealGroup({
  children,
  className,
  stagger = 0.08,
  as = 'div',
}: {
  children: React.ReactNode
  className?: string
  stagger?: number
  as?: 'div' | 'ul' | 'ol' | 'section'
}) {
  const MotionTag = motion[as]
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger } },
  }

  return (
    <MotionTag
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={variants}
      className={cn(className)}
    >
      {children}
    </MotionTag>
  )
}

export function RevealItem({
  children,
  className,
  as = 'div',
  ...rest
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'li' | 'article'
} & Pick<React.HTMLAttributes<HTMLElement>, 'id' | 'role'>) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as]
  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  }

  return (
    <MotionTag variants={variants} className={cn(className)} {...rest}>
      {children}
    </MotionTag>
  )
}
