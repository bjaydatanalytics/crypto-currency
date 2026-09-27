import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { kycRecords, users } from '@/db/schema'
import { conflict, created, ok, parseBody, tooManyRequests, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { requireVerifiedUser } from '@/lib/server/guard'
import { RULES, checkRateLimit } from '@/lib/server/rate-limit'
import { getRequestContext } from '@/lib/server/session'
import { kycSubmitSchema } from '@/lib/server/validation'

/** GET — current verification status and history for the signed-in user. */
export const GET = withErrorHandling(async () => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const records = await db
    .select({
      id: kycRecords.id,
      status: kycRecords.status,
      provider: kycRecords.provider,
      rejectionReason: kycRecords.rejectionReason,
      submittedAt: kycRecords.submittedAt,
      reviewedAt: kycRecords.reviewedAt,
    })
    .from(kycRecords)
    .where(eq(kycRecords.userId, guard.user.id))
    .orderBy(desc(kycRecords.submittedAt))
    .limit(10)

  return ok({
    status: guard.user.kycStatus,
    records: records.map((record) => ({
      ...record,
      submittedAt: record.submittedAt.toISOString(),
      reviewedAt: record.reviewedAt?.toISOString() ?? null,
    })),
  })
})

/**
 * POST — record a KYC submission.
 *
 * Takes only the provider's reference. Identity documents are uploaded by the
 * user directly to the KYC provider, which is contracted and built to store
 * them lawfully; copying passports into our own database would multiply the
 * damage of any breach for no operational gain.
 *
 * The decision itself arrives asynchronously on the provider's webhook — this
 * endpoint never sets `verified`, because the platform cannot mark itself
 * satisfied on the user's say-so.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const limit = await checkRateLimit(`kyc:${guard.user.id}`, RULES.kycSubmit)
  if (!limit.allowed) {
    return tooManyRequests(
      'Too many verification attempts. Contact support if you need help.',
      limit.retryAfterSeconds,
    )
  }

  if (guard.user.kycStatus === 'verified') {
    return conflict('Your identity is already verified.')
  }
  if (guard.user.kycStatus === 'pending') {
    return conflict('A verification check is already in progress.')
  }

  const parsed = await parseBody(request, kycSubmitSchema)
  if (!parsed.success) return parsed.response

  const context = await getRequestContext()

  const record = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(kycRecords)
      .values({
        userId: guard.user.id,
        provider: 'manual',
        providerReference: parsed.data.providerReference,
        status: 'pending',
      })
      .returning()

    await tx
      .update(users)
      .set({ kycStatus: 'pending', updatedAt: new Date() })
      .where(eq(users.id, guard.user.id))

    return row
  })

  await recordAudit({
    actorId: guard.user.id,
    actorRole: guard.user.role,
    action: AuditAction.KycSubmitted,
    targetType: 'kyc_record',
    targetId: record.id,
    context,
  })

  return created({
    status: 'pending',
    message: 'Your verification has been submitted and is under review.',
  })
})
