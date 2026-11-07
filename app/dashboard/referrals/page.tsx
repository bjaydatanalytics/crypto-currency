import type { Metadata } from 'next'
import { Users } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { NotBuiltYet } from '@/components/dashboard/not-built-yet'

export const metadata: Metadata = { title: 'Referrals' }

export default function ReferralsPage() {
  return (
    <>
      <DashboardHeader title="Referrals" />
      <NotBuiltYet
        icon={<Users className="h-5 w-5" aria-hidden="true" />}
        title="Referrals are not live yet"
        description="No referral programme is running, so there is no link to share and no commission to earn. This page will show your referral code and what it has earned once one exists."
      />
    </>
  )
}
