import { BadgeCheck, CreditCard, LayoutDashboard, UserPlus } from 'lucide-react'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { Section, SectionHeading } from '@/components/ui/section'

const steps = [
  {
    Icon: UserPlus,
    title: 'Create Account',
    description: 'Register with your name, email and a strong password.',
  },
  {
    Icon: BadgeCheck,
    title: 'Complete Verification',
    description:
      'Confirm your email and complete identity checks, which are required before you can transact.',
  },
  {
    Icon: CreditCard,
    title: 'Fund Account',
    description: 'Add funds using the deposit methods available in your region.',
  },
  {
    Icon: LayoutDashboard,
    title: 'Use The Platform',
    description: 'Follow markets, build a portfolio and manage your holdings.',
  },
]

export function HowItWorks() {
  return (
    <Section className="border-y border-line bg-base-800/40">
      <div className="container-x">
        <SectionHeading
          eyebrow="Getting started"
          title="Four steps to your account"
          description="A straightforward onboarding flow, with verification handled before any funds move."
          align="center"
          className="mx-auto max-w-2xl"
        />

        <RevealGroup as="ol" className="relative mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* Connecting rail, desktop only */}
          <span
            className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-line to-transparent lg:block"
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <RevealItem as="li" key={step.title} className="relative">
              <div className="flex items-center gap-4 lg:block">
                <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-base-800 text-accent shadow-glow-sm">
                  <step.Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="num text-xs font-medium uppercase tracking-[0.18em] text-muted lg:mt-5 lg:block">
                  Step {String(index + 1).padStart(2, '0')}
                </span>
              </div>

              <h3 className="mt-4 text-base font-semibold uppercase tracking-wide text-white lg:mt-3">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </Section>
  )
}
