import { AccountAlerts } from '@/components/dashboard/alert-strip'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardSummary } from '@/components/dashboard/dashboard-summary'
import { RetirementBanner } from '@/components/dashboard/retirement-banner'
import { RoiChart } from '@/components/dashboard/roi-chart'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { getRoiSeries } from '@/lib/server/account-summary'
import { listPublicPlans } from '@/lib/server/plans'
import { gateDashboard } from '@/lib/server/auth-gate'

/**
 * The customer dashboard.
 *
 * A server component: the summary figures are already resolved by the layout,
 * and the ROI series is read here, so the page arrives complete rather than
 * assembling itself through a sequence of client fetches and skeletons.
 */
export default async function DashboardPage() {
  const user = await gateDashboard()
  const [roi, retirementPlans] = await Promise.all([
    user ? getRoiSeries(user.id, 30) : Promise.resolve([]),
    listPublicPlans('retirement'),
  ])

  return (
    <>
      <DashboardHeader title="Dashboard" />

      <div className="space-y-5 p-4 sm:p-6">
        <AccountAlerts />

        <DashboardSummary />

        <RetirementBanner plansOpen={retirementPlans.length > 0} />

        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Latest ROI Statistics</CardTitle>
            <p className="text-[13px] italic text-muted">
              Your return on investment over the last 30 days.
            </p>
          </CardHeader>
          <CardBody>
            {/*
              With no backend `roi` is empty, which renders the chart's own
              "no returns" state — the truthful reading, rather than a flat
              line implying thirty days of zero earnings on an account that
              does not exist.
            */}
            <RoiChart data={roi} />
          </CardBody>
        </Card>
      </div>
    </>
  )
}
