import type { Metadata } from 'next'
import { Cta } from '@/components/marketing/cta'
import { Faq } from '@/components/marketing/faq'
import { Features } from '@/components/marketing/features'
import { Hero } from '@/components/marketing/hero'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { MarketSection } from '@/components/marketing/market-section'
import { Plans } from '@/components/marketing/plans'
import { Services } from '@/components/marketing/services'
import { Testimonials } from '@/components/marketing/testimonials'
import { TradingPreview } from '@/components/marketing/trading-preview'
import { Trust } from '@/components/marketing/trust'
import { DemoBanner } from '@/components/layout/demo-banner'
import { brand } from '@/lib/config'

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
  // `absolute` bypasses the root layout's "%s · Nexora" template, which would
  // otherwise render the brand twice in the home page's title tag.
  title: { absolute: `${brand.name} — ${brand.tagline}` },
  description: brand.description,
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <>
      <DemoBanner />
      <Hero />
      <Features />
      <MarketSection />
      <Services />
      <Plans />
      <HowItWorks />
      <TradingPreview />
      <Trust />
      <Faq />
      <Testimonials />
      <Cta />
    </>
  )
}
