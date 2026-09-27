import { Headphones, LineChart, PieChart, ShieldCheck } from 'lucide-react'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'

const features = [
  {
    Icon: LineChart,
    title: 'Real-Time Market Data',
    description: 'Track market prices and asset movements.',
  },
  {
    Icon: PieChart,
    title: 'Portfolio Management',
    description: 'Monitor holdings and portfolio allocation.',
  },
  {
    Icon: ShieldCheck,
    title: 'Secure Account',
    description: 'Modern account security and authentication controls.',
  },
  {
    Icon: Headphones,
    title: '24/7 Support',
    description: 'Customer support and help resources.',
  },
]

export function Features() {
  return (
    <section className="border-y border-line bg-base-800/60">
      <div className="container-x py-12 sm:py-14">
        <RevealGroup as="ul" className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ Icon, title, description }) => (
            <RevealItem
              as="li"
              key={title}
              className="group relative bg-base-800 p-6 transition-colors duration-300 hover:bg-surface"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent transition-all duration-300 group-hover:border-accent/30 group-hover:bg-accent/10">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-[15px] font-semibold uppercase tracking-wide text-white">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>

              {/* Accent underline grows in on hover */}
              <span
                className="absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-accent/50 transition-transform duration-300 group-hover:scale-x-100"
                aria-hidden="true"
              />
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  )
}
