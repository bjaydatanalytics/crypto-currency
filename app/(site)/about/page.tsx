import type { Metadata } from 'next'
import { Compass, Eye, Scale, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Cta } from '@/components/marketing/cta'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { Card } from '@/components/ui/card'
import { PendingInfo } from '@/components/ui/demo-notice'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/reveal'
import { Section, SectionHeading } from '@/components/ui/section'
import { brand, companyInfo } from '@/lib/config'

export const metadata: Metadata = {
  title: 'About',
  description: `About ${brand.name} — how the platform works, what it stands for, and what it does not claim.`,
  alternates: { canonical: '/about' },
}

const principles = [
  {
    Icon: Eye,
    title: 'Say what is true',
    body: 'Figures are labelled for what they are. Simulated data is marked as simulated, and information that has not been confirmed is shown as outstanding rather than filled in.',
  },
  {
    Icon: Scale,
    title: 'Risk stated up front',
    body: 'The risks of holding digital assets appear alongside the product, not buried in a document nobody opens. No return is promised, because none can be.',
  },
  {
    Icon: Compass,
    title: 'Tools, not tips',
    body: 'The platform provides market data, portfolio tracking and execution. It does not give investment advice or tell you what to buy.',
  },
  {
    Icon: Users,
    title: 'Support you can reach',
    body: 'Questions get a route to a person, and published channels and response times once the operator confirms them.',
  },
]

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title={`Building a clearer way to hold digital assets`}
        description={`${brand.name} brings market data, portfolio tools and trading into a single interface — and is explicit about what it can and cannot tell you.`}
      />

      <Section>
        <div className="container-x grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <Reveal>
            <h2 className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-semibold leading-tight">
              Our approach
            </h2>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted">
              <p>
                Most people meeting digital assets for the first time are handed two things at
                once: an interface that makes trading feel trivial, and marketing that makes
                returns feel certain. The second is what causes the damage.
              </p>
              <p>
                We have built the interface to be genuinely good — fast charts, a portfolio view
                that reconciles, order tools that show you what you are about to do — and paired it
                with copy that refuses to overstate. Where a number is a demonstration, it says so.
                Where a term has not been set, it says that too.
              </p>
              <p>
                This build is a demonstration environment. It runs on sample data end to end, and
                the actions that would move value are deliberately disabled rather than simulated
                into looking successful.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
                Company information
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                The details below identify the legal entity operating this platform. They are
                intentionally blank in this build: publishing a company name, address or
                registration number that has not been verified would mislead anyone relying on it.
              </p>
              <dl className="mt-6 space-y-4 border-t border-line pt-5">
                {[
                  ['Legal entity', companyInfo.legalName, 'Registered company name'],
                  ['Registration number', companyInfo.registrationNumber, 'Company number'],
                  ['Registered address', companyInfo.registeredAddress, 'Registered address'],
                  ['Jurisdiction', companyInfo.jurisdiction, 'Country of incorporation'],
                  ['Regulatory status', companyInfo.regulatoryStatus, 'Verified regulatory status'],
                ].map(([label, value, pendingLabel]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
                    <dd className="mt-1.5">
                      {value ? (
                        <span className="text-sm text-white">{value}</span>
                      ) : (
                        <PendingInfo label={pendingLabel} />
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section className="border-y border-line bg-base-800/40">
        <div className="container-x">
          <SectionHeading
            eyebrow="Principles"
            title="How we decide what to put on screen"
            align="center"
            className="mx-auto max-w-2xl"
          />

          <RevealGroup as="ul" className="mt-12 grid gap-5 sm:grid-cols-2">
            {principles.map((item) => (
              <RevealItem as="li" key={item.title}>
                <Card className="flex h-full gap-4 p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                    <item.Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                  </div>
                </Card>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </Section>

      <HowItWorks />
      <Cta />
    </>
  )
}
