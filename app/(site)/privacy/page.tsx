import type { Metadata } from 'next'
import { LegalNotice, PageHeader, Prose } from '@/components/layout/page-header'
import { PendingInfo } from '@/components/ui/demo-notice'
import { Reveal } from '@/components/ui/reveal'
import { Section } from '@/components/ui/section'
import { brand } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${brand.name} collects, uses, stores and shares personal data, and the rights you have over it.`,
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Privacy policy"
        description="What personal data is collected, why, how long it is kept, who it is shared with and what rights you have."
      />

      <Section>
        <div className="container-x">
          <Reveal className="max-w-3xl">
            <LegalNotice documentName="privacy policy" />
          </Reveal>

          <Reveal className="mt-10">
            <Prose>
              <h2>1. Who is responsible for your data</h2>
              <p>
                The data controller is the company operating {brand.name}. Its identity, registered
                address and data protection contact must be stated here before launch, together
                with a representative or Data Protection Officer where one is required.
              </p>
              <p>
                <PendingInfo label="Data controller identity and DPO contact" />
              </p>

              <h2>2. What data is collected</h2>
              <h3>Information you provide</h3>
              <ul>
                <li>Name, email address, phone number and date of birth</li>
                <li>
                  Verification documents: identification, proof of address, and source-of-funds
                  information
                </li>
                <li>Support correspondence</li>
              </ul>
              <h3>Information collected automatically</h3>
              <ul>
                <li>IP address, device and browser information</li>
                <li>Sign-in times, locations and session activity</li>
                <li>Usage data about how the platform is used</li>
              </ul>
              <h3>Information from third parties</h3>
              <ul>
                <li>Identity verification and sanctions screening providers</li>
                <li>Payment providers and, where applicable, blockchain analytics providers</li>
              </ul>

              <h2>3. Why it is used, and on what legal basis</h2>
              <ul>
                <li>
                  <strong>To provide the service</strong> — performance of the contract with you
                </li>
                <li>
                  <strong>Identity verification, AML and sanctions screening</strong> — compliance
                  with a legal obligation
                </li>
                <li>
                  <strong>Fraud prevention and platform security</strong> — legitimate interests
                </li>
                <li>
                  <strong>Service communications</strong> — performance of the contract
                </li>
                <li>
                  <strong>Marketing</strong> — consent, which you can withdraw at any time
                </li>
              </ul>

              <h2>4. Who it is shared with</h2>
              <p>
                Personal data may be shared with identity verification providers, payment and
                banking partners, cloud hosting and infrastructure providers, professional
                advisers, and law enforcement or regulators where legally required. Each processor
                must be named before launch, along with what it receives.
              </p>
              <p>
                <PendingInfo label="List of processors and sub-processors" />
              </p>
              <p>Personal data is not sold.</p>

              <h2>5. International transfers</h2>
              <p>
                Where data is transferred outside your jurisdiction, an appropriate safeguard — such
                as standard contractual clauses or an adequacy decision — must be in place and
                described here.
              </p>
              <p>
                <PendingInfo label="Transfer mechanisms and destination countries" />
              </p>

              <h2>6. How long it is kept</h2>
              <p>
                Account and verification records are typically retained for a period set by
                anti-money-laundering law after the account closes, commonly five years, and
                sometimes longer where litigation or a regulatory request requires it. The exact
                retention schedule must be confirmed against the law of each jurisdiction served.
              </p>
              <p>
                <PendingInfo label="Retention schedule per data category" />
              </p>

              <h2>7. Your rights</h2>
              <p>Depending on where you live, you may have the right to:</p>
              <ul>
                <li>Access the personal data held about you</li>
                <li>Have inaccurate data corrected</li>
                <li>Have data erased, where no legal obligation requires it to be kept</li>
                <li>Restrict or object to certain processing</li>
                <li>Receive your data in a portable format</li>
                <li>Withdraw consent where processing relies on it</li>
                <li>Complain to your data protection supervisory authority</li>
              </ul>
              <p>
                Note that anti-money-laundering obligations frequently override a request for
                erasure of verification records.
              </p>

              <h2>8. Cookies</h2>
              <p>
                The platform uses cookies that are strictly necessary for it to function, such as
                maintaining your session. Any analytics or marketing cookies must be listed here
                and must not be set before consent is given where consent is required.
              </p>
              <p>
                <PendingInfo label="Cookie inventory and consent mechanism" />
              </p>

              <h2>9. Security</h2>
              <p>
                Technical and organisational measures are used to protect personal data. No system
                is completely secure, and we do not claim otherwise. See the security page for what
                has and has not been independently verified.
              </p>

              <h2>10. Children</h2>
              <p>
                The platform is not intended for anyone under 18, and accounts are not knowingly
                opened for them.
              </p>

              <h2>11. Changes</h2>
              <p>
                This policy may be updated. The effective date of the current version will be shown
                here and material changes will be notified.
              </p>
              <p>
                <PendingInfo label="Version and effective date" />
              </p>

              <h2>Demonstration build</h2>
              <p>
                This deployment is a demonstration running on sample data. It has no backend, no
                database and no user accounts, and therefore collects and stores no personal data.
                Form submissions are validated in the browser and are not transmitted anywhere.
              </p>
            </Prose>
          </Reveal>
        </div>
      </Section>
    </>
  )
}
