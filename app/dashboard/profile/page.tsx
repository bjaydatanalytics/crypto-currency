'use client'

import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Mail, Phone, ShieldCheck, User } from 'lucide-react'
import Link from 'next/link'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { PreferencesCard } from '@/components/dashboard/preferences-card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SkeletonRows } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { fetchAccount, updateProfile, type AccountSummary } from '@/lib/api/auth'
import { formatDate, initials } from '@/lib/utils'

/**
 * Profile.
 *
 * Reads the signed-in user's own record. This page previously rendered
 * `demoUser` from mock data, which meant a real person saw somebody else's
 * name, email and verification status presented as their own — and the toast
 * told them "this build has no account system" while they were signed in to it.
 *
 * Email is intentionally read-only. Changing the address on an account is an
 * account-takeover step, not a profile edit: it needs the new address proved
 * and the old one notified. Until that flow exists the field is disabled and
 * says why, rather than accepting a change it cannot safely make.
 */

const COUNTRIES = [
  { value: '', label: 'Not set' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'IE', label: 'Ireland' },
  { value: 'DE', label: 'Germany' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'US', label: 'United States' },
]

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

export default function ProfilePage() {
  const { toast } = useToast()
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const next = await fetchAccount()
      setAccount(next)
      setFirstName(next.user.firstName)
      setLastName(next.user.lastName)
      setPhone(next.user.phone ?? '')
      setCountry(next.user.country ?? '')
      setLoadError(null)
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Could not load your profile.'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaveError(null)

    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        country: country.trim(),
      })
      toast({
        tone: 'success',
        title: 'Profile updated',
        description: 'Your details have been saved.',
      })
      await load()
    } catch (cause) {
      setSaveError(errorMessage(cause, 'Could not save your details.'))
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <>
        <DashboardHeader title="Profile" />
        <div className="p-4 sm:p-6">
          <Card className="border-negative/30 bg-negative/[0.05]">
            <CardBody>
              <p className="text-sm font-medium text-negative">Could not load your profile</p>
              <p className="mt-1 text-sm leading-relaxed text-white/75">{loadError}</p>
              <Button variant="secondary" className="mt-4" onClick={() => void load()}>
                Try again
              </Button>
            </CardBody>
          </Card>
        </div>
      </>
    )
  }

  if (!account) {
    return (
      <>
        <DashboardHeader title="Profile" />
        <div className="p-4 sm:p-6">
          <Card>
            <CardBody>
              <SkeletonRows rows={5} />
            </CardBody>
          </Card>
        </div>
      </>
    )
  }

  const { user } = account
  const dirty =
    firstName !== user.firstName ||
    lastName !== user.lastName ||
    phone !== (user.phone ?? '') ||
    country !== (user.country ?? '')

  return (
    <>
      <DashboardHeader title="Profile" />

      <div className="space-y-6 p-4 sm:p-6">
        {/* ---------- Identity summary ---------- */}
        <Card>
          <CardBody>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/12 text-xl font-semibold text-accent"
                aria-hidden="true"
              >
                {initials(user.firstName, user.lastName)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-white">
                    {user.firstName} {user.lastName}
                  </h2>
                  <StatusBadge status={user.verification} />
                </div>
                <p className="mt-1 truncate text-sm text-muted">{user.email}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Member since {formatDate(user.createdAt, 'long')}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* ---------- Personal details ---------- */}
          <Card>
            <CardHeader>
              <CardTitle>Personal details</CardTitle>
            </CardHeader>
            <CardBody>
              <form onSubmit={save} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input
                    label="First name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    icon={<User className="h-4 w-4" />}
                  />
                  <Input
                    label="Last name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </div>

                <Input
                  label="Email"
                  type="email"
                  value={user.email}
                  disabled
                  readOnly
                  icon={<Mail className="h-4 w-4" />}
                  hint={
                    account.emailVerified
                      ? 'Confirmed. Changing your email needs a verification flow that is not built yet — contact support.'
                      : 'Not yet confirmed. Check your inbox for the verification link.'
                  }
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <Input
                    label="Phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Not set"
                    icon={<Phone className="h-4 w-4" />}
                  />
                  <Select
                    label="Country"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    options={COUNTRIES}
                  />
                </div>

                {saveError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-negative/30 bg-negative/[0.07] p-3.5 text-xs leading-relaxed text-negative"
                  >
                    {saveError}
                  </p>
                )}

                <Button type="submit" loading={saving} disabled={!dirty}>
                  {dirty ? 'Save changes' : 'Saved'}
                </Button>
              </form>
            </CardBody>
          </Card>

          <div className="space-y-4">
            {/* ---------- Verification ---------- */}
            <Card>
              <CardHeader>
                <CardTitle>Verification</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <StatusBadge status={user.verification} />
                    <p className="mt-2.5 text-sm leading-relaxed text-muted">
                      {user.verification === 'verified'
                        ? account.emailVerified
                          ? 'Your identity is verified. You can deposit and withdraw.'
                          : 'Your identity is verified, but you still need to confirm your email address before you can deposit.'
                        : 'Identity verification is required before depositing or withdrawing. The documents needed depend on your jurisdiction.'}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* ---------- Security shortcut ---------- */}
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-white">
                      Two-factor authentication is{' '}
                      <span className={user.twoFactorEnabled ? 'text-positive' : 'text-warn'}>
                        {user.twoFactorEnabled ? 'on' : 'off'}
                      </span>
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      Manage 2FA, your password and active sessions.
                    </p>
                    <Link
                      href="/dashboard/security"
                      className="mt-3 inline-flex text-sm font-medium text-accent underline underline-offset-4 transition-colors hover:text-accent-bright"
                    >
                      Open security settings
                    </Link>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        <PreferencesCard />
      </div>
    </>
  )
}
