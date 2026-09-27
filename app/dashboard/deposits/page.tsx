import { Info } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DepositAddressPanel } from '@/components/dashboard/deposit-address-panel'
import { TransactionHistory } from '@/components/dashboard/transaction-history'
import { Card, CardBody } from '@/components/ui/card'

export default function DepositsPage() {
  return (
    <>
      <DashboardHeader title="Deposits" />

      <div className="space-y-6 p-4 sm:p-6">
        <DepositAddressPanel />

        <Card className="border-warn/25 bg-warn/[0.05]">
          <CardBody className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-white/75">
              Support will never ask you to deposit to a different address, to a &quot;verification&quot;
              wallet, or to send funds to prove ownership. Any such request is fraud. The only
              address we will ever ask you to use is the one shown above.
            </p>
          </CardBody>
        </Card>

        <TransactionHistory fixedType="deposit" title="Deposit history" />
      </div>
    </>
  )
}
