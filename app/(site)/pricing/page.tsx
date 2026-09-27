import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Cta } from '@/components/marketing/cta'
import { Plans } from '@/components/marketing/plans'
import { Card } from '@/components/ui/card'
import { PendingInfo, RiskNotice } from '@/components/ui/demo-notice'
import { Reveal } from '@/components/ui/reveal'
import { Section, SectionHeading } from '@/components/ui/section'
import {
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/table'

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
  title: 'Pricing',
  description:
    'Fee schedule for trading, deposits, withdrawals and plans. Rates are set by the operator and published in full before launch.',
  alternates: { canonical: '/pricing' },
}

/**
 * Fee schedule.
 *
 * Every rate is null. Fees directly reduce what a customer keeps, so inventing
 * a "typical" number here would be a material misrepresentation — the rows show
 * what will be charged for, and the amount is filled in by the operator.
 */
const feeRows: Array<{ item: string; basis: string; rate: string | null }> = [
  { item: 'Spot trading — maker', basis: 'Percentage of order value', rate: null },
  { item: 'Spot trading — taker', basis: 'Percentage of order value', rate: null },
  { item: 'Deposit — crypto', basis: 'Per transaction', rate: null },
  { item: 'Deposit — bank transfer', basis: 'Per transaction', rate: null },
  { item: 'Withdrawal — crypto', basis: 'Network fee plus platform fee', rate: null },
  { item: 'Withdrawal — bank transfer', basis: 'Per transaction', rate: null },
  { item: 'Internal transfer', basis: 'Per transaction', rate: null },
  { item: 'Currency conversion', basis: 'Spread applied to the rate', rate: null },
  { item: 'Account maintenance', basis: 'Monthly', rate: null },
  { item: 'Plan fee', basis: 'Per plan, see Investment Plans', rate: null },
]

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Fees, in full and in one place"
        description="Every charge that can apply to your account is listed below. Rates are set by the operator and have not yet been supplied — no figure appears here until it is the real one."
      />

      <Section>
        <div className="container-x">
          <SectionHeading
            title="Fee schedule"
            description="Fees reduce your returns. Read this alongside the risk disclosure before you deposit."
          />

          <Reveal className="mt-8">
            <Card className="overflow-hidden">
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Charge</Th>
                      <Th>Basis</Th>
                      <Th numeric>Rate</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {feeRows.map((row) => (
                      <Tr key={row.item} interactive>
                        <Td className="font-medium text-white">{row.item}</Td>
                        <Td className="text-muted">{row.basis}</Td>
                        <Td numeric>
                          {row.rate ?? (
                            <span className="text-xs italic text-muted">Not yet published</span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            </Card>
          </Reveal>

          <Reveal className="mt-6 flex flex-wrap items-center gap-3">
            <PendingInfo label="Complete fee schedule with rates" />
            <PendingInfo label="Third-party payment processor charges" />
          </Reveal>

          <Reveal className="mt-8">
            <Card className="p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
                What else affects the price you get
              </h3>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
                <li className="flex gap-2.5">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span>
                    <strong className="font-medium text-white">Spread.</strong> The gap between the
                    buy and sell price is a cost even where no fee is charged.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span>
                    <strong className="font-medium text-white">Slippage.</strong> Fast-moving
                    markets can fill an order at a worse price than the one displayed.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span>
                    <strong className="font-medium text-white">Network fees.</strong> Blockchain
                    transaction costs are set by the network, vary with congestion, and are not
                    refundable.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span>
                    <strong className="font-medium text-white">Tax.</strong> You are responsible
                    for any tax arising from your activity. The platform does not provide tax
                    advice.
                  </span>
                </li>
              </ul>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Plans />

      <div className="container-x pb-16">
        <RiskNotice className="mx-auto max-w-3xl" />
      </div>

      <Cta />
    </>
  )
}
