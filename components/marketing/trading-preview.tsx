import { TradingInterface } from '@/components/trading/trading-interface'
import { Section, SectionHeading } from '@/components/ui/section'
import { Reveal } from '@/components/ui/reveal'

export function TradingPreview() {
  return (
    <Section id="trading">
      <div className="container-x">
        <SectionHeading
          eyebrow="Trading experience"
          title="A trading view built for clarity"
          description="Pick a market, read the chart across timeframes and review an order before you place it. This preview runs in demo mode — nothing here reaches a venue."
          align="center"
          className="mx-auto max-w-2xl"
        />

        <Reveal className="mt-12">
          <TradingInterface />
        </Reveal>
      </div>
    </Section>
  )
}
