import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Cta } from '@/components/marketing/cta'
import { Services } from '@/components/marketing/services'
import { TradingPreview } from '@/components/marketing/trading-preview'

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Spot trading, portfolio management and market analytics — with the terms and risks of each service stated plainly.',
  alternates: { canonical: '/services' },
}

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="What the platform does"
        description="Three services are available today. Three more depend on commercial terms the operator has yet to supply, and are listed with exactly what is still outstanding."
      />
      <Services />
      <TradingPreview />
      <Cta />
    </>
  )
}
