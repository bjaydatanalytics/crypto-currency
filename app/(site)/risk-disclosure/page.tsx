import type { Metadata } from 'next'
import { LegalNotice, PageHeader, Prose } from '@/components/layout/page-header'
import { Reveal } from '@/components/ui/reveal'
import { Section } from '@/components/ui/section'
import { brand } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Risk Disclosure',
  description:
    'The risks of holding, trading and investing in digital assets — volatility, liquidity, custody, regulatory, technology and fraud risk.',
  alternates: { canonical: '/risk-disclosure' },
}

export default function RiskDisclosurePage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Risk disclosure"
        description="Read this before you deposit or trade. It sets out, in plain language, the ways you can lose money on this platform."
      />

      <Section>
        <div className="container-x">
          <Reveal className="max-w-3xl">
            <LegalNotice documentName="risk disclosure" />
          </Reveal>

          <Reveal className="mt-10">
            <Prose>
              <p className="rounded-xl border border-negative/25 bg-negative/[0.06] p-5 text-white/90">
                <strong className="text-white">
                  You can lose some or all of the money you put in.
                </strong>{' '}
                Digital assets are high-risk and highly volatile. They are not suitable for
                everyone. Only commit money you can afford to lose entirely without it affecting
                your standard of living.
              </p>

              <h2>1. No guaranteed returns</h2>
              <p>
                No product, plan or service offered by {brand.name} provides a guaranteed, fixed or
                risk-free return, and none is offered anywhere on this site. Any person or
                material — including anything claiming to be from {brand.name} — that promises
                guaranteed profits, "risk-free" investing, or a specific daily, weekly or monthly
                return is misrepresenting the product, and very probably attempting to defraud you.
              </p>
              <p>
                Past performance, whether of an asset, a strategy or another user, does not predict
                future results.
              </p>

              <h2>2. Market and volatility risk</h2>
              <p>
                Digital asset prices can move by very large percentages within hours, in either
                direction, and can fall to zero. Price movements are driven by factors including
                speculation, sentiment, concentration of holdings, regulatory announcements and
                technology changes — many of which cannot be predicted.
              </p>

              <h2>3. Liquidity risk</h2>
              <p>
                You may not be able to sell an asset at the price you see, at the time you want, or
                at all. In stressed markets, spreads widen, order books thin out, and orders may
                fill far from the last traded price.
              </p>

              <h2>4. Execution and slippage risk</h2>
              <p>
                The price displayed when you place an order is not a guarantee of the price you
                receive. Fast-moving markets, network delays and system outages can result in a
                materially worse execution price.
              </p>

              <h2>5. Custody and counterparty risk</h2>
              <p>
                Where assets are held on your behalf, you are exposed to the party holding them. If
                that party fails, is hacked, or becomes insolvent, you may lose your assets or rank
                as an unsecured creditor. Digital assets are not bank deposits, and no government
                deposit guarantee scheme applies to them.
              </p>
              <ul>
                <li>The custody arrangements for this platform have not yet been established.</li>
                <li>
                  Details of who holds assets, how, and what happens on insolvency must be
                  published before launch.
                </li>
              </ul>

              <h2>6. Technology risk</h2>
              <p>
                Blockchain transactions are generally irreversible. Sending funds to a wrong or
                malformed address, to the wrong network, or to an address you do not control
                normally means permanent loss with no recourse. Smart contracts may contain bugs.
                Networks can fork, congest, or halt.
              </p>

              <h2>7. Platform and operational risk</h2>
              <p>
                Access to the platform may be interrupted by maintenance, outages, connectivity
                problems or attack. You may be unable to trade or withdraw during such periods,
                including at exactly the moments when you most want to.
              </p>

              <h2>8. Regulatory and legal risk</h2>
              <p>
                Digital asset regulation is unsettled and changing in most jurisdictions. Future
                rules may restrict or prohibit activity, change the tax treatment of your holdings,
                or require the platform to suspend services in your country. Services may not be
                available to residents of every jurisdiction.
              </p>

              <h2>9. Fraud and scam risk</h2>
              <p>
                Digital assets attract fraud. Be alert to anyone who contacts you offering
                investment help, recovery of lost funds, or access to a "private" opportunity. Be
                particularly sceptical of:
              </p>
              <ul>
                <li>Promises of guaranteed or unusually consistent returns</li>
                <li>Pressure to act quickly, or to keep the opportunity confidential</li>
                <li>Requests for your password, two-factor codes, or recovery phrase</li>
                <li>Requests to install remote-access software</li>
                <li>Requests to move funds to a "safe" or "verification" address</li>
                <li>Accounts impersonating staff on social media or messaging apps</li>
              </ul>

              <h2>10. Tax</h2>
              <p>
                You are responsible for determining and paying any tax arising from your activity.
                {' '}{brand.name} does not provide tax advice. Tax treatment depends on your
                individual circumstances and may change.
              </p>

              <h2>11. No investment advice</h2>
              <p>
                Nothing on this platform — including market data, charts, analytics, alerts,
                educational material or plan descriptions — is investment, financial, legal or tax
                advice, or a recommendation to buy or sell anything. You make your own decisions.
                If you are unsure, take independent advice from a qualified, appropriately
                authorised adviser.
              </p>

              <h2>12. Suitability</h2>
              <p>
                Consider carefully whether you understand how digital assets work and whether you
                can afford the risk of losing your money. If you cannot answer both confidently, do
                not invest.
              </p>

              <h2>Demonstration build</h2>
              <p>
                This deployment is a demonstration. Prices, balances, holdings, transactions and
                investment records shown anywhere in the interface are sample data. They do not
                reflect real markets or any real account, and trading, deposits and withdrawals are
                disabled.
              </p>
            </Prose>
          </Reveal>
        </div>
      </Section>
    </>
  )
}
