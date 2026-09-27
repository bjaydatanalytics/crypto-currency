import 'server-only'
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  supportMessages,
  supportTickets,
  users,
  type SupportMessage,
  type SupportTicket,
} from '@/db/schema'
import { AuditAction, recordAudit } from './audit'
import { sendSupportReply } from './mailer'
import type { RequestContext } from './session'

/**
 * Support tickets.
 *
 * Two invariants shape this module, and both exist because a support
 * transcript is evidence in a dispute rather than a chat log:
 *
 * 1. **Internal notes never reach the customer.** The customer-facing read
 *    filters `internal` inside the query. A caller cannot forget the filter,
 *    because there is no unfiltered customer-facing read to call.
 *
 * 2. **Messages are append-only.** No update or delete path exists. An
 *    editable history is one that can be corrected after a complaint, which is
 *    exactly when its accuracy matters.
 *
 * Status tracks who is waiting: a customer reply moves a ticket to
 * `awaiting_support`, an operator reply to `awaiting_customer`. Nobody
 * maintains that by hand, so the queue stays honest.
 */

export class SupportError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'closed' | 'forbidden' | 'empty',
  ) {
    super(message)
    this.name = 'SupportError'
  }
}

export type TicketCategory =
  | 'account'
  | 'verification'
  | 'deposit'
  | 'withdrawal'
  | 'investment'
  | 'other'

export type TicketStatus = 'awaiting_support' | 'awaiting_customer' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high'

export interface TicketMessageView {
  id: string
  authorRole: 'user' | 'admin'
  /** Null when the author's account is gone; the role still identifies the side. */
  authorName: string | null
  body: string
  internal: boolean
  createdAt: string
}

export interface TicketView {
  id: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  priority: TicketPriority
  createdAt: string
  lastMessageAt: string
  resolvedAt: string | null
  closedAt: string | null
  messageCount: number
}

export interface AdminTicketView extends TicketView {
  userId: string
  userName: string
  userEmail: string
  assignedTo: string | null
  assignedToName: string | null
  /** True when the customer is waiting on a reply. Drives the queue. */
  needsReply: boolean
}

function toTicketView(row: SupportTicket, messageCount: number): TicketView {
  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    lastMessageAt: row.lastMessageAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    messageCount,
  }
}

function toMessageView(row: SupportMessage, authorName: string | null): TicketMessageView {
  return {
    id: row.id,
    authorRole: row.authorRole,
    authorName,
    body: row.body,
    internal: row.internal,
    createdAt: row.createdAt.toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/* Creating                                                            */
/* ------------------------------------------------------------------ */

export async function createTicket(
  input: {
    userId: string
    subject: string
    category: TicketCategory
    body: string
  },
  context?: RequestContext,
): Promise<{ ticket: TicketView; messages: TicketMessageView[] }> {
  const now = new Date()

  const { ticket, message } = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(supportTickets)
      .values({
        userId: input.userId,
        subject: input.subject,
        category: input.category,
        status: 'awaiting_support',
        lastMessageAt: now,
      })
      .returning()

    const [first] = await tx
      .insert(supportMessages)
      .values({
        ticketId: created.id,
        authorId: input.userId,
        authorRole: 'user',
        body: input.body,
        internal: false,
      })
      .returning()

    return { ticket: created, message: first }
  })

  await recordAudit({
    actorId: input.userId,
    actorRole: 'user',
    action: AuditAction.SupportTicketOpened,
    targetType: 'support_ticket',
    targetId: ticket.id,
    metadata: { subject: input.subject, category: input.category },
    context,
  })

  return {
    ticket: toTicketView(ticket, 1),
    messages: [toMessageView(message, null)],
  }
}

/* ------------------------------------------------------------------ */
/* Customer reads                                                      */
/* ------------------------------------------------------------------ */

/**
 * Counts visible messages per ticket.
 *
 * A grouped join rather than a correlated subquery in the SELECT list. Drizzle
 * renders an embedded column reference *unqualified* — `${supportTickets.id}`
 * became a bare `"id"`, which inside the subquery resolved against
 * `support_messages.id` instead. The condition silently became
 * `ticket_id = id`, never matched, and every count came back as zero with no
 * error anywhere. A grouped query cannot go wrong that way.
 */
async function messageCounts(
  ticketIds: string[],
  opts: { visibleOnly: boolean },
): Promise<Map<string, number>> {
  if (ticketIds.length === 0) return new Map()

  const conditions = [
    inArray(supportMessages.ticketId, ticketIds),
    opts.visibleOnly ? eq(supportMessages.internal, false) : undefined,
  ].filter(Boolean)

  const rows = await db
    .select({ ticketId: supportMessages.ticketId, value: count() })
    .from(supportMessages)
    .where(and(...conditions))
    .groupBy(supportMessages.ticketId)

  return new Map(rows.map((row) => [row.ticketId, row.value]))
}

