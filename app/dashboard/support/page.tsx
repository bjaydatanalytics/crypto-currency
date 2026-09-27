'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, LifeBuoy, Lock, Plus, Send } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { SkeletonRows } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import {
  fetchMyTicket,
  listMyTickets,
  openTicket,
  replyToTicket,
  type Ticket,
  type TicketCategory,
  type TicketMessage,
  type TicketStatus,
} from '@/lib/api/support'
import { formatDate, relativeTime } from '@/lib/utils'

/**
 * The customer's support tickets.
 *
 * Shows the customer's own view of the thread: internal operator notes are
 * filtered out server-side, in the query, so nothing on this page can render
 * one even by mistake.
 */

const STATUS_LABELS: Record<TicketStatus, string> = {
  awaiting_support: 'With support',
  awaiting_customer: 'Awaiting your reply',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_TONES: Record<TicketStatus, 'warn' | 'accent' | 'success' | 'neutral'> = {
  awaiting_support: 'accent',
  awaiting_customer: 'warn',
  resolved: 'success',
  closed: 'neutral',
}

const CATEGORIES: Array<{ value: TicketCategory; label: string }> = [
  { value: 'deposit', label: 'A deposit' },
  { value: 'withdrawal', label: 'A withdrawal' },
  { value: 'investment', label: 'An investment' },
  { value: 'verification', label: 'Identity verification' },
  { value: 'account', label: 'My account or sign-in' },
  { value: 'other', label: 'Something else' },
]

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

/* ------------------------------------------------------------------ */

function NewTicketDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { toast } = useToast()
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>('deposit')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSubject('')
    setBody('')
    setError(null)
  }, [open])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const result = await openTicket({ subject: subject.trim(), category, body: body.trim() })
      toast({ tone: 'success', title: 'Ticket opened', description: result.message })
      onCreated(result.ticket.id)
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'Could not open that ticket.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Contact support"
      description="You will be emailed when someone replies."
      size="md"
    >
      <div className="space-y-5">
        <Select
          label="What is this about?"
          value={category}
          onChange={(event) => setCategory(event.target.value as TicketCategory)}
          options={CATEGORIES}
        />

        <Input
          label="Subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Deposit not credited"
        />

        <Textarea
          label="What is happening?"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
          placeholder="Include dates, amounts and transaction hashes where you have them — it saves a round trip."
          hint="Never include your password, two-factor codes or recovery codes. Support will never ask for them."
        />

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-negative/30 bg-negative/[0.07] p-3.5 text-xs leading-relaxed text-negative"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button
            onClick={submit}
            loading={busy}
            disabled={subject.trim().length < 4 || body.trim().length < 10}
            className="sm:flex-1"
          >
            Open ticket
          </Button>
          <Button variant="secondary" onClick={onClose} className="sm:flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

function Thread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { toast } = useToast()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[] | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await fetchMyTicket(ticketId)
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
      await replyToTicket(ticketId, body.trim())
      setBody('')
      await load()
    } catch (cause) {
      toast({ tone: 'warn', title: 'Not sent', description: errorMessage(cause, 'Try again.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        All tickets
      </Button>

      {error ? (
        <Card className="border-negative/30 bg-negative/[0.05]">
          <CardBody>
            <p className="text-sm font-medium text-negative">{error}</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <CardTitle>{ticket?.subject ?? 'Loading…'}</CardTitle>
                {ticket && (
                  <p className="mt-1 text-xs text-muted">
                    Opened {formatDate(ticket.createdAt)} · {ticket.category}
                  </p>
                )}
              </div>
              {ticket && (
                <Badge tone={STATUS_TONES[ticket.status]} dot className="sm:ml-auto">
                  {STATUS_LABELS[ticket.status]}
                </Badge>
              )}
            </CardHeader>

            <CardBody>
              {!messages ? (
                <SkeletonRows rows={3} />
              ) : (
                <ul className="space-y-3">
                  {messages.map((message) => {
                    const fromSupport = message.authorRole === 'admin'
                    return (
                      <li
                        key={message.id}
                        className={
                          fromSupport
                            ? 'rounded-xl border border-accent/25 bg-accent/[0.05] p-4'
                            : 'rounded-xl border border-line bg-base-800 p-4'
                        }
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs font-medium text-white">
                            {fromSupport ? 'Support' : 'You'}
                          </span>
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

          {ticket && ticket.status !== 'closed' ? (
            <Card>
              <CardBody className="space-y-4">
                <Textarea
                  label="Reply"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={4}
                  placeholder="Add anything else that would help."
                />
                <Button onClick={send} loading={busy} disabled={body.trim().length < 10}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Send reply
                </Button>
              </CardBody>
            </Card>
          ) : (
            ticket && (
              <Card>
                <CardBody className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-white/75">
                    This ticket is closed. Open a new one if you need anything else — mention this
                    subject and support can find the earlier conversation.
                  </p>
                </CardBody>
              </Card>
            )
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await listMyTickets()
      setTickets(result.tickets)
      setLoadError(null)
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Could not load your tickets.'))
      setTickets([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <DashboardHeader title="Support" />

      <div className="space-y-6 p-4 sm:p-6">
        {openId ? (
          <Thread
            ticketId={openId}
            onBack={() => {
              setOpenId(null)
              void load()
            }}
          />
        ) : (
          <>
            <Card>
              <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div>
                  <CardTitle>Your tickets</CardTitle>
                  <p className="mt-1 text-xs text-muted">
                    We email you when there is a reply. The reply itself is read here, signed in.
                  </p>
                </div>
                <Button size="sm" className="sm:ml-auto" onClick={() => setNewOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New ticket
                </Button>
              </CardHeader>

              <CardBody>
                {loadError ? (
                  <p className="rounded-lg border border-negative/30 bg-negative/[0.07] p-3.5 text-sm text-negative">
                    {loadError}
                  </p>
                ) : tickets === null ? (
                  <SkeletonRows rows={3} />
                ) : tickets.length === 0 ? (
                  <EmptyState
                    icon={<LifeBuoy className="h-5 w-5" />}
                    title="No tickets yet"
                    description="Open one if something needs looking at — a deposit that has not appeared, a withdrawal, or anything about your account."
                    className="border-0"
                    action={<Button onClick={() => setNewOpen(true)}>New ticket</Button>}
                  />
                ) : (
                  <ul className="space-y-3">
                    {tickets.map((ticket) => (
                      <li key={ticket.id}>
                        <button
                          type="button"
                          onClick={() => setOpenId(ticket.id)}
                          className="w-full rounded-xl border border-line bg-base-800 p-4 text-left transition-colors hover:border-accent/30 hover:bg-white/[0.03]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 truncate text-sm font-medium text-white">
                              {ticket.subject}
                            </p>
                            <Badge tone={STATUS_TONES[ticket.status]} dot>
                              {STATUS_LABELS[ticket.status]}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {ticket.messageCount} message{ticket.messageCount === 1 ? '' : 's'} ·
                            last activity {relativeTime(ticket.lastMessageAt)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card className="border-accent/25 bg-accent/[0.04]">
              <CardBody>
                <p className="text-sm leading-relaxed text-white/75">
                  Support will never ask for your password, your two-factor codes or your recovery
                  codes, and will never ask you to move funds to a different address. Any message
                  that does is not from us.
                </p>
              </CardBody>
            </Card>
          </>
        )}
      </div>

      <NewTicketDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          void load()
          setOpenId(id)
        }}
      />
    </>
  )
}
