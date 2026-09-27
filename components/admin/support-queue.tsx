'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, EyeOff, LifeBuoy, Lock, Send, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SkeletonRows } from '@/components/ui/skeleton'
import {
  MobileCard,
  MobileCardList,
  MobileRow,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import {
  assignTicket,
  fetchSupportTicket,
  listSupportQueue,
  replyAsSupport,
  setTicketPriority,
  setTicketStatus,
  type AdminTicket,
  type TicketMessage,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/api/support'
import { formatDate, relativeTime } from '@/lib/utils'

/**
 * The support queue and thread.
 *
 * Two things this screen works hard to keep unambiguous:
 *
 * 1. **Whether a message is private.** An internal note is written in a
 *    visually distinct box, labelled, and the composer changes colour and
 *    button text when the note toggle is on. A note written in the belief it
 *    was private and sent to the customer is the failure mode that matters
 *    here, and it is a UI failure before it is a data one.
 *
 * 2. **Who is waiting.** The queue puts awaiting-support first and oldest
 *    first inside that, so the person who has waited longest is at the top.
 */

const STATUS_LABELS: Record<TicketStatus, string> = {
  awaiting_support: 'Needs reply',
  awaiting_customer: 'Waiting on customer',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_TONES: Record<TicketStatus, 'warn' | 'accent' | 'success' | 'neutral'> = {
  awaiting_support: 'warn',
  awaiting_customer: 'accent',
  resolved: 'success',
  closed: 'neutral',
}

const PRIORITY_TONES: Record<TicketPriority, 'danger' | 'neutral' | 'info'> = {
  high: 'danger',
  normal: 'neutral',
  low: 'info',
}

const FILTERS = [
  { value: 'awaiting_support', label: 'Needs reply' },
  { value: 'all', label: 'All tickets' },
  { value: 'awaiting_customer', label: 'Waiting on customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

/* ------------------------------------------------------------------ */
/* Thread                                                              */
/* ------------------------------------------------------------------ */

function Thread({
  ticketId,
  currentAdminId,
  onBack,
  onChanged,
}: {
  ticketId: string
  currentAdminId?: string
  onBack: () => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [ticket, setTicket] = useState<AdminTicket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[] | null>(null)
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await fetchSupportTicket(ticketId)
      setTicket(result.ticket)
      setMessages(result.messages)
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause, 'Could not load that ticket.'))
    }
  }, [ticketId])

  useEffect(() => {
    void load()
  }, [load])

  async function send() {
    setBusy(true)
    try {
      const result = await replyAsSupport(ticketId, body.trim(), internal)
      toast({
        tone: 'success',
        title: internal ? 'Note saved' : 'Reply sent',
        description: result.note,
      })
      setBody('')
      setInternal(false)
      await load()
      onChanged()
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Not sent',
        description: errorMessage(cause, 'Try again.'),
      })
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(status: TicketStatus) {
    try {
      const result = await setTicketStatus(ticketId, status)
      toast({ tone: 'success', title: 'Updated', description: result.note })
      await load()
      onChanged()
    } catch (cause) {
      toast({ tone: 'warn', title: 'Could not update', description: errorMessage(cause, 'Try again.') })
    }
  }

  async function changePriority(priority: TicketPriority) {
    try {
      await setTicketPriority(ticketId, priority)
      await load()
      onChanged()
    } catch (cause) {
      toast({ tone: 'warn', title: 'Could not update', description: errorMessage(cause, 'Try again.') })
    }
  }

  async function toggleAssign() {
    if (!ticket || !currentAdminId) return
    try {
      const result = await assignTicket(ticketId, ticket.assignedTo ? null : currentAdminId)
      toast({ tone: 'success', title: 'Updated', description: result.note })
      await load()
      onChanged()
    } catch (cause) {
      toast({ tone: 'warn', title: 'Could not update', description: errorMessage(cause, 'Try again.') })
    }
  }

  if (error) {
    return (
      <Card className="border-negative/30 bg-negative/[0.05]">
        <CardBody>
          <p className="text-sm font-medium text-negative">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={onBack}>
            Back to the queue
          </Button>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to the queue
      </Button>

      <Card>
        <CardHeader className="flex-col items-start gap-3 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <CardTitle>{ticket?.subject ?? 'Loading…'}</CardTitle>
            {ticket && (
              <p className="mt-1 text-xs text-muted">
                {ticket.userName} · {ticket.userEmail} · opened {formatDate(ticket.createdAt)} ·{' '}
                {ticket.category}
              </p>
            )}
          </div>

          {ticket && (
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <Badge tone={STATUS_TONES[ticket.status]} dot>
                {STATUS_LABELS[ticket.status]}
              </Badge>
              <div className="w-32">
                <Select
                  aria-label="Priority"
                  value={ticket.priority}
                  onChange={(event) => changePriority(event.target.value as TicketPriority)}
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'high', label: 'High' },
                  ]}
                />
              </div>
              <Button size="sm" variant="secondary" onClick={toggleAssign}>
                {ticket.assignedTo ? 'Unassign' : 'Assign to me'}
              </Button>
            </div>
          )}
        </CardHeader>

        <CardBody>
          {!messages ? (
            <SkeletonRows rows={4} />
          ) : (
            <ul className="space-y-3">
              {messages.map((message) => {
                const fromSupport = message.authorRole === 'admin'
                return (
                  <li
                    key={message.id}
                    className={
                      message.internal
                        ? 'rounded-xl border border-dashed border-warn/40 bg-warn/[0.05] p-4'
                        : fromSupport
                          ? 'rounded-xl border border-accent/25 bg-accent/[0.05] p-4'
                          : 'rounded-xl border border-line bg-base-800 p-4'
                    }
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-white">
                        {message.internal
                          ? 'Internal note'
                          : fromSupport
                            ? `Support${message.authorName ? ` · ${message.authorName}` : ''}`
                            : (message.authorName ?? 'Customer')}
                      </span>
                      {message.internal && (
                        <Badge tone="warn" className="gap-1">
                          <EyeOff className="h-3 w-3" aria-hidden="true" />
                          not visible to customer
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted">
                        {relativeTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                      {message.body}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ---------- Composer ---------- */}
      {ticket && ticket.status !== 'closed' && (
        <Card className={internal ? 'border-warn/40 bg-warn/[0.04]' : undefined}>
          <CardBody className="space-y-4">
            <Textarea
              label={internal ? 'Internal note' : 'Reply to customer'}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              placeholder={
                internal
                  ? 'Only other operators will see this.'
                  : 'Written to the customer. They are emailed that a reply is waiting.'
              }
            />

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={internal}
                onChange={(event) => setInternal(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--accent,#B8FF00)]"
              />
              <span className="text-sm leading-relaxed text-white/80">
                Internal note — not shown to the customer, no email sent, and the ticket stays in
                &quot;needs reply&quot;.
              </span>
            </label>

            {internal && (
              <p className="flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/[0.07] p-3 text-xs leading-relaxed text-white/80">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
                This will be saved as a private note. Untick the box above if you meant to answer
                the customer.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={send}
                loading={busy}
                disabled={body.trim().length < 10}
                variant={internal ? 'secondary' : 'primary'}
              >
                {internal ? (
                  <>
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                    Save private note
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Send reply
                  </>
                )}
              </Button>

              {ticket.status !== 'resolved' && (
                <Button variant="secondary" onClick={() => changeStatus('resolved')}>
                  Mark resolved
                </Button>
              )}
              <Button variant="ghost" onClick={() => changeStatus('closed')}>
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Close
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {ticket?.status === 'closed' && (
        <Card>
          <CardBody className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <div className="text-sm leading-relaxed text-white/75">
              <p>
                This ticket is closed and accepts no further messages. Reopen it to continue, so
                that &quot;closed, then said more&quot; stays visible in the record.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => changeStatus('awaiting_support')}
              >
                Reopen
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

export function SupportQueue({ currentAdminId }: { currentAdminId?: string }) {
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null)
  const [awaiting, setAwaiting] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('awaiting_support')
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await listSupportQueue(
        filter === 'all' ? undefined : { status: filter as TicketStatus },
      )
      setTickets(result.tickets)
      setAwaiting(result.awaitingSupport)
      setLoadError(null)
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Could not load the support queue.'))
      setTickets([])
    }
  }, [filter])

  useEffect(() => {
    setTickets(null)
    void load()
  }, [load])

  if (openId) {
    return (
      <Thread
        ticketId={openId}
        currentAdminId={currentAdminId}
        onBack={() => {
          setOpenId(null)
          void load()
        }}
        onChanged={load}
      />
    )
  }

  if (loadError) {
    return (
      <Card className="border-negative/30 bg-negative/[0.05]">
        <CardBody className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-negative">Could not load the support queue</p>
            <p className="mt-1 text-sm leading-relaxed text-white/75">{loadError}</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div>
          <CardTitle>Support</CardTitle>
          <p className="mt-1 text-xs text-muted">
            {tickets === null
              ? 'Loading…'
              : awaiting === 0
                ? 'Nothing waiting on a reply'
                : `${awaiting} ticket${awaiting === 1 ? '' : 's'} waiting on a reply, oldest first`}
          </p>
        </div>
        <div className="w-full sm:ml-auto sm:w-52">
          <Select
            aria-label="Filter tickets"
            options={FILTERS}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
      </CardHeader>

      <CardBody className="p-4 sm:p-0">
        {tickets === null ? (
          <div className="p-1 sm:p-5">
            <SkeletonRows rows={5} />
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy className="h-5 w-5" />}
            title={filter === 'awaiting_support' ? 'Nothing needs a reply' : 'No tickets'}
            description={
              filter === 'awaiting_support'
                ? 'Every customer has been answered.'
                : 'Nothing matches this filter.'
            }
            className="border-0"
          />
        ) : (
          <>
            <TableWrap className="hidden lg:block">
              <Table className="min-w-[940px]">
                <Thead>
                  <Tr>
                    <Th>Subject</Th>
                    <Th>Customer</Th>
                    <Th>Category</Th>
                    <Th>Priority</Th>
                    <Th>Last activity</Th>
                    <Th>Status</Th>
                    <Th numeric>Assigned</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {tickets.map((ticket) => (
                    <Tr key={ticket.id} interactive onClick={() => setOpenId(ticket.id)}>
                      <Td className="font-medium text-white">
                        {ticket.subject}
                        <span className="block text-xs text-muted">
                          {ticket.messageCount} message{ticket.messageCount === 1 ? '' : 's'}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-white/90">{ticket.userName}</span>
                        <span className="block text-xs text-muted">{ticket.userEmail}</span>
                      </Td>
                      <Td className="capitalize text-muted">{ticket.category}</Td>
                      <Td>
                        <Badge tone={PRIORITY_TONES[ticket.priority]}>{ticket.priority}</Badge>
                      </Td>
                      <Td className="text-muted">{relativeTime(ticket.lastMessageAt)}</Td>
                      <Td>
                        <Badge tone={STATUS_TONES[ticket.status]} dot>
                          {STATUS_LABELS[ticket.status]}
                        </Badge>
                      </Td>
                      <Td numeric className="text-muted">
                        {ticket.assignedToName ?? '—'}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>

            <MobileCardList className="lg:hidden">
              {tickets.map((ticket) => (
                <MobileCard key={ticket.id} onClick={() => setOpenId(ticket.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-white">
                      {ticket.subject}
                    </p>
                    <Badge tone={STATUS_TONES[ticket.status]} dot>
                      {STATUS_LABELS[ticket.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    {ticket.userName} · {ticket.userEmail}
                  </p>
                  <div className="mt-3 divide-y divide-line border-t border-line pt-1">
                    <MobileRow label="Category" value={ticket.category} />
                    <MobileRow label="Priority" value={ticket.priority} />
                    <MobileRow label="Last activity" value={relativeTime(ticket.lastMessageAt)} />
                  </div>
                </MobileCard>
              ))}
            </MobileCardList>
          </>
        )}
      </CardBody>
    </Card>
  )
}
