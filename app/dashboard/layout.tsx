import type { Metadata } from 'next'
import { AccountProvider } from '@/components/dashboard/account-provider'
import { BottomNav } from '@/components/dashboard/bottom-nav'
import { Sidebar } from '@/components/dashboard/sidebar'
import { gateDashboard } from '@/lib/server/auth-gate'

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s · Dashboard · Nexora' },
  robots: { index: false, follow: false },
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Validates the session against the database and redirects if absent.
  // Returns null in the mock build, which has no database and no real accounts.
  const user = await gateDashboard()

  /**
   * The identity the shell displays.
   *
   * Passed down rather than fetched again by the sidebar, since the session was
   * already validated here. Null when there is no backend — the shell then
   * shows a neutral placeholder instead of a fabricated name.
   */
  const account = user
    ? { firstName: user.firstName, lastName: user.lastName, email: user.email }
    : null

  return (
    <AccountProvider account={account}>
      <div className="min-h-screen bg-base">
        <Sidebar />
        {/* Left offset clears the fixed sidebar; bottom padding clears the mobile bar */}
        <div className="lg:pl-[260px]">
          <main id="main" className="min-h-screen pb-24 lg:pb-0">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </AccountProvider>
  )
}
