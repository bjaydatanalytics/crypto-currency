'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { TradingInterface } from '@/components/trading/trading-interface'
import { DemoNotice } from '@/components/ui/demo-notice'
import { Skeleton } from '@/components/ui/skeleton'

function TradeContent() {
  const searchParams = useSearchParams()
  const symbol = searchParams.get('symbol') ?? 'BTC'

  return <TradingInterface initialSymbol={symbol} />
}

export default function TradePage() {
  return (
    <>
      <DashboardHeader title="Trade" />

      <div className="space-y-6 p-4 sm:p-6">
        <DemoNotice title="Demo trading">
          This is a demonstration environment. Orders placed here are not routed to any venue, no
          position is opened, no funds move and nothing is recorded against a real account.
        </DemoNotice>

        {/* useSearchParams needs a Suspense boundary for static rendering */}
        <Suspense fallback={<Skeleton className="h-[560px] w-full rounded-2xl" />}>
          <TradeContent />
        </Suspense>
      </div>
    </>
  )
}
