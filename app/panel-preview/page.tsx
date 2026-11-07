/**
 * TEMPORARY preview of the customer panel, with no sign-in required.
 *
 * Exists so the redesign can be looked at without a session. It renders the
 * real shell and the real dashboard components against a zeroed summary and a
 * made-up name.
 *
 * The plan grid is the one place this reads the database: it lists DRAFT plans,
 * which `/api/plans` deliberately will not serve, so the nine seeded plans can
 * be reviewed before anyone publishes them. Nothing here writes.
 *
 * 404s outside development so it can never be reached on a deployed build.
 * Delete this directory once the panel has been reviewed.
 */
import { notFound } from 'next/navigation'
import { ArrowRight, Frown } from 'lucide-react'
import { AccountProvider } from '@/components/dashboard/account-provider'
import { AccountAlerts } from '@/components/dashboard/alert-strip'
import { DashboardSummary } from '@/components/dashboard/dashboard-summary'
import { RetirementBanner } from '@/components/dashboard/retirement-banner'
import { RoiChart } from '@/components/dashboard/roi-chart'
import { SidebarContent } from '@/components/dashboard/sidebar'
import { SummaryProvider } from '@/components/dashboard/summary-provider'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { emptyAccountSummary } from '@/lib/account-summary-types'
import { listAllPlans } from '@/lib/server/plans'
import { RetirementSummary } from '@/components/dashboard/retirement-summary'
import { PreviewPlanGrid } from './plan-grid'

const account = {
  firstName: 'Casey',
  lastName: 'Adeyemi',
  email: 'casey@example.com',
  twoFactorEnabled: false,
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-y border-line bg-base-900 px-4 py-2 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {children}
      </p>
    </div>
  )
}

export default async function PanelPreview() {
  if (process.env.NODE_ENV === 'production') notFound()

  const all = await listAllPlans()
  const plans = all.filter((plan) => plan.category === 'standard')
  const retirement = all.filter((plan) => plan.category === 'retirement')

  return (
    <AccountProvider account={account}>
      <SummaryProvider initial={emptyAccountSummary()}>
        <div data-panel className="min-h-screen bg-base text-ink">
          <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-line bg-base-800 lg:block">
            <SidebarContent />
          </aside>

          <div className="lg:pl-[260px]">
            <header className="sticky top-0 z-30 border-b border-line bg-base-800">
              <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6">
                <h1 className="text-base font-semibold text-ink sm:text-lg">Dashboard</h1>
                <span className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent">
                  CA
                </span>
              </div>
            </header>

            {/* ---------- Screens 1 & 2: the dashboard ---------- */}
            <SectionLabel>Dashboard</SectionLabel>
            <main className="space-y-5 p-4 sm:p-6">
              <AccountAlerts />
              <DashboardSummary />
              <RetirementBanner />
              <Card>
                <CardHeader className="flex-col items-start gap-1">
                  <CardTitle>Latest ROI Statistics</CardTitle>
                  <p className="text-[13px] italic text-muted">
                    Your return on investment over the last 30 days.
                  </p>
                </CardHeader>
                <CardBody>
                  <RoiChart data={[]} />
                </CardBody>
              </Card>
            </main>

            {/* ---------- Screen 3: All Investment ---------- */}
            <SectionLabel>Investments → All Investment</SectionLabel>
            <section className="space-y-5 p-4 sm:p-6">
              <div>
                <p className="text-[13px] text-muted">Investment</p>
                <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">
                  All Investment
                </h2>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5 shadow-card">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[13px] text-muted">Total Invest</p>
                      <p className="mt-1 flex items-baseline gap-1 text-accent">
                        <span className="text-sm font-medium">$</span>
                        <span className="num text-2xl font-bold tracking-tight">0.00</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] text-muted">Total Profit</p>
                      <p className="mt-1 flex items-baseline justify-end gap-1 text-accent">
                        <span className="text-sm font-medium">$</span>
                        <span className="num text-2xl font-bold tracking-tight">0.00</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-semibold text-on-accent">
                      Invest Now <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-navy px-3.5 text-xs font-semibold text-white">
                      Withdraw Now <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </Card>

                <div className="flex min-h-[150px] items-center justify-center rounded-xl border border-line bg-surface p-6 text-center shadow-card">
                  <p className="text-xl font-bold tracking-tight text-ink/80">
                    No Investment Found Yet
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold tracking-tight text-ink">Active Plan (0)</h3>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-accent">
                  Investment Logs <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>

              <div className="inline-flex items-center gap-2.5 rounded-xl border border-line bg-surface px-6 py-5 shadow-card">
                <Frown className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                <p className="text-lg font-bold tracking-tight text-ink/80">Data not found</p>
              </div>
            </section>

            {/* ---------- Screens 4 & 5: the plan grid ---------- */}
            <SectionLabel>Investments → Investment Plans</SectionLabel>
            <section className="space-y-5 p-4 sm:p-6">
              <PreviewPlanGrid plans={plans} />
            </section>

            {/* ---------- Screen 6: 401k ---------- */}
            <SectionLabel>401k Plan</SectionLabel>
            <section className="space-y-5 p-4 sm:p-6">
              <h2 className="text-2xl font-bold tracking-tight text-ink">401k Plan</h2>
              <RetirementSummary
                totalInvest={0}
                totalProfit={0}
                activeCount={0}
                hasPositions={false}
              />
              <PreviewPlanGrid plans={retirement} />
            </section>
          </div>
        </div>
      </SummaryProvider>
    </AccountProvider>
  )
}
