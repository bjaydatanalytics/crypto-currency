import { and, count, desc, ilike, eq, or, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { kycRecords, users } from '@/db/schema'
import { badRequest, ok, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { requireAdmin } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import { adminUserQuerySchema } from '@/lib/server/validation'

/**
 * GET — paginated user list.
 *
 * Every call is audited. Bulk access to customer records is exactly what an
 * insider-abuse review needs to be able to reconstruct afterwards.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const url = new URL(request.url)
  const parsed = adminUserQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return badRequest('Invalid query parameters.')

  const { search, status, kycStatus, page, pageSize } = parsed.data

  const filters: SQL[] = []
  if (search) {
    // ilike with a bound parameter — the value is never concatenated into SQL.
    const term = `%${search}%`
    const match = or(
      ilike(users.email, term),
      ilike(users.firstName, term),
      ilike(users.lastName, term),
    )
    if (match) filters.push(match)
  }
  if (status) filters.push(eq(users.status, status))
  if (kycStatus) filters.push(eq(users.kycStatus, kycStatus))

  const where = filters.length > 0 ? and(...filters) : undefined

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        status: users.status,
        kycStatus: users.kycStatus,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        // The reviewer needs to see whether anything was actually submitted.
        // Approving someone who never filed documents is a different decision
        // from approving someone who did, and the screen must not blur the two.
        kycSubmittedAt: kycRecords.submittedAt,
        kycProvider: kycRecords.provider,
        kycProviderReference: kycRecords.providerReference,
        kycRejectionReason: kycRecords.rejectionReason,
      })
      .from(users)
      .leftJoin(kycRecords, eq(kycRecords.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(users).where(where),
  ])

  await recordAudit({
    actorId: guard.user.id,
    actorRole: 'admin',
    action: AuditAction.AdminViewedUsers,
    metadata: { search, status, kycStatus, page, returned: rows.length },
    context: await getRequestContext(),
  })

  return ok({
    items: rows.map((row) => ({
      id: row.id,
      name: `${row.firstName} ${row.lastName}`,
      email: row.email,
      role: row.role,
      status: row.status,
      verification: row.kycStatus,
      emailVerified: Boolean(row.emailVerifiedAt),
      joined: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      kycSubmittedAt: row.kycSubmittedAt?.toISOString() ?? null,
      kycProvider: row.kycProvider,
      kycProviderReference: row.kycProviderReference,
      kycRejectionReason: row.kycRejectionReason,
      /**
       * Whether this account can actually deposit.
       *
       * Both gates must pass — `requireKycVerified` checks email verification
       * *and* KYC. Surfacing it here stops an admin approving KYC, seeing
       * "verified", and not understanding why the customer still cannot fund.
       */
      canDeposit: row.kycStatus === 'verified' && Boolean(row.emailVerifiedAt),
    })),
    page,
    pageSize,
    total: totals?.value ?? 0,
  })
})
