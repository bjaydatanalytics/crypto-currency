import { AlertTriangle } from 'lucide-react'
import { AdminShell } from '@/components/admin/admin-shell'
import { WithdrawalReview } from '@/components/admin/withdrawal-review'
import { Card, CardBody } from '@/components/ui/card'

export default function AdminWithdrawalsPage() {
  return (
    <AdminShell data="live" title="Withdrawals" description="Approve, pay and settle outgoing transfers">
      <div className="space-y-6">
        <Card className="border-warn/25 bg-warn/[0.05]">
          <CardBody className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            <div className="text-sm leading-relaxed text-white/75">
              <p className="font-medium text-warn">
                Withdrawal approval is the highest-risk action in the product
              </p>
              <p className="mt-1.5">
                What is enforced today: the requester cannot approve their own withdrawal, funds
                are locked from the moment of request, approval and payment are separate steps,
                and every action is written to the audit log with the actor and the destination.
              </p>
              <p className="mt-1.5">
                What is not: dual approval by two separate operators, a per-approver release
                limit, and sanctions screening on the destination address. Add those before
                handling meaningful volume.
              </p>
            </div>
          </CardBody>
        </Card>

        <WithdrawalReview />
      </div>
    </AdminShell>
  )
}
