'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Ends the session, then leaves the panel.
 *
 * Deliberately a button and not a link. The previous sidebar pointed "Logout"
 * at the home page, which navigated away while leaving the session cookie
 * intact — the customer believed they had signed out on a shared machine and
 * had not. Signing out is a state change, so it is a POST.
 *
 * `router.refresh()` after the redirect clears the cached server-rendered
 * shell, which still holds the signed-out person's name and balance.
 */
export function LogoutButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function signOut() {
    if (pending) return
    setPending(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /**
       * Navigate away regardless. If the request failed the cookie may still
       * be live, but keeping the person on a signed-in-looking page is worse —
       * the login screen will reject a stale session on the next request.
       */
    }
    onDone?.()
    router.replace('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-elevate/[0.04] hover:text-ink disabled:opacity-60',
        className,
      )}
    >
      {pending ? (
        <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      )}
      {pending ? 'Signing out…' : 'Logout'}
    </button>
  )
}
