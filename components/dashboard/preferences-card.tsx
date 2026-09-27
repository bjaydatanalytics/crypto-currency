'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Globe, Lock } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { PendingInfo } from '@/components/ui/demo-notice'
import { SkeletonRows } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { fetchPreferences, savePreferences, type Preferences } from '@/lib/api/auth'
import { formatDate } from '@/lib/utils'

/**
 * Account preferences.
 *
 * Each control below either changes what the system does, or says plainly that
 * it does not yet. The distinction is the whole point: a switch that persists
 * a value nobody reads is still a fake setting, just a more convincing one.
 *
 * - **Security alerts** are shown as permanently on, with no switch. They are
 *   how someone learns their account was taken over, and an attacker holding a
 *   live session would disable them first. There is no column to set.
 * - **Transaction emails** genuinely gate the notices sent when a deposit is
 *   credited or a withdrawal is paid.
 * - **Marketing and analytics** are consent records. Nothing sends marketing
 *   or loads analytics today; the choice is stored with its date and must be
 *   honoured by whatever is built later. The card says exactly that.
 * - **Currency and language** are absent as controls, because converting
 *   currency needs an exchange-rate source and another language needs
 *   translations. Neither exists.
 *
 * Saves immediately on toggle rather than behind a button. There is no
 * meaningful "draft" state for a single switch, and an unsaved toggle that
 * looks set is its own kind of lie.
 */

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label
      className={
        disabled
          ? 'flex cursor-default items-start gap-3 opacity-80'
          : 'flex cursor-pointer items-start gap-3'
      }
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--accent,#B8FF00)]"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm text-white">
          {label}
          {disabled && <Lock className="h-3 w-3 text-muted" aria-hidden="true" />}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>
      </span>
    </label>
  )
}

export function PreferencesCard() {
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setPreferences(await fetchPreferences())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your preferences.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function update(changes: Parameters<typeof savePreferences>[0], label: string) {
    if (!preferences) return

    // Optimistic, then reconciled with what the server actually stored.
    const previous = preferences
    setPreferences({ ...preferences, ...changes })
    setSaving(true)

    try {
      setPreferences(await savePreferences(changes))
      toast({ tone: 'success', title: 'Saved', description: `${label} updated.` })
    } catch (cause) {
      setPreferences(previous)
      toast({
        tone: 'warn',
        title: 'Not saved',
        description: cause instanceof Error ? cause.message : 'Try again in a moment.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id="settings" className="scroll-mt-24">
      <CardHeader>
        <div>
          <CardTitle>Preferences</CardTitle>
          <p className="mt-1 text-xs text-muted">
            {saving ? 'Saving…' : 'Changes save as you make them'}
          </p>
        </div>
      </CardHeader>

      <CardBody className="space-y-8">
        {error ? (
          <p className="rounded-lg border border-negative/30 bg-negative/[0.07] p-3.5 text-sm leading-relaxed text-negative">
            {error}
          </p>
        ) : !preferences ? (
          <SkeletonRows rows={4} />
        ) : (
          <>
            <fieldset>
              <legend className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                <Bell className="h-4 w-4 text-accent" aria-hidden="true" />
                Email notifications
              </legend>
              <div className="space-y-4">
                <Toggle
                  label="Security alerts"
                  description="Password changes, two-factor changes and new withdrawal addresses. These cannot be turned off — they are how you would find out someone else got into your account."
                  checked
                  disabled
                  onChange={() => undefined}
                />
                <Toggle
                  label="Transaction updates"
                  description="Sent when a deposit is credited or a withdrawal is paid, with the amount and transaction hash."
                  checked={preferences.transactionEmails}
                  onChange={(next) =>
                    update({ transactionEmails: next }, 'Transaction updates')
                  }
                />
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                <Globe className="h-4 w-4 text-accent" aria-hidden="true" />
                Privacy and marketing
              </legend>
              <div className="space-y-4">
                <Toggle
                  label="Marketing emails"
                  description={
                    preferences.marketingConsentAt
                      ? `You agreed on ${formatDate(preferences.marketingConsentAt, 'long')}. Nothing marketing is sent yet; your choice is recorded and will be honoured.`
                      : 'Off. Nothing marketing is sent yet, and nothing will be sent unless you turn this on.'
                  }
                  checked={preferences.marketingEmails}
                  onChange={(next) => update({ marketingEmails: next }, 'Marketing emails')}
                />
                <Toggle
                  label="Analytics"
                  description={
                    preferences.analyticsConsentAt
                      ? `You agreed on ${formatDate(preferences.analyticsConsentAt, 'long')}. No analytics are loaded yet; your choice is recorded and will be honoured.`
                      : 'Off. No analytics or tracking scripts are loaded on this site at all today.'
                  }
                  checked={preferences.analyticsConsent}
                  onChange={(next) => update({ analyticsConsent: next }, 'Analytics')}
                />
              </div>
            </fieldset>

            <div>
              <p className="mb-2 text-sm font-medium text-white">Display</p>
              <p className="text-xs leading-relaxed text-muted">
                Amounts are shown in US dollars and the interface is in English. Other
                currencies need an exchange-rate source, and other languages need
                translations — neither exists yet, so there is nothing to choose between.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <PendingInfo label="Additional display currencies" />
                <PendingInfo label="Additional languages" />
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}
