import 'server-only'
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { assets, users } from '@/db/schema'
import { depositAddresses, platformDepositAddresses } from '@/db/ledger-schema'
import { getNetwork, supportsAsset } from '@/lib/deposit-networks'
import { assertValidAddress, checkAddressTag, AddressValidationError } from './address-validation'
import { AuditAction, recordAudit } from './audit'
import type { RequestContext } from './session'

/**
 * Centralised receiving-address service.
 *
 * The model, end to end:
 *
 *   admin records a receiving address  →  platform_deposit_addresses (the pool)
 *   admin assigns one to a user        →  deposit_addresses          (the assignment)
 *   user's dashboard reads it          →  displayed with network + tag
 *
 * Every write here is validated and audited. The application never generates,
 * derives or guesses an address — it only stores what an operator entered and
 * the checksum validator accepted, and only shows what an operator assigned.
 */

export class DepositAddressError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unknown_asset'
      | 'unsupported_network'
      | 'invalid_address'
      | 'duplicate'
      | 'not_found'
      | 'inactive'
      | 'unknown_user',
  ) {
    super(message)
    this.name = 'DepositAddressError'
  }
}

/** Thrown when a user has no address for an asset. Never substitute a default. */
export class DepositAddressNotAssignedError extends Error {
  constructor(readonly assetId: string) {
    super(
      `No deposit address has been assigned for ${assetId.toUpperCase()}. ` +
        'Nothing is returned rather than a stand-in address — funds sent to the wrong ' +
        'destination cannot be recovered.',
    )
    this.name = 'DepositAddressNotAssignedError'
  }
}

/* ------------------------------------------------------------------ */
/* The pool                                                            */
/* ------------------------------------------------------------------ */

export interface PlatformAddressView {
  id: string
  assetId: string
  assetSymbol: string
  network: string
  address: string
  addressTag: string | null
  label: string
  custodian: string
  notes: string | null
  status: 'pending' | 'active' | 'revoked'
  /** How many users are currently shown this address. */
  assignedUsers: number
  createdAt: string
  revokedAt: string | null
}

/**
 * Lists pool addresses with a live assignment count.
 *
 * The count is the number that matters operationally: an address assigned to
 * more than one user cannot be reconciled from the chain alone, so the figure
 * is shown rather than buried.
 */
