import type { Metadata } from 'next'
import { MarketGrid } from '@/components/markets/market-grid'
import { PageHeader } from '@/components/layout/page-header'
import { Cta } from '@/components/marketing/cta'

export const metadata: Metadata = {
  title: 'Markets',
  description:
    'Follow prices, 24-hour movement, volume and market capitalisation across supported digital assets.',
  alternates: { canonical: '/markets' },
}

export default function MarketsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Markets"
        title="Stay ahead of the market"
        description="Prices, 24-hour movement, trading volume and market capitalisation for every supported asset, in one place."
      />

      <section className="container-x py-12 sm:py-16">
        

        <MarketGrid className="mt-8" />
      </section>

      <Cta />
    </>
  )
}
