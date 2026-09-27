import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { MarketGrid } from '@/components/markets/market-grid'
import { DemoInline } from '@/components/ui/demo-notice'
import { Section, SectionHeading } from '@/components/ui/section'

export function MarketSection() {
  return (
    <Section id="markets">
      <div className="container-x">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Markets"
            title="Stay Ahead of the Market"
            description="Follow prices, 24-hour movement and market depth across supported digital assets in one view."
          />
          <Link
            href="/markets"
            className="group inline-flex shrink-0 items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent-bright"
          >
            View all markets
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        <DemoInline
          className="mt-5"
          text="Prices below are simulated sample data, not live market rates."
        />

        <MarketGrid
          className="mt-6"
          symbols={['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'USDT']}
        />
      </div>
    </Section>
  )
}
