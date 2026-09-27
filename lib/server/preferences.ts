import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { userPreferences, type UserPreferences } from '@/db/schema'

/**
 * User preferences.
 *
 * A missing row means "never changed anything", not "no preferences". Every
 * read falls back to the documented defaults rather than returning null, so a
 * caller deciding whether to send an email cannot accidentally treat an absent
 * row as consent — or as refusal.
 */

export interface Preferences {
  transactionEmails: boolean
  marketingEmails: boolean
  marketingConsentAt: string | null
  analyticsConsent: boolean
  analyticsConsentAt: string | null
  displayCurrency: string
  language: string
}

/**
 * Defaults for an account that has never saved preferences.
 *
 * Transaction mail is on because it concerns the customer's own money moving.
 * Both consents are off: consent is something a person gives, and a default of
 * `true` would mean assuming it from silence.
 */
export const DEFAULT_PREFERENCES: Preferences = {
  transactionEmails: true,
  marketingEmails: false,
  marketingConsentAt: null,
  analyticsConsent: false,
  analyticsConsentAt: null,
  displayCurrency: 'USD',
  language: 'en',
}

function toView(row: UserPreferences): Preferences {
  return {
    transactionEmails: row.transactionEmails,
    marketingEmails: row.marketingEmails,
    marketingConsentAt: row.marketingConsentAt?.toISOString() ?? null,
    analyticsConsent: row.analyticsConsent,
    analyticsConsentAt: row.analyticsConsentAt?.toISOString() ?? null,
    displayCurrency: row.displayCurrency,
    language: row.language,
  }
}

export async function getPreferences(userId: string): Promise<Preferences> {
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)

  return row ? toView(row) : { ...DEFAULT_PREFERENCES }
}

export interface PreferencesUpdate {
  transactionEmails?: boolean
  marketingEmails?: boolean
  analyticsConsent?: boolean
  displayCurrency?: string
  language?: string
}

/**
 * Writes preferences, creating the row on first save.
 *
 * Consent timestamps are only touched when the consent itself changes, so
 * re-saving an unrelated preference does not rewrite the date someone agreed
 * to marketing. Withdrawing consent clears the timestamp: there is no longer a
 * date on which they agreed, and leaving a stale one would misrepresent that.
 */
export async function updatePreferences(
  userId: string,
  changes: PreferencesUpdate,
): Promise<Preferences> {
  const current = await getPreferences(userId)
  const now = new Date()

  const marketingChanged =
    changes.marketingEmails !== undefined && changes.marketingEmails !== current.marketingEmails
  const analyticsChanged =
    changes.analyticsConsent !== undefined && changes.analyticsConsent !== current.analyticsConsent

  const next = {
    transactionEmails: changes.transactionEmails ?? current.transactionEmails,
    marketingEmails: changes.marketingEmails ?? current.marketingEmails,
    analyticsConsent: changes.analyticsConsent ?? current.analyticsConsent,
    displayCurrency: changes.displayCurrency ?? current.displayCurrency,
    language: changes.language ?? current.language,
    marketingConsentAt: marketingChanged
      ? changes.marketingEmails
        ? now
        : null
      : current.marketingConsentAt
        ? new Date(current.marketingConsentAt)
        : null,
    analyticsConsentAt: analyticsChanged
      ? changes.analyticsConsent
        ? now
        : null
      : current.analyticsConsentAt
        ? new Date(current.analyticsConsentAt)
        : null,
  }

  const [row] = await db
    .insert(userPreferences)
    .values({ userId, ...next })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { ...next, updatedAt: now },
    })
    .returning()

  return toView(row)
}

/**
 * Whether a transaction email may be sent to this user.
 *
 * Deliberately a named function rather than an inline boolean: every future
 * transaction notification should route through this, so turning the
 * preference off genuinely stops all of them.
 */
export async function wantsTransactionEmails(userId: string): Promise<boolean> {
  return (await getPreferences(userId)).transactionEmails
}

/**
 * Whether marketing may be sent to this user.
 *
 * Nothing sends marketing today. This exists so that when something does, the
 * check is already here and opt-in is the only path to `true` — a later
 * implementer has no reason to reach for the column directly.
 */
export async function wantsMarketingEmails(userId: string): Promise<boolean> {
  return (await getPreferences(userId)).marketingEmails
}
