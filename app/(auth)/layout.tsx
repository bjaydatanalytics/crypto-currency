import Link from 'next/link'
import { ArrowLeft, LineChart, Lock, PieChart } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { brand } from '@/lib/config'

const highlights = [
  { Icon: LineChart, title: 'Market data', body: 'Prices and movement across supported assets.' },
  { Icon: PieChart, title: 'Portfolio tools', body: 'Holdings, allocation and performance in one view.' },
  { Icon: Lock, title: 'Account controls', body: 'Two-factor authentication and session management.' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel — decorative, so it is hidden from assistive tech on small screens by simply not rendering */}
      <aside className="relative hidden w-[46%] shrink-0 overflow-hidden border-r border-line bg-base-800 lg:block xl:w-[44%]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 30% 20%, rgba(184,255,0,0.12), transparent 70%), radial-gradient(50% 40% at 80% 80%, rgba(46,127,212,0.08), transparent 70%)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-grid-fade opacity-40 [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_40%_30%,black,transparent)]"
          aria-hidden="true"
        />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <Logo />

          <div className="max-w-md">
            <h2 className="text-[clamp(1.75rem,2.6vw,2.5rem)] font-semibold leading-[1.1] tracking-tight">
              A clearer way to hold{' '}
              <span className="text-accent-gradient">digital assets</span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">{brand.description}</p>

            <ul className="mt-10 space-y-5">
              {highlights.map(({ Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{title}</p>
                    <p className="mt-0.5 text-sm text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="max-w-md text-xs leading-relaxed text-muted">
            Demonstration build. Sign-up and sign-in are not connected to any account system — no
            account is created and no credentials are stored. Capital at risk: digital assets are
            volatile and you may get back less than you put in.
          </p>
        </div>
      </aside>

      <main id="main" className="flex min-h-screen flex-1 flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-8 lg:border-0">
          <div className="lg:hidden">
            <Logo />
          </div>
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 sm:py-14">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </main>
    </div>
  )
}
