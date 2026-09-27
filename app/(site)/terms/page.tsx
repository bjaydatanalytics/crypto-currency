import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalNotice, PageHeader, Prose } from '@/components/layout/page-header'
import { PendingInfo } from '@/components/ui/demo-notice'
import { Reveal } from '@/components/ui/reveal'
import { Section } from '@/components/ui/section'
import { brand } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `The agreement between you and ${brand.name}, covering eligibility, accounts, verification, fees, risk and liability.`,
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Terms of service"
        description="The agreement between you and the operator of this platform."
      />

      <Section>
        <div className="container-x">
          <Reveal className="max-w-3xl">
            <LegalNotice documentName="terms of service" />
          </Reveal>

          <Reveal className="mt-10">
            <Prose>
              <h2>1. Who these terms are with</h2>
              <p>
                These terms form an agreement between you and the company operating {brand.name}.
                The operating entity, its registration number and its registered address must be
                stated here before launch.
              </p>
              <p>
                <PendingInfo label="Operating entity, company number and registered address" />
              </p>

              <h2>2. Eligibility</h2>
              <ul>
                <li>You must be at least 18 years old, or the age of majority where you live.</li>
                <li>
                  You must not be resident in, or accessing the platform from, a jurisdiction where
                  the services are prohibited or where the operator is not permitted to offer them.
                </li>
                <li>
                  You must not be subject to sanctions, or acting for a sanctioned person or entity.
                </li>
                <li>You must be acting on your own behalf, not for an undisclosed third party.</li>
              </ul>
              <p>
                <PendingInfo label="List of restricted jurisdictions" />
              </p>

              <h2>3. Your account</h2>
              <p>
                You are responsible for keeping your credentials confidential and for all activity
                under your account. Notify support immediately if you suspect unauthorised access.
                You may hold one account unless the operator agrees otherwise in writing.
              </p>

              <h2>4. Verification, AML and KYC</h2>
              <p>
                Before you can transact you must complete identity verification. The operator is
                required to carry out anti-money-laundering and know-your-customer checks, which
                may include:
              </p>
              <ul>
                <li>Government-issued photographic identification</li>
                <li>Proof of address</li>
                <li>Source-of-funds and source-of-wealth information</li>
                <li>Ongoing transaction monitoring and periodic re-verification</li>
                <li>Sanctions and politically-exposed-person screening</li>
              </ul>
              <p>
                The operator may refuse, suspend or close an account, and may be required by law to
                report activity and to withhold notice that it has done so.
              </p>

              <h2>5. Services</h2>
              <p>
                The platform provides market data, portfolio tools and, where enabled, execution
                services. Services may be changed, suspended or withdrawn. Availability is not
                guaranteed and may be interrupted for maintenance or by events outside the
                operator's control.
              </p>

              <h2>6. No advice</h2>
              <p>
                Nothing provided through the platform is investment, legal, tax or accounting
                advice, or a recommendation. You are solely responsible for your decisions. See the{' '}
                <Link href="/risk-disclosure">risk disclosure</Link>.
              </p>

              <h2>7. Risk</h2>
              <p>
                You acknowledge that digital assets are volatile and high-risk, that you may lose
                some or all of the money you put in, that no return is guaranteed, and that you
                have read and understood the risk disclosure.
              </p>

              <h2>8. Fees</h2>
              <p>
                Fees are set out on the <Link href="/pricing">pricing page</Link> and may be
                amended on notice. You are responsible for network fees and for any charges levied
                by third parties such as banks and payment processors.
              </p>

              <h2>9. Deposits and withdrawals</h2>
              <p>
                Deposits and withdrawals are subject to verification, security checks, limits and
                network confirmation. Sending assets to an incorrect address or over an unsupported
                network will normally result in permanent, unrecoverable loss.
              </p>

              <h2>10. Prohibited use</h2>
              <ul>
                <li>Unlawful activity, including money laundering and terrorist financing</li>
                <li>Market manipulation, wash trading or abusive trading practices</li>
                <li>Circumventing security controls or accessing other users' accounts</li>
                <li>Automated access or scraping other than through a permitted API</li>
                <li>Providing false information during verification</li>
              </ul>

              <h2>11. Suspension and termination</h2>
              <p>
                The operator may suspend or terminate access where it reasonably suspects a breach
                of these terms, fraudulent or unlawful activity, or where required by law or a
                regulator.
              </p>

              <h2>12. Liability</h2>
              <p>
                Nothing in these terms excludes liability that cannot lawfully be excluded,
                including for fraud, or for death or personal injury caused by negligence. Subject
                to that, the operator is not liable for market losses arising from your own
                investment decisions. The full liability and indemnity provisions must be drafted
                by a qualified lawyer.
              </p>
              <p>
                <PendingInfo label="Liability, indemnity and warranty provisions" />
              </p>

              <h2>13. Complaints and disputes</h2>
              <p>
                A complaints procedure, escalation route and any applicable external dispute
                resolution scheme must be published here.
              </p>
              <p>
                <PendingInfo label="Complaints procedure and dispute resolution" />
              </p>

              <h2>14. Governing law</h2>
              <p>
                The governing law and the courts having jurisdiction must be specified by the
                operator's legal counsel.
              </p>
              <p>
                <PendingInfo label="Governing law and jurisdiction" />
              </p>

              <h2>15. Changes to these terms</h2>
              <p>
                These terms may be updated. Material changes will be notified in advance, and the
                date of the current version will be shown here.
              </p>
              <p>
                <PendingInfo label="Version and effective date" />
              </p>
            </Prose>
          </Reveal>
        </div>
      </Section>
    </>
  )
}
