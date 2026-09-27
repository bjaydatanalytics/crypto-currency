import { Quote } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PendingInfo } from '@/components/ui/demo-notice'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { Section, SectionHeading } from '@/components/ui/section'

/**
 * Testimonial layout with placeholder content.
 *
 * The quotes below are explicitly labelled placeholders, and the attributions
 * are roles rather than invented people. Fabricated testimonials presented as
 * genuine are both misleading and, in most jurisdictions, unlawful in financial
 * promotions — replace these only with feedback from real, consenting customers.
 */
const placeholders = [
  { role: 'Customer role', context: 'Segment / location' },
  { role: 'Customer role', context: 'Segment / location' },
  { role: 'Customer role', context: 'Segment / location' },
]

const placeholderQuote = 'Sample testimonial — replace with verified customer feedback.'

export function Testimonials() {
  return (
    <Section className="border-t border-line">
      <div className="container-x">
        <SectionHeading
          eyebrow="Customer feedback"
          title="What customers say"
          description="This section is ready for real feedback. Nothing below is a genuine review — each card is a placeholder until verified customer quotes, with consent to publish, are supplied."
          align="center"
          className="mx-auto max-w-2xl"
        />

        <RevealGroup as="ul" className="mt-12 grid gap-5 md:grid-cols-3">
          {placeholders.map((item, index) => (
            <RevealItem as="li" key={index}>
              <Card className="flex h-full flex-col border-dashed p-6">
                <Quote className="h-6 w-6 text-accent/40" aria-hidden="true" />
                <p className="mt-4 flex-1 text-[15px] leading-relaxed text-muted">
                  “{placeholderQuote}”
                </p>
                <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                  <span
                    className="h-9 w-9 shrink-0 rounded-full border border-dashed border-line bg-white/[0.02]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-white/70">{item.role}</p>
                    <p className="text-xs text-muted">{item.context}</p>
                  </div>
                </div>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>

        <div className="mt-8 flex justify-center">
          <PendingInfo label="Verified customer testimonials and consent to publish" />
        </div>
      </div>
    </Section>
  )
}
