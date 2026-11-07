import type { Metadata } from 'next'
import { ArrowLeftRight } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { NotBuiltYet } from '@/components/dashboard/not-built-yet'

export const metadata: Metadata = { title: 'Transfer Balance' }

export default function TransferBalancePage() {
  return (
    <>
      <DashboardHeader title="Transfer Balance" />
      <NotBuiltYet
        icon={<ArrowLeftRight className="h-5 w-5" aria-hidden="true" />}
        title="Balance transfers are not available yet"
        description="Moving funds between wallets, or to another account, is not supported on the platform at the moment. Your balance can still be withdrawn or invested from the dashboard."
      />
    </>
  )
}
