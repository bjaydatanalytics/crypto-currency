import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Cta } from '@/components/marketing/cta'
import { Faq } from '@/components/marketing/faq'
import { Plans } from '@/components/marketing/plans'
import { faqItems } from '@/lib/faq-data'

/**
 * Rendered per request, not prerendered.
 *
 * This page shows published plan terms, which an operator can change at any
 * moment from /admin/plans. Prerendering would bake whatever the terms were at
 * build time into static HTML, so an edit would not reach visitors until the
 * next deploy — and stale commercial terms on a live page are the exact
 * problem this feature exists to solve.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Investment Plans',
  description:
    'Service tiers for tracking, analysing and managing digital assets. Amounts, fees and durations are configured by the operator.',
  alternates: { canonical: '/investment-plans' },
}

export default function InvestmentPlansPage() {
  return (
    <>
      <PageHeader
        eyebrow="Investment Plans"
        title="Plans built around tools, not promises"
        description="Each tier differs by the features and support it includes. No plan offers a fixed, guaranteed or risk-free return — and none is offered anywhere on this platform."
      />
      <Plans heading={false} />
      <Faq items={faqItems.filter((item) => /fee|risk|verification/i.test(item.question))} />
      <Cta />
    </>
  )
}