export async function listUserTickets(userId: string): Promise<TicketView[]> {
  const rows = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.lastMessageAt))

  const counts = await messageCounts(
    rows.map((row) => row.id),
    { visibleOnly: true },
  )

  return rows.map((row) => toTicketView(row, counts.get(row.id) ?? 0))
}

/**
 * One ticket with its messages, as the customer may see it.
 *
 * Scoped to `userId` *and* filtered to non-internal messages in the same
 * query. There is deliberately no variant of this that takes a ticket id
 * alone — that function would be one mistaken call away from serving another
 * customer's ticket, or an operator's private notes.
 */
export async function getUserTicket(
  userId: string,
  ticketId: string,
): Promise<{ ticket: TicketView; messages: TicketMessageView[] }> {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)))
    .limit(1)

  if (!ticket) throw new SupportError('No such ticket.', 'not_found')

  const rows = await db
    .select({ message: supportMessages, firstName: users.firstName, role: users.role })
    .from(supportMessages)
    .leftJoin(users, eq(users.id, supportMessages.authorId))
    .where(
      and(eq(supportMessages.ticketId, ticketId), eq(supportMessages.internal, false)),
    )
    .orderBy(supportMessages.createdAt)

  return {
    ticket: toTicketView(ticket, rows.length),
    messages: rows.map(({ message, firstName }) =>
      // Operators are shown as "Support", never by name — a customer has no
      // need for a staff member's identity, and staff have a reasonable
      // interest in not being contacted personally about a dispute.
      toMessageView(message, message.authorRole === 'admin' ? 'Support' : (firstName ?? null)),
    ),
  }
}

/* ------------------------------------------------------------------ */
/* Operator reads                                                      */
/* ------------------------------------------------------------------ */

export async function listAdminTickets(filter?: {
  status?: TicketStatus
  assignedTo?: string
  unassigned?: boolean
}): Promise<AdminTicketView[]> {
  const conditions = [
    filter?.status ? eq(supportTickets.status, filter.status) : undefined,
    filter?.assignedTo ? eq(supportTickets.assignedTo, filter.assignedTo) : undefined,
    filter?.unassigned ? isNull(supportTickets.assignedTo) : undefined,
  ].filter(Boolean)

  const rows = await db
    .select({
      ticket: supportTickets,
      userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      userEmail: users.email,
      assignedToName: sql<string | null>`(
        select first_name || ' ' || last_name from users assigned
        where assigned.id = ${supportTickets.assignedTo}
      )`,
    })
    .from(supportTickets)
    .innerJoin(users, eq(users.id, supportTickets.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    // Oldest waiting first: a queue sorted newest-first buries the person who
    // has been waiting longest, which is exactly backwards.
    .orderBy(
      sql`case ${supportTickets.status} when 'awaiting_support' then 0 else 1 end`,
      sql`case ${supportTickets.priority} when 'high' then 0 when 'normal' then 1 else 2 end`,
      supportTickets.lastMessageAt,
    )

  const counts = await messageCounts(
    rows.map(({ ticket }) => ticket.id),
    { visibleOnly: false },
  )

  return rows.map(({ ticket, userName, userEmail, assignedToName }) => ({
    ...toTicketView(ticket, counts.get(ticket.id) ?? 0),
    userId: ticket.userId,
    userName,
    userEmail,
    assignedTo: ticket.assignedTo,
    assignedToName,
    needsReply: ticket.status === 'awaiting_support',
  }))
}

/** A ticket with every message, internal notes included. Operators only. */
export async function getAdminTicket(
  ticketId: string,
): Promise<{ ticket: AdminTicketView; messages: TicketMessageView[] }> {
  const [found] = await db
    .select({
      ticket: supportTickets,
      userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      userEmail: users.email,
      assignedToName: sql<string | null>`(
        select first_name || ' ' || last_name from users assigned
        where assigned.id = ${supportTickets.assignedTo}
      )`,
    })
    .from(supportTickets)
    .innerJoin(users, eq(users.id, supportTickets.userId))
    .where(eq(supportTickets.id, ticketId))
    .limit(1)

  if (!found) throw new SupportError('No such ticket.', 'not_found')

  const rows = await db
    .select({ message: supportMessages, firstName: users.firstName, lastName: users.lastName })
    .from(supportMessages)
    .leftJoin(users, eq(users.id, supportMessages.authorId))
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(supportMessages.createdAt)

  return {
    ticket: {
      ...toTicketView(found.ticket, rows.length),
      userId: found.ticket.userId,
      userName: found.userName,
      userEmail: found.userEmail,
      assignedTo: found.ticket.assignedTo,
      assignedToName: found.assignedToName,
      needsReply: found.ticket.status === 'awaiting_support',
    },
    messages: rows.map(({ message, firstName, lastName }) =>
      toMessageView(message, firstName ? `${firstName} ${lastName ?? ''}`.trim() : null),
    ),
  }
}

/* ------------------------------------------------------------------ */
/* Replying                                                            */
/* ------------------------------------------------------------------ */

/**
 * Posts a message.
 *
 * The status flip is derived from who wrote, not passed in: a customer reply
 * means support is waiting, an operator reply means the customer is. Letting
 * the caller choose would let a ticket be answered and simultaneously marked
 * as needing no answer.
 *
 * A closed ticket accepts nothing. Reopening is an explicit status change, so
 * that "we closed this, then said more" is visible rather than implied.
 */
export async function addTicketMessage(input: {
  ticketId: string
  authorId: string
  authorRole: 'user' | 'admin'
  body: string
  /** Operators only. Ignored for customers — they cannot write private notes. */
  internal?: boolean
  /** Customers may only post to their own ticket; enforced when supplied. */
  restrictToUserId?: string
  context?: RequestContext
}): Promise<TicketMessageView> {
  const conditions = [
    eq(supportTickets.id, input.ticketId),
    input.restrictToUserId ? eq(supportTickets.userId, input.restrictToUserId) : undefined,
  ].filter(Boolean)

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(...conditions))
    .limit(1)

  if (!ticket) throw new SupportError('No such ticket.', 'not_found')
  if (ticket.status === 'closed') {
    throw new SupportError(
      'That ticket is closed. Open a new one and reference it, so the earlier record stays intact.',
      'closed',
    )
  }

  const internal = input.authorRole === 'admin' && input.internal === true
  const now = new Date()

  const message = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(supportMessages)
      .values({
        ticketId: input.ticketId,
        authorId: input.authorId,
        authorRole: input.authorRole,
        body: input.body,
        internal,
      })
      .returning()

    // An internal note is not a reply — it must not tell the customer they have
    // been answered, and must not stop the ticket showing as needing one.
    if (!internal) {
      await tx
        .update(supportTickets)
        .set({
          status: input.authorRole === 'admin' ? 'awaiting_customer' : 'awaiting_support',
          lastMessageAt: now,
          updatedAt: now,
          // A reply on a resolved ticket reopens it.
          resolvedAt: null,
        })
        .where(eq(supportTickets.id, input.ticketId))
    }

    return created
  })

  // Tell the customer an operator answered. Never for an internal note.
  if (!internal && input.authorRole === 'admin') {
    const [owner] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, ticket.userId))
      .limit(1)

    if (owner) {
      await sendSupportReply(owner.email, ticket.subject)
    }
  }

  await recordAudit({
    actorId: input.authorId,
    actorRole: input.authorRole,
    action: internal ? AuditAction.SupportNoteAdded : AuditAction.SupportReplied,
    targetType: 'support_ticket',
    targetId: input.ticketId,
    metadata: { internal, length: input.body.length },
    context: input.context,
  })

  return toMessageView(message, input.authorRole === 'admin' ? 'Support' : null)
}

