'use client'

import { createContext, useContext } from 'react'

/**
 * The signed-in account, made available to the dashboard shell.
 *
 * Exists to fix a specific bug: the sidebar and header rendered `demoUser` from
 * mock data, so a real signed-in customer saw a **different person's name and
 * email address** on every page of the dashboard. It looked like sample styling
 * and was in fact a false statement about whose account they were looking at.
 *
 * The value is seeded once by the dashboard layout, which already validates the
 * session server-side, so this costs no extra request.
 *
 * `null` means no backend is configured — the pure mock build. In that case the
 * shell renders a neutral placeholder rather than inventing a person, because
 * the honest answer to "whose account is this" is "nobody's".
 */

export interface AccountIdentity {
  firstName: string
  lastName: string
  email: string
}

const AccountContext = createContext<AccountIdentity | null>(null)

export function AccountProvider({
  account,
  children,
}: {
  account: AccountIdentity | null
  children: React.ReactNode
}) {
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>
}

export function useAccount(): AccountIdentity | null {
  return useContext(AccountContext)
}

/** Initials, or a neutral dash when there is no account to take them from. */
export function accountInitials(account: AccountIdentity | null): string {
  if (!account) return '—'
  return `${account.firstName.charAt(0)}${account.lastName.charAt(0)}`.toUpperCase()
}

export function accountName(account: AccountIdentity | null): string {
  return account ? `${account.firstName} ${account.lastName}` : 'Not signed in'
}
