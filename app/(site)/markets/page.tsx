import type { Metadata } from 'next'
import { MarketGrid } from '@/components/markets/market-grid'
import { PageHeader } from '@/components/layout/page-header'
import { Cta } from '@/components/marketing/cta'
import { DemoNotice } from '@/components/ui/demo-notice'

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
        <DemoNotice title="Sample market data">
          The prices below are simulated and update on a timer to demonstrate the interface. They
          are not live market rates and must not be used to make any decision. A real market data
          feed connects through <code className="text-white/80">lib/api/markets.ts</code>.
        </DemoNotice>

        <MarketGrid className="mt-8" />
      </section>

      <Cta />
    </>
  )
}
