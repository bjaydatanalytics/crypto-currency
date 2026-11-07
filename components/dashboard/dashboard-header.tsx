'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Settings, ShieldCheck, User, X } from 'lucide-react'
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/dropdown'
import { accountInitials, accountName, useAccount } from './account-provider'
import { LogoutButton } from './logout-button'
import { SidebarContent } from './sidebar'

export function DashboardHeader({ title }: { title: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const account = useAccount()

  useEffect(() => {
    if (!drawerOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [drawerOpen])

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-base-800">
        <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="-ml-1 rounded-lg p-2 text-muted transition-colors hover:bg-elevate/5 hover:text-ink lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <h1 className="truncate text-base font-semibold text-ink sm:text-lg">{title}</h1>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Dropdown
              label="Account menu"
              trigger={
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent transition-colors hover:bg-accent-bright"
                  aria-hidden="true"
                >
                  {accountInitials(account)}
                </span>
              }
            >
              {(close) => (
                <>
                  <div className="px-3 py-2.5">
                    <p className="truncate text-sm font-medium text-ink">
                      {accountName(account)}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {account ? account.email : 'No backend configured'}
                    </p>
                  </div>
                  <DropdownSeparator />
                  <Link href="/dashboard/profile" onClick={close}>
                    <DropdownItem icon={<User className="h-4 w-4" />}>Profile</DropdownItem>
                  </Link>
                  <Link href="/dashboard/security" onClick={close}>
                    <DropdownItem icon={<ShieldCheck className="h-4 w-4" />}>Security</DropdownItem>
                  </Link>
                  <Link href="/dashboard/profile#settings" onClick={close}>
                    <DropdownItem icon={<Settings className="h-4 w-4" />}>Settings</DropdownItem>
                  </Link>
                  <DropdownSeparator />
                  <LogoutButton onDone={close} className="px-3 py-2" />
                </>
              )}
            </Dropdown>
          </div>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Dashboard navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="absolute inset-y-0 left-0 w-[min(84vw,290px)] border-r border-line bg-base-800"
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="absolute right-3 top-4 z-10 rounded-lg p-2 text-muted transition-colors hover:bg-elevate/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