export async function listPlatformAddresses(filter?: {
  assetId?: string
  network?: string
  status?: 'active' | 'revoked'
}): Promise<PlatformAddressView[]> {
  const conditions = [
    filter?.assetId ? eq(platformDepositAddresses.assetId, filter.assetId) : undefined,
    filter?.network ? eq(platformDepositAddresses.network, filter.network) : undefined,
    filter?.status ? eq(platformDepositAddresses.status, filter.status) : undefined,
  ].filter(Boolean)

  const rows = await db
    .select({
      row: platformDepositAddresses,
      assetSymbol: assets.symbol,
    })
    .from(platformDepositAddresses)
    .innerJoin(assets, eq(assets.id, platformDepositAddresses.assetId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(platformDepositAddresses.createdAt))

  if (rows.length === 0) return []

  const counts = await db
    .select({
      sourceAddressId: depositAddresses.sourceAddressId,
      value: count(),
    })
    .from(depositAddresses)
    .where(
      and(
        inArray(
          depositAddresses.sourceAddressId,
          rows.map(({ row }) => row.id),
        ),
        eq(depositAddresses.status, 'active'),
      ),
    )
    .groupBy(depositAddresses.sourceAddressId)

  const countByAddress = new Map(counts.map((entry) => [entry.sourceAddressId, entry.value]))

  return rows.map(({ row, assetSymbol }) => ({
    id: row.id,
    assetId: row.assetId,
    assetSymbol,
    network: row.network,
    address: row.address,
    addressTag: row.addressTag,
    label: row.label,
    custodian: row.custodian,
    notes: row.notes,
    status: row.status,
    assignedUsers: countByAddress.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }))
}

export interface CreatePlatformAddressInput {
  assetId: string
  network: string
  address: string
  addressTag?: string | null
  label: string
  custodian: string
  notes?: string | null
}

/**
 * Records a new receiving address.
 *
 * Refuses rather than warns on every failure mode that would cost money:
 * an asset that does not exist on the chosen chain, an address whose checksum
 * does not verify, a memo network with no tag, or a destination already on file.
 */
export async function createPlatformAddress(
  input: CreatePlatformAddressInput,
  actor: { id: string; context?: RequestContext },
): Promise<PlatformAddressView> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, input.assetId)).limit(1)
  if (!asset) throw new DepositAddressError(`Unknown asset "${input.assetId}".`, 'unknown_asset')

  const network = getNetwork(input.network)
  if (!network) {
    throw new DepositAddressError(`Unknown network "${input.network}".`, 'unsupported_network')
  }

  if (!supportsAsset(network.id, input.assetId)) {
    throw new DepositAddressError(
      `${asset.symbol} does not exist on ${network.label}. Sending it there would lose the funds.`,
      'unsupported_network',
    )
  }

  const address = input.address.trim()
  const addressTag = input.addressTag?.trim() || null

  try {
    assertValidAddress(network.id, address)
  } catch (error) {
    if (error instanceof AddressValidationError) {
      throw new DepositAddressError(error.message, 'invalid_address')
    }
    throw error
  }

  const tagCheck = checkAddressTag(network.id, addressTag)
  if (!tagCheck.valid) {
    throw new DepositAddressError(tagCheck.reason ?? 'Invalid tag.', 'invalid_address')
  }

  const [row] = await db
    .insert(platformDepositAddresses)
    .values({
      assetId: input.assetId,
      network: network.id,
      address,
      addressTag,
      label: input.label.trim(),
      custodian: input.custodian.trim().toLowerCase(),
      notes: input.notes?.trim() || null,
      status: 'active',
      createdBy: actor.id,
    })
    .onConflictDoNothing()
    .returning()

  if (!row) {
    throw new DepositAddressError(
      'That destination is already on file for this network.',
      'duplicate',
    )
  }

  await recordAudit({
    actorId: actor.id,
    actorRole: 'admin',
    action: AuditAction.DepositAddressAdded,
    targetType: 'platform_deposit_address',
    targetId: row.id,
    // The address itself is recorded: the point of the trail is being able to
    // prove later exactly which destination was entered, and by whom.
    metadata: {
      assetId: row.assetId,
      network: row.network,
      address: row.address,
      addressTag: row.addressTag,
      custodian: row.custodian,
    },
    context: actor.context,
  })

  return {
    id: row.id,
    assetId: row.assetId,
    assetSymbol: asset.symbol,
    network: row.network,
    address: row.address,
    addressTag: row.addressTag,
    label: row.label,
    custodian: row.custodian,
    notes: row.notes,
    status: row.status,
    assignedUsers: 0,
    createdAt: row.createdAt.toISOString(),
    revokedAt: null,
  }
}

/**
 * Retires a pool address and every assignment pointing at it.
 *
 * Both halves happen in one transaction. Retiring the pool entry while leaving
 * users looking at it would keep sending deposits to a destination nobody is
 * watching any more — the worst of both states.
 */
export async function revokePlatformAddress(
  id: string,
  actor: { id: string; context?: RequestContext },
): Promise<{ revokedAssignments: number }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(platformDepositAddresses)
      .where(eq(platformDepositAddresses.id, id))
      .limit(1)

    if (!row) throw new DepositAddressError('That address is not on file.', 'not_found')
    if (row.status === 'revoked') return { revokedAssignments: 0 }

    const revoked = await tx
      .update(depositAddresses)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(
        and(eq(depositAddresses.sourceAddressId, id), eq(depositAddresses.status, 'active')),
      )
      .returning({ id: depositAddresses.id, userId: depositAddresses.userId })

    await tx
      .update(platformDepositAddresses)
      .set({ status: 'revoked', revokedAt: new Date(), revokedBy: actor.id })
      .where(eq(platformDepositAddresses.id, id))

    await recordAudit({
      actorId: actor.id,
      actorRole: 'admin',
      action: AuditAction.DepositAddressRevoked,
      targetType: 'platform_deposit_address',
      targetId: id,
      metadata: {
        address: row.address,
        network: row.network,
        revokedAssignments: revoked.length,
        affectedUsers: revoked.map((entry) => entry.userId),
      },
      context: actor.context,
    })

    return { revokedAssignments: revoked.length }
  })
}

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */

