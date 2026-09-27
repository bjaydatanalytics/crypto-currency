import type { Metadata } from 'next'
import { gateAdmin } from '@/lib/server/auth-gate'

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin · Nexora' },
  // Admin scaffolding must never be indexed.
  robots: { index: false, follow: false, nocache: true },
}

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  // Server-side role check against the database. Route handlers under
  // /api/admin enforce it independently — this gate gets the page, not the API.
  await gateAdmin()

  return children
}
