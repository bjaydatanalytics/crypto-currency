import {
  ArrowLeftRight,
  BarChart3,
  Coins,
  Layers,
  PiggyBank,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { Section, SectionHeading } from '@/components/ui/section'

interface Service {
  id: string
  Icon: LucideIcon
  title: string
  description: string
  points: string[]
  /** Services whose commercial terms the client has not yet supplied. */
  pendingTerms?: boolean
  /** Risk statement — required for anything that carries market or credit risk. */
  risk?: string
}

/**
 * Service catalogue.
 *
 * Three services are specified well enough to describe here. The other three —
 * copy trading, savings and staking — depend on commercial terms (supported
 * assets, rates, lock-up periods, counterparty arrangements) that only the
 * operator can supply. Rather than invent plausible-looking numbers, those
 * cards state what is missing and what has to be published before launch.
 */
const services: Service[] = [
  {
    id: 'spot-trading',
    Icon: ArrowLeftRight,
    title: 'Spot Trading',
    description: 'Buy and sell supported digital assets.',
    points: [
      'Market, limit and stop order types',
      'Order preview before submission',
      'Full trade history and exportable records',
    ],
    risk: 'Prices can move sharply. Orders may fill at a different price than shown, and you may get back less than you put in.',
  },
  {
    id: 'portfolio-management',
    Icon: Layers,
    title: 'Portfolio Management',
    description: 'Monitor and organize digital asset holdings.',
    points: [
      'Holdings, valuation and allocation in one view',
      'Performance history over selectable windows',
      'Position-level detail per asset',
    ],
    risk: 'Portfolio tools report on your holdings; they do not reduce market risk or protect against loss.',
  },
  {
    id: 'market-analytics',
    Icon: BarChart3,
    title: 'Market Analytics',
    description: 'Access charts, market data and analytical tools.',
    points: [
      'Price charts across multiple timeframes',
      'Volume, market cap and 24-hour range',
      'Configurable market alerts',
    ],
    risk: 'Analytics are informational only and are not investment advice or a prediction of future prices.',
  },
  {
    id: 'copy-trading',
    Icon: Users,
    title: 'Copy Trading',
    description:
      'Mirror the trades of another account automatically. Not enabled in this build.',
    points: [
      'Requires: how allocations are sized and executed',
      'Requires: fees charged by the platform and the lead trader',
      'Requires: how past performance is measured and disclosed',
    ],
    pendingTerms: true,
    risk: 'Copy trading exposes you to another person’s decisions and to execution delay. Past results of any trader do not indicate future results, and losses can exceed those of trading yourself.',
  },
  {
    id: 'crypto-savings',
    Icon: PiggyBank,
    title: 'Crypto Savings',
    description: 'Hold balances under agreed terms. Not enabled in this build.',
    points: [
      'Requires: the actual rates offered, and how they are set',
      'Requires: lock-up periods and withdrawal conditions',
      'Requires: who holds the assets and what happens on default',
    ],
    pendingTerms: true,
    risk: 'Savings products are not bank deposits and are typically not covered by any deposit guarantee scheme. Your balance is exposed to the counterparty holding it.',
  },
  {
    id: 'staking',
    Icon: Coins,
    title: 'Staking',
    description:
      'Participate in network validation with supported assets. Not enabled in this build.',
    points: [
      'Requires: which assets and networks are supported',
      'Requires: current reward rates and how they vary',
      'Requires: unbonding periods and slashing exposure',
    ],
    pendingTerms: true,
    risk: 'Staking rewards vary with network conditions and are not fixed. Staked assets may be locked for a period and can be lost through network penalties.',
  },
]

export function Services() {
  return (
    <Section id="services" className="border-t border-line bg-base-800/40">
      <div className="container-x">
        <SectionHeading
          eyebrow="Services"
          title="Everything you need in one platform"
          description="Tools for trading, tracking and analysing digital assets — with the terms of each service stated plainly."
          align="center"
          className="mx-auto max-w-2xl"
        />

        <RevealGroup as="ul" className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <RevealItem as="li" key={service.id} id={service.id} className="scroll-mt-28 list-none">
              <Card interactive className="flex h-full flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                    <service.Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {service.pendingTerms && <Badge tone="warn">Terms pending</Badge>}
                </div>

                <h3 className="mt-5 text-base font-semibold uppercase tracking-wide text-white">
                  {service.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{service.description}</p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {service.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-white/75">
                      <span
                        className={
                          service.pendingTerms
                            ? 'mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn'
                            : 'mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent'
                        }
                        aria-hidden="true"
                      />
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>

                {service.risk && (
                  <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
                    <span className="font-medium text-white/70">Risk: </span>
                    {service.risk}
                  </p>
                )}
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </Section>
  )
}