/* ------------------------------------------------------------------ */
/* Operator actions                                                    */
/* ------------------------------------------------------------------ */

export async function setTicketStatus(
  ticketId: string,
  status: TicketStatus,
  actor: { id: string; context?: RequestContext },
): Promise<AdminTicketView> {
  const now = new Date()

  const [row] = await db
    .update(supportTickets)
    .set({
      status,
      updatedAt: now,
      resolvedAt: status === 'resolved' ? now : null,
      closedAt: status === 'closed' ? now : null,
    })
    .where(eq(supportTickets.id, ticketId))
    .returning()

  if (!row) throw new SupportError('No such ticket.', 'not_found')

  await recordAudit({
    actorId: actor.id,
    actorRole: 'admin',
    action: AuditAction.SupportTicketStatusChanged,
    targetType: 'support_ticket',
    targetId: ticketId,
    metadata: { status },
    context: actor.context,
  })

  return (await getAdminTicket(ticketId)).ticket
}

export async function assignTicket(
  ticketId: string,
  assignedTo: string | null,
  actor: { id: string; context?: RequestContext },
): Promise<AdminTicketView> {
  const [row] = await db
    .update(supportTickets)
    .set({ assignedTo, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId))
    .returning()

  if (!row) throw new SupportError('No such ticket.', 'not_found')

  await recordAudit({
    actorId: actor.id,
    actorRole: 'admin',
    action: AuditAction.SupportTicketAssigned,
    targetType: 'support_ticket',
    targetId: ticketId,
    metadata: { assignedTo },
    context: actor.context,
  })

  return (await getAdminTicket(ticketId)).ticket
}

export async function setTicketPriority(
  ticketId: string,
  priority: TicketPriority,
  actor: { id: string; context?: RequestContext },
): Promise<AdminTicketView> {
  const [row] = await db
    .update(supportTickets)
    .set({ priority, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId))
    .returning()

  if (!row) throw new SupportError('No such ticket.', 'not_found')
  return (await getAdminTicket(ticketId)).ticket
}

/** Count of tickets waiting on support — for a queue badge. */
export async function countTicketsAwaitingSupport(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(supportTickets)
    .where(eq(supportTickets.status, 'awaiting_support'))

  return row?.value ?? 0
}
