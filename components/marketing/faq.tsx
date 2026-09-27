'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import { Section, SectionHeading } from '@/components/ui/section'
import { Reveal } from '@/components/ui/reveal'
import { faqItems, type FaqItem } from '@/lib/faq-data'
import { cn } from '@/lib/utils'

export function Accordion({ items, className }: { items: FaqItem[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <ul className={cn('divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface', className)}>
      {items.map((item, index) => {
        const expanded = open === index
        return (
          <li key={item.question}>
            <h3>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : index)}
                aria-expanded={expanded}
                aria-controls={`faq-panel-${index}`}
                id={`faq-trigger-${index}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-white/[0.02] sm:px-6"
              >
                <span
                  className={cn(
                    'text-[15px] font-medium transition-colors',
                    expanded ? 'text-accent' : 'text-white',
                  )}
                >
                  {item.question}
                </span>
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
                    expanded
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-line text-muted',
                  )}
                  aria-hidden="true"
                >
                  {expanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </span>
              </button>
            </h3>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  key="panel"
                  id={`faq-panel-${index}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${index}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pr-12 text-sm leading-relaxed text-muted sm:px-6 sm:pb-6">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        )
      })}
    </ul>
  )
}

export function Faq({ items = faqItems.slice(0, 6) }: { items?: FaqItem[] }) {
  return (
    <Section id="faq" className="border-t border-line bg-base-800/40">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <SectionHeading
            eyebrow="FAQ"
            title="Questions, answered"
            description="If something here is unclear, contact support before you deposit or trade."
          />
          <Reveal>
            <Accordion items={items} />
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