export interface AssignmentView {
  id: string
  userId: string
  userEmail: string
  userName: string
  assetId: string
  assetSymbol: string
  network: string
  address: string
  addressTag: string | null
  custodian: string
  label: string | null
  status: 'pending' | 'active' | 'revoked'
  assignedAt: string
  revokedAt: string | null
}

function assignmentQuery() {
  return db
    .select({
      assignment: depositAddresses,
      assetSymbol: assets.symbol,
      userEmail: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      label: platformDepositAddresses.label,
    })
    .from(depositAddresses)
    .innerJoin(assets, eq(assets.id, depositAddresses.assetId))
    .innerJoin(users, eq(users.id, depositAddresses.userId))
    .leftJoin(
      platformDepositAddresses,
      eq(platformDepositAddresses.id, depositAddresses.sourceAddressId),
    )
}

type AssignmentRow = Awaited<ReturnType<typeof assignmentQuery>>[number]

function toAssignmentView(row: AssignmentRow): AssignmentView {
  return {
    id: row.assignment.id,
    userId: row.assignment.userId,
    userEmail: row.userEmail,
    userName: `${row.firstName} ${row.lastName}`,
    assetId: row.assignment.assetId,
    assetSymbol: row.assetSymbol,
    network: row.assignment.network,
    address: row.assignment.address,
    addressTag: row.assignment.addressTag,
    custodian: row.assignment.provider,
    label: row.label,
    status: row.assignment.status,
    assignedAt: row.assignment.createdAt.toISOString(),
    revokedAt: row.assignment.revokedAt?.toISOString() ?? null,
  }
}

export async function listAssignments(filter?: {
  userId?: string
  sourceAddressId?: string
  includeRevoked?: boolean
}): Promise<AssignmentView[]> {
  const conditions = [
    filter?.userId ? eq(depositAddresses.userId, filter.userId) : undefined,
    filter?.sourceAddressId
      ? eq(depositAddresses.sourceAddressId, filter.sourceAddressId)
      : undefined,
    filter?.includeRevoked ? undefined : eq(depositAddresses.status, 'active'),
  ].filter(Boolean)

  const rows = await assignmentQuery()
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(depositAddresses.createdAt))
    .limit(500)

  return rows.map(toAssignmentView)
}

/**
 * Shows a pool address to a user.
 *
 * Any address the user currently holds for the same asset and network is
 * revoked in the same transaction, so there is never a moment where two live
 * assignments disagree about where their funds should go. The old row is kept,
 * not deleted — it is the record explaining any deposit that arrives at the
 * previous destination afterwards.
 */
export async function assignAddressToUser(
  input: { userId: string; platformAddressId: string },
  actor: { id: string; context?: RequestContext },
): Promise<AssignmentView> {
  const assignmentId = await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, input.userId)).limit(1)
    if (!user) throw new DepositAddressError('No such user.', 'unknown_user')

    const [pool] = await tx
      .select()
      .from(platformDepositAddresses)
      .where(eq(platformDepositAddresses.id, input.platformAddressId))
      .limit(1)

    if (!pool) throw new DepositAddressError('That address is not on file.', 'not_found')
    if (pool.status !== 'active') {
      throw new DepositAddressError(
        'That address has been retired and cannot be assigned.',
        'inactive',
      )
    }

    const superseded = await tx
      .update(depositAddresses)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(
        and(
          eq(depositAddresses.userId, input.userId),
          eq(depositAddresses.assetId, pool.assetId),
          eq(depositAddresses.network, pool.network),
          eq(depositAddresses.status, 'active'),
        ),
      )
      .returning({ id: depositAddresses.id, address: depositAddresses.address })

    const [row] = await tx
      .insert(depositAddresses)
      .values({
        userId: input.userId,
        assetId: pool.assetId,
        network: pool.network,
        // Copied, not referenced: the user must keep seeing the destination
        // they were actually given even if the pool row is edited later.
        address: pool.address,
        addressTag: pool.addressTag,
        sourceAddressId: pool.id,
        assignedBy: actor.id,
        status: 'active',
        provider: pool.custodian,
        providerReference: pool.label,
      })
      .returning({ id: depositAddresses.id })

    await recordAudit({
      actorId: actor.id,
      actorRole: 'admin',
      action: AuditAction.DepositAddressAssigned,
      targetType: 'user',
      targetId: input.userId,
      metadata: {
        assignmentId: row.id,
        platformAddressId: pool.id,
        assetId: pool.assetId,
        network: pool.network,
        address: pool.address,
        addressTag: pool.addressTag,
        supersededAssignments: superseded.map((entry) => entry.id),
      },
      context: actor.context,
    })

    return row.id
  })

  const [view] = await assignmentQuery().where(eq(depositAddresses.id, assignmentId)).limit(1)
  return toAssignmentView(view)
}

