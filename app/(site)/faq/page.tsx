import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Accordion } from '@/components/marketing/faq'
import { Cta } from '@/components/marketing/cta'
import { faqItems } from '@/lib/faq-data'
import { Card } from '@/components/ui/card'
import { Reveal } from '@/components/ui/reveal'
import { Section } from '@/components/ui/section'
import { brand } from '@/lib/config'

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Answers about accounts, verification, supported assets, deposits, withdrawals, fees, security and the risks of digital assets.',
  alternates: { canonical: '/faq' },
}

/**
 * FAQPage structured data.
 *
 * Only the plain-text answers are emitted, and they match what is rendered —
 * marking up content that differs from the page would be search-engine spam.
 */
function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />

      <PageHeader
        eyebrow="FAQ"
        title="Frequently asked questions"
        description="Accounts, verification, deposits, withdrawals, fees, security and risk. If anything here is unclear, ask before you deposit."
      />

      <Section>
        <div className="container-x grid gap-10 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] lg:gap-12">
          <Reveal>
            <Accordion items={faqItems} />
          </Reveal>

          <Reveal delay={0.1} className="lg:sticky lg:top-28 lg:self-start">
            <Card className="p-6">
              <h2 className="text-base font-semibold text-white">Still have a question?</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">
                Support can answer questions about your account, verification and the platform.
                They cannot tell you what to invest in — no one at {brand.name} gives investment
                advice.
              </p>
              <Link
                href="/contact"
                className="mt-5 inline-flex text-sm font-medium text-accent underline underline-offset-4 transition-colors hover:text-accent-bright"
              >
                Contact support
              </Link>

              <div className="mt-6 border-t border-line pt-5">
                <h3 id="api" className="scroll-mt-28 text-sm font-semibold text-white">
                  API and documentation
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  A public API is planned. Endpoints, authentication and rate limits will be
                  documented here once the backend is built — this frontend currently talks to a
                  mock service layer.
                </p>
              </div>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Cta />
    </>
  )
}
