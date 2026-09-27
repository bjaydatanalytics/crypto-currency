import { ArrowRight } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { Reveal } from '@/components/ui/reveal'

export function Cta() {
  return (
    <section className="relative overflow-hidden border-t border-line">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 100%, rgba(184,255,0,0.13), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-fade opacity-40 [background-size:56px_56px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_100%,black,transparent)]"
        aria-hidden="true"
      />

      <div className="container-x py-20 sm:py-24 lg:py-32">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-[clamp(2rem,5.5vw,3.5rem)] font-semibold leading-[1.08] tracking-tight">
            Explore the Future of <span className="text-accent-gradient">Digital Finance</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:text-lg">
            Access market information, portfolio tools and digital asset services through one
            modern platform.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/register" size="lg" className="group">
              Create Account
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </ButtonLink>
            <ButtonLink href="/markets" variant="secondary" size="lg">
              Explore Markets
            </ButtonLink>
          </div>

          <p className="mx-auto mt-8 max-w-lg text-xs leading-relaxed text-muted">
            Capital at risk. Digital assets are volatile and you may get back less than you put in.
            This is a demonstration build — no real account, funds or trading are available.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
