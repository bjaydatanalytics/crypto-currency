import type { Metadata } from 'next'
import {
  Database,
  Fingerprint,
  KeyRound,
  Lock,
  MonitorSmartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Cta } from '@/components/marketing/cta'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PendingInfo } from '@/components/ui/demo-notice'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/reveal'
import { Section, SectionHeading } from '@/components/ui/section'

export const metadata: Metadata = {
  title: 'Security',
  description:
    'Account security, two-factor authentication, login protection, session management, data protection and withdrawal controls.',
  alternates: { canonical: '/security' },
}

interface SecurityArea {
  Icon: LucideIcon
  title: string
  body: string
  points: string[]
}

/**
 * Security practices.
 *
 * This page describes controls the product provides to the account holder.
 * It makes no claim about certifications, audits, insurance or custody
 * arrangements — those require evidence (an audit report, a policy document,
 * a custodian agreement) and are marked as outstanding below.
 */
const areas: SecurityArea[] = [
  {
    Icon: Lock,
    title: 'Account Security',
    body: 'The controls protecting access to your account and the actions you can take within it.',
    points: [
      'Password requirements with strength feedback at sign-up',
      'Email confirmation required before the account can be used',
      'Sensitive changes require re-authentication',
    ],
  },
  {
    Icon: Fingerprint,
    title: 'Two-Factor Authentication',
    body: 'A second factor means a stolen password alone is not enough to reach your account.',
    points: [
      'Authenticator app codes (TOTP)',
      'Recovery codes issued once, at setup',
      'Required again when withdrawal settings change',
    ],
  },
  {
    Icon: KeyRound,
    title: 'Login Protection',
    body: 'Defences against automated and repeated attempts to get in.',
    points: [
      'Rate limiting and lockout after repeated failures',
      'Alerts on sign-in from a new device or location',
      'A login history you can review yourself',
    ],
  },
  {
    Icon: MonitorSmartphone,
    title: 'Session Management',
    body: 'See where your account is signed in, and end anything you do not recognise.',
    points: [
      'Active session list with device, location and last activity',
      'Revoke an individual session or all other sessions',
      'Automatic expiry after a period of inactivity',
    ],
  },
  {
    Icon: Database,
    title: 'Data Protection',
    body: 'How your personal information is handled, stored and limited.',
    points: [
      'Encryption in transit for all traffic',
      'Access to personal data limited to staff who need it',
      'Retention periods set out in the privacy policy',
    ],
  },
  {
    Icon: Wallet,
    title: 'Withdrawal Controls',
    body: 'Extra friction on the one action that can remove value from your account.',
    points: [
      'Withdrawal address allow-listing',
      'Confirmation step and a cooling-off period on new addresses',
      'Notification on every withdrawal request',
    ],
  },
]

export default function SecurityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Security you can inspect"
        description="The controls below are what the platform gives you over your own account. Where an assurance would need independent evidence, we say what evidence is still required instead of claiming it."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/dashboard/security">Open security settings</ButtonLink>
          <ButtonLink href="/register" variant="secondary">
            Create account
          </ButtonLink>
        </div>
      </PageHeader>

      <Section>
        <div className="container-x">
          <RevealGroup as="ul" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => (
              <RevealItem as="li" key={area.title}>
                <Card className="flex h-full flex-col p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                    <area.Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 text-base font-semibold uppercase tracking-wide text-white">
                    {area.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{area.body}</p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {area.points.map((point) => (
                      <li key={point} className="flex gap-2.5 text-sm text-white/75">
                        <span
                          className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent"
                          aria-hidden="true"
                        />
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </Section>

      <Section className="border-y border-line bg-base-800/40">
        <div className="container-x">
          <SectionHeading
            title="What we are not claiming"
            description="Security claims are only worth what backs them. None of the following has been established for this build, and none is asserted anywhere on this site."
          />

          <Reveal className="mt-8">
            <Card className="p-6">
              <ul className="space-y-4 text-sm leading-relaxed text-muted">
                {[
                  [
                    'Independent security audit',
                    'No penetration test or code audit has been carried out. A report from a named firm, with a date and scope, is required before any audit claim appears.',
                  ],
                  [
                    'Custody arrangements',
                    'How assets would be held — self-custody, a named qualified custodian, hot and cold wallet split — has not been decided. Proof of reserves cannot be claimed without it.',
                  ],
                  [
                    'Insurance',
                    'No insurance policy covers assets on this platform. Any future cover must be described with the insurer, the limit and what it excludes.',
                  ],
                  [
                    'Compliance certifications',
                    'No ISO 27001, SOC 2 or equivalent certification exists. Certificates must be verifiable with the issuing body before being referenced.',
                  ],
                  [
                    'Deposit protection',
                    'Digital assets are not bank deposits. No government deposit guarantee scheme applies to them.',
                  ],
                ].map(([title, body]) => (
                  <li key={title} className="border-b border-line pb-4 last:border-0 last:pb-0">
                    <p className="font-medium text-white">{title}</p>
                    <p className="mt-1.5">{body}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
                <PendingInfo label="Security audit report" />
                <PendingInfo label="Custody provider and arrangements" />
                <PendingInfo label="Incident response and disclosure policy" />
              </div>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section>
        <div className="container-x">
          <SectionHeading
            title="How to protect yourself"
            description="The strongest controls on any platform can be undone by a well-run scam. These habits matter most."
          />

          <RevealGroup as="ul" className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              [
                'Turn on two-factor authentication',
                'Use an authenticator app rather than SMS where possible, and store your recovery codes offline.',
              ],
              [
                'Never share codes or your password',
                'No member of staff will ever ask for them. Anyone who does is attempting fraud.',
              ],
              [
                'Check the address every time',
                'Only sign in from a link you typed yourself. Phishing sites copy the real interface exactly.',
              ],
              [
                'Be sceptical of guaranteed returns',
                'Anyone promising fixed, guaranteed or risk-free profits on digital assets is lying to you, whoever they claim to be.',
              ],
            ].map(([title, body]) => (
              <RevealItem as="li" key={title}>
                <Card className="h-full p-5">
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </Card>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </Section>

      <Cta />
    </>
  )
}
