import Link from 'next/link'
import {
  Building2,
  FileText,
  LifeBuoy,
  Lock,
  Receipt,
  ScrollText,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PendingInfo } from '@/components/ui/demo-notice'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/reveal'
import { Section, SectionHeading } from '@/components/ui/section'
import { companyInfo } from '@/lib/config'

interface TrustItem {
  Icon: LucideIcon
  title: string
  body: string
  href?: string
  /** Information the operator must supply and verify before launch. */
  pending?: string
}

const items: TrustItem[] = [
  {
    Icon: Receipt,
    title: 'Clear fees',
    body: 'Every fee that applies to trading, deposits, withdrawals and plans, listed in one place with no hidden charges.',
    href: '/pricing',
    pending: 'Fee schedule',
  },
  {
    Icon: ShieldAlert,
    title: 'Risk information',
    body: 'A plain-language explanation of what can go wrong with digital assets, published before you deposit rather than buried in the terms.',
    href: '/risk-disclosure',
  },
  {
    Icon: Lock,
    title: 'Security practices',
    body: 'How accounts are protected, what controls you can turn on, and how sessions and withdrawals are managed.',
    href: '/security',
  },
  {
    Icon: ScrollText,
    title: 'Terms',
    body: 'The agreement between you and the platform, including your rights, our obligations and how disputes are handled.',
    href: '/terms',
  },
  {
    Icon: FileText,
    title: 'Privacy',
    body: 'What personal data is collected, why it is needed, how long it is kept and who it is shared with.',
    href: '/privacy',
  },
  {
    Icon: Building2,
    title: 'Company information',
    body: 'The legal entity behind the platform, its registration details and its registered address.',
    pending: 'Company and registration details',
  },
  {
    Icon: LifeBuoy,
    title: 'Support channels',
    body: 'How to reach a person, what hours support operates and how long a reply typically takes.',
    href: '/contact',
    pending: 'Published support hours',
  },
]

/**
 * Transparency section.
 *
 * Several entries depend on information only the operator can provide —
 * fees, company registration, support hours. Those render a visible
 * "to be supplied" marker instead of plausible filler, so nothing ships that
 * reads as verified when it is not.
 *
 * No licences, registrations, approvals, audits, certifications or
 * partnerships are claimed anywhere on this page. Do not add any without a
 * document from the relevant regulator or issuer.
 */
export function Trust() {
  return (
    <Section>
      <div className="container-x">
        <SectionHeading
          eyebrow="Transparency"
          title="Built Around Transparency"
          description="What we can tell you, we publish. What has not been confirmed yet is marked as outstanding rather than filled in with something that sounds right."
          align="center"
          className="mx-auto max-w-2xl"
        />

        <RevealGroup as="ul" className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const inner = (
              <Card interactive={Boolean(item.href)} className="flex h-full flex-col p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                  <item.Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-white">
                  {item.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{item.body}</p>
                {item.pending && <PendingInfo label={item.pending} className="mt-4 self-start" />}
              </Card>
            )

            return (
              <RevealItem as="li" key={item.title}>
                {item.href ? (
                  <Link href={item.href} className="block h-full rounded-2xl">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </RevealItem>
            )
          })}
        </RevealGroup>

        <Reveal className="mt-8">
          <Card className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
              Regulatory status
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
              {companyInfo.regulatoryStatus ? (
                companyInfo.regulatoryStatus
              ) : (
                <>
                  This platform makes no claim to hold any financial licence, registration or
                  regulatory approval. Digital asset services are unregulated or only partly
                  regulated in many jurisdictions, which means protections such as deposit
                  guarantee schemes and financial ombudsman services may not apply to you. Any
                  authorisation the operator obtains will be stated here, naming the regulator and
                  the reference number so that you can check it on the regulator's own public
                  register.
                </>
              )}
            </p>
          </Card>
        </Reveal>
      </div>
    </Section>
  )
}
