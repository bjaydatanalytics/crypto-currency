import type { Metadata } from 'next'
import { Clock, Mail, MessageSquare, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { ContactForm } from '@/components/marketing/contact-form'
import { Card } from '@/components/ui/card'
import { PendingInfo } from '@/components/ui/demo-notice'
import { Reveal } from '@/components/ui/reveal'
import { Section } from '@/components/ui/section'
import { companyInfo } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with support about your account, verification or the platform.',
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Talk to support"
        description="Questions about your account, verification or how something works. Support does not give investment advice."
      />

      <Section>
        <div className="container-x grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-12">
          <Reveal>
            <ContactForm />
          </Reveal>

          <Reveal delay={0.1} className="space-y-4">
            <Card className="p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-white">
                Support channels
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Published email addresses and any live chat or phone channels will appear here once
                the operator has set them up and can staff them.
              </p>
              <PendingInfo label="Support email and channels" className="mt-4" />
            </Card>

            <Card className="p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                <Clock className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-white">
                Hours and response times
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {companyInfo.supportHours ||
                  'Operating hours and target response times have not been confirmed. They will be stated here rather than implied.'}
              </p>
              <PendingInfo label="Support hours" className="mt-4" />
            </Card>

            <Card className="border-warn/25 bg-warn/[0.05] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-warn/25 bg-warn/10 text-warn">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-white">
                Beware of impersonation
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Support will never ask for your password, two-factor codes, recovery phrase or
                remote access to your device, and will never ask you to send funds to a "safe"
                address. Anyone who does is attempting to defraud you.
              </p>
            </Card>

            <Card className="p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-white">
                Complaints
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                A formal complaints procedure, including escalation and any applicable external
                dispute resolution, must be published before launch.
              </p>
              <PendingInfo label="Complaints procedure" className="mt-4" />
            </Card>
          </Reveal>
        </div>
      </Section>
    </>
  )
}
