'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { mobileNav } from './sidebar-nav'

/**
 * Mobile bottom navigation.
 *
 * Sits above the safe-area inset so it clears the home indicator on iOS. The
 * dashboard shell adds matching bottom padding so content is never hidden
 * behind it.
 */
export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-base-800/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {mobileNav.map(({ label, href, Icon }) => {
          const active =
            href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  // 56px min height keeps every target comfortably tappable
                  'flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors',
                  active ? 'text-accent' : 'text-muted',
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
