'use client'

import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { HeroVisual } from './hero-visual'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Layered background: lime bloom, faint grid, vignette */}
      <div className="glow-radial pointer-events-none absolute inset-0 -z-20" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-fade opacity-[0.55] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        aria-hidden="true"
      />

      <div className="container-x relative py-16 sm:py-20 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 xl:gap-16">
          <motion.div
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.09 }}
            className="max-w-xl"
          >
            <motion.div variants={fadeUp} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.07] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Modern digital asset platform
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 text-[clamp(2.25rem,6.2vw,4rem)] font-semibold leading-[1.04] tracking-tight"
            >
              Build Your Future With{' '}
              <span className="text-accent-gradient">Smarter Digital Asset</span> Investing
            </motion.h1>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 max-w-lg text-[15px] leading-relaxed text-muted sm:text-lg"
            >
              Explore digital assets, monitor market movements and manage your portfolio through a
              modern financial platform.
            </motion.p>

            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <ButtonLink href="/markets" size="lg" className="group">
                Start Exploring
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </ButtonLink>
              <ButtonLink href="/register" variant="secondary" size="lg">
                Create Account
              </ButtonLink>
            </motion.div>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mt-7 max-w-md text-xs leading-relaxed text-muted"
            >
              Digital assets are volatile and you may get back less than you put in. Figures shown
              are sample data for demonstration and are not a forecast or a guarantee of return.
            </motion.p>
          </motion.div>

          <div className="relative lg:pl-4">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  )
}
