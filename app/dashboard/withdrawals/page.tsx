import { ArrowUpFromLine, ShieldCheck } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { TransactionHistory } from '@/components/dashboard/transaction-history'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { DemoNotice, PendingInfo } from '@/components/ui/demo-notice'

const controls = [
  {
    title: 'Address allow-listing',
    body: 'Withdrawals go only to addresses you have added and confirmed in advance.',
  },
  {
    title: 'Two-factor confirmation',
    body: 'Each request requires a second factor, separate from your password.',
  },
  {
    title: 'Cooling-off on new addresses',
    body: 'A newly added address cannot be withdrawn to immediately.',
  },
  {
    title: 'Notification on every request',
    body: 'You are told about every withdrawal, so an unauthorised one is visible quickly.',
  },
]

export default function WithdrawalsPage() {
  return (
    <>
      <DashboardHeader title="Withdrawals" />

      <div className="space-y-6 p-4 sm:p-6">
        <DemoNotice title="Withdrawals are disabled">
          No withdrawal can be requested from this build. There is no ledger, no custody provider
          and no balance to withdraw — the figures shown elsewhere are sample data.
        </DemoNotice>

        <Card>
          <CardBody>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                  <ArrowUpFromLine className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-base font-semibold text-white">Withdraw funds</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Once connected, this screen will let you request a withdrawal to an allow-listed
                  address, show the network and platform fee before you confirm, and track the
                  request through review and network confirmation.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <PendingInfo label="Withdrawal limits and processing times" />
                  <PendingInfo label="Fee schedule" />
                </div>
              </div>

              <div className="shrink-0">
                <ButtonLink href="/dashboard/security" variant="secondary">
                  Security settings
                </ButtonLink>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
                Withdrawal controls
              </h2>
            </div>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {controls.map((control) => (
                <li key={control.title} className="rounded-xl border border-line bg-base-800 p-4">
                  <p className="text-sm font-medium text-white">{control.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{control.body}</p>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-muted">
              Blockchain transfers are irreversible. Check the address and network on every
              withdrawal — funds sent to a wrong address or the wrong network cannot be recovered.
            </p>
          </CardBody>
        </Card>

        <TransactionHistory fixedType="withdrawal" title="Withdrawal history" />
      </div>
    </>
  )
}
