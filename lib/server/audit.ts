import 'server-only'
import { db } from '@/db'
import { auditLog, loginEvents } from '@/db/schema'
import type { RequestContext } from './session'

/**
 * Audit logging.
 *
 * Records what happened, who did it and from where. This is the evidence base
 * for a dispute, an incident review or a regulator's question, so it is written
 * on the success path too — not only on failure.
 */

export const AuditAction = {
  UserRegistered: 'user.registered',
  UserLoggedIn: 'user.logged_in',
  UserLoggedOut: 'user.logged_out',
  LoginFailed: 'user.login_failed',
  EmailVerified: 'user.email_verified',
  PasswordChanged: 'user.password_changed',
  PasswordResetRequested: 'user.password_reset_requested',
  PasswordResetCompleted: 'user.password_reset_completed',
  TwoFactorEnabled: 'user.2fa_enabled',
  TwoFactorDisabled: 'user.2fa_disabled',
  RecoveryCodeUsed: 'user.recovery_code_used',
  SessionRevoked: 'session.revoked',
  AllSessionsRevoked: 'session.revoked_all',
  ProfileUpdated: 'user.profile_updated',
  KycSubmitted: 'kyc.submitted',
  KycReviewed: 'kyc.reviewed',
  AdminViewedUsers: 'admin.viewed_users',
  AdminUpdatedUser: 'admin.updated_user',
  /**
   * Receiving-address lifecycle.
   *
   * Logged in full because these are the entries a dispute turns on: if a user
   * says "the site told me to send to X", the answer has to be reconstructable
   * — who entered X, who assigned it to that account, when, and what the user
   * was actually shown at the time.
   */
  DepositAddressAdded: 'deposit_address.added',
  DepositAddressRevoked: 'deposit_address.revoked',
  DepositAddressAssigned: 'deposit_address.assigned',
  DepositAddressUnassigned: 'deposit_address.unassigned',
  DepositAddressViewed: 'deposit_address.viewed',
  /**
   * Money movement performed by an operator.
   *
   * With no custodian in the loop, these entries *are* the record of who moved
   * what. A credit posted to the wrong account and a payment sent to the wrong
   * address are both recoverable questions only if the action, the actor and
   * the figures were written down at the time.
   */
  DepositRecorded: 'deposit.recorded',
  DepositCredited: 'deposit.credited',
  DepositRejected: 'deposit.rejected',
  WithdrawalRequested: 'withdrawal.requested',
  WithdrawalApproved: 'withdrawal.approved',
  WithdrawalSettled: 'withdrawal.settled',
  WithdrawalRejected: 'withdrawal.rejected',
  /**
   * Plan terms.
   *
   * Published plan terms are a financial promotion — what a customer was told
   * when they signed up. Recording the previous values on every edit is what
   * makes "what did this plan say in March" an answerable question.
   */
  PlanCreated: 'plan.created',
  PlanUpdated: 'plan.updated',
  PlanPublished: 'plan.published',
  PlanUnpublished: 'plan.unpublished',
  PlanDeleted: 'plan.deleted',
  /**
   * Marketing or analytics consent given or withdrawn.
   *
   * "Had they consented on this date" is a question asked in earnest, by the
   * person themselves or by a regulator, and the current value of a boolean
   * cannot answer it.
   */
  ConsentChanged: 'user.consent_changed',
  /**
   * Investment contracts.
   *
   * A fixed-return plan is a debt the business takes on, so the moment it was
   * taken on — and the exact terms at that moment — has to be recoverable
   * independently of the row, which an operator can later edit.
   */
  InvestmentOpened: 'investment.opened',
  InvestmentMatured: 'investment.matured',
  InvestmentCancelled: 'investment.cancelled',
  /** The business putting its own money in to cover what it has promised. */
  TreasuryFunded: 'treasury.funded',
  /**
   * Support.
   *
   * Recorded because a support transcript is evidence in a dispute. Who
   * replied, when, and whether a note was internal are all questions that get
   * asked after the fact — and the messages themselves are append-only, so the
   * audit trail and the transcript corroborate each other.
   */
  SupportTicketOpened: 'support.ticket_opened',
  SupportReplied: 'support.replied',
  SupportNoteAdded: 'support.note_added',
  SupportTicketStatusChanged: 'support.status_changed',
  SupportTicketAssigned: 'support.assigned',
} as const

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction]

interface AuditInput {
  actorId?: string | null
  actorRole?: 'user' | 'admin' | null
  action: AuditActionType
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
  context?: RequestContext
}

/**
 * Writes an audit entry.
 *
 * Never throws: a logging failure must not roll back or block the action the
 * user actually asked for. Failures are surfaced to the server console so they
 * are visible in monitoring.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
      ipAddress: input.context?.ipAddress ?? null,
      userAgent: input.context?.userAgent ?? null,
    })
  } catch (error) {
    console.error('[audit] failed to write entry', input.action, error)
  }
}

/**
 * Records a sign-in attempt.
 *
 * Failures are recorded with the attempted address but never the password, and
 * never a hint about whether that address exists.
 */
export async function recordLoginAttempt(input: {
  userId?: string | null
  emailAttempted: string
  success: boolean
  failureReason?: string
  context: RequestContext
}): Promise<void> {
  try {
    await db.insert(loginEvents).values({
      userId: input.userId ?? null,
      emailAttempted: input.emailAttempted.slice(0, 320),
      success: input.success,
      failureReason: input.failureReason,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
    })
  } catch (error) {
    console.error('[audit] failed to write login event', error)
  }
}