/** Stops showing an address to a user. The row is kept as history. */
export async function revokeAssignment(
  assignmentId: string,
  actor: { id: string; context?: RequestContext },
): Promise<boolean> {
  const [row] = await db
    .update(depositAddresses)
    .set({ status: 'revoked', revokedAt: new Date() })
    .where(and(eq(depositAddresses.id, assignmentId), eq(depositAddresses.status, 'active')))
    .returning()

  if (!row) return false

  await recordAudit({
    actorId: actor.id,
    actorRole: 'admin',
    action: AuditAction.DepositAddressUnassigned,
    targetType: 'user',
    targetId: row.userId,
    metadata: {
      assignmentId,
      assetId: row.assetId,
      network: row.network,
      address: row.address,
    },
    context: actor.context,
  })

  return true
}

/* ------------------------------------------------------------------ */
/* User-facing reads                                                   */
/* ------------------------------------------------------------------ */

export interface UserDepositAddress {
  assetId: string
  network: string
  networkLabel: string
  address: string
  addressTag: string | null
  tagLabel: string | null
  custodian: string
  assignedAt: string
}

/**
 * The addresses a user should be shown. Read-only, and never creates anything.
 *
 * An asset with no assignment is simply absent from the result. That is the
 * honest answer — the alternative, falling back to some other user's address or
 * a platform default, would route their funds to the wrong place.
 */
export async function listUserDepositAddresses(userId: string): Promise<UserDepositAddress[]> {
  const rows = await db
    .select()
    .from(depositAddresses)
    .where(and(eq(depositAddresses.userId, userId), eq(depositAddresses.status, 'active')))
    .orderBy(depositAddresses.assetId)

  return rows.map((row) => {
    const network = getNetwork(row.network)
    return {
      assetId: row.assetId,
      network: row.network,
      networkLabel: network?.label ?? row.network,
      address: row.address,
      addressTag: row.addressTag,
      tagLabel: row.addressTag ? (network?.tagLabel ?? 'Memo') : null,
      custodian: row.provider,
      assignedAt: row.createdAt.toISOString(),
    }
  })
}

export async function getUserDepositAddress(
  userId: string,
  assetId: string,
  network?: string,
): Promise<UserDepositAddress | null> {
  const conditions = [
    eq(depositAddresses.userId, userId),
    eq(depositAddresses.assetId, assetId),
    eq(depositAddresses.status, 'active'),
    network ? eq(depositAddresses.network, network) : undefined,
  ].filter(Boolean)

  const [row] = await db
    .select()
    .from(depositAddresses)
    .where(and(...conditions))
    .limit(1)

  if (!row) return null

  const networkInfo = getNetwork(row.network)
  return {
    assetId: row.assetId,
    network: row.network,
    networkLabel: networkInfo?.label ?? row.network,
    address: row.address,
    addressTag: row.addressTag,
    tagLabel: row.addressTag ? (networkInfo?.tagLabel ?? 'Memo') : null,
    custodian: row.provider,
    assignedAt: row.createdAt.toISOString(),
  }
}

/**
 * Users with no active address for any asset.
 *
 * Surfaced on the admin screen because an unassigned verified user is a person
 * who has completed onboarding and then found nowhere to send funds.
 */
export async function listUsersAwaitingAddress(limit = 50) {
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      kycStatus: users.kycStatus,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(
      depositAddresses,
      and(eq(depositAddresses.userId, users.id), eq(depositAddresses.status, 'active')),
    )
    .where(and(isNull(depositAddresses.id), sql`${users.role} = 'user'`))
    .orderBy(desc(users.createdAt))
    .limit(limit)
}
