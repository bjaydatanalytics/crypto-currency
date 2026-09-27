'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Clock, Plus, Receipt, ShieldAlert, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
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
import { searchAdminUsers, type AdminUserSearchResult } from '@/lib/api/admin'
import { listAssignments, type Assignment } from '@/lib/api/deposit-addresses'
import {
  creditDeposit,
  listDeposits,
  recordDeposit,
  rejectDeposit,
  setDepositConfirmations,
  type DepositRow,
  type DepositStatus,
} from '@/lib/api/treasury'
import { truncateAddress } from '@/lib/deposit-networks'
import { formatDate } from '@/lib/utils'

/**
 * Deposit review.
 *
 * The flow this screen exists to make safe:
 *
 *   funds arrive at the business's account
 *     → an operator records what they see  (no balance changes)
 *     → confirmations reach the threshold  (enforced server-side)
 *     → an operator credits it             (the balance changes, once, forever)
 *
 * Recording and crediting are two deliberate actions by a person, because
 * crediting is irreversible in every way that matters: the customer can
 * withdraw against it immediately. The middle step is where a misread amount or
 * a wrong customer gets caught, so the UI never collapses it into one click.
 */

const STATUS_TONES: Record<DepositStatus, 'success' | 'warn' | 'danger' | 'neutral'> = {
  credited: 'success',
  confirming: 'warn',
  detected: 'warn',
  rejected: 'danger',
  failed: 'danger',
}

const STATUS_FILTERS = [
  { value: 'pending', label: 'Awaiting action' },
  { value: 'all', label: 'All deposits' },
  { value: 'credited', label: 'Credited' },
  { value: 'rejected', label: 'Rejected' },
]

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

/* ------------------------------------------------------------------ */
/* Record a deposit                                                    */
/* ------------------------------------------------------------------ */

function RecordDepositDialog({
  open,
  onClose,
  onRecorded,
}: {
  open: boolean
  onClose: () => void
  onRecorded: () => void
}) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<AdminUserSearchResult[]>([])
  const [userId, setUserId] = useState('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assetId, setAssetId] = useState('')
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [confirmations, setConfirmations] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true

    const timer = setTimeout(() => {
      searchAdminUsers(search)
        .then((results) => {
          if (active) setUsers(results)
        })
        .catch(() => {
          if (active) setUsers([])
        })
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [open, search])

  // A deposit can only be recorded against an address the user was actually
  // given, so the asset list is their assignments — not the whole catalogue.
  useEffect(() => {
    if (!userId) {
      setAssignments([])
      setAssetId('')
      return
    }

    let active = true
    listAssignments({ userId })
      .then((response) => {
        if (!active) return
        setAssignments(response.assignments)
        setAssetId((current) => current || (response.assignments[0]?.assetId ?? ''))
      })
      .catch(() => {
        if (active) setAssignments([])
      })

    return () => {
      active = false
    }
  }, [userId])

  const destination = useMemo(
    () => assignments.find((entry) => entry.assetId === assetId) ?? null,
    [assignments, assetId],
  )

  function reset() {
    setAmount('')
    setTxHash('')
    setConfirmations('')
    setNotes('')
    setError(null)
  }

  async function submit() {
    setBusy(true)
    setError(null)

    try {
      const result = await recordDeposit({
        userId,
        assetId,
        network: destination?.network,
        amount: amount.trim(),
        txHash: txHash.trim(),
        confirmations: Number(confirmations),
        notes: notes.trim() || undefined,
      })

      toast({
        tone: 'success',
        title: 'Deposit recorded',
        description: result.message,
      })
      reset()
      onRecorded()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'Could not record that deposit.'))
    } finally {
      setBusy(false)
    }
  }

  const ready =
    userId && assetId && amount.trim() && txHash.trim().length >= 16 && confirmations !== ''

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an arrived deposit"
      description="Captures what you see. Nothing is credited until you credit it."
      size="lg"
    >
      <div className="space-y-5">
        <Input
          label="Find a user"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name or email"
        />

        <Select
          label="User"
          value={userId}
          onChange={(event) => {
            setUserId(event.target.value)
            setAssetId('')
          }}
          options={[
            { value: '', label: users.length ? 'Choose a user…' : 'No matches' },
            ...users.map((user) => ({ value: user.id, label: `${user.name} · ${user.email}` })),
          ]}
        />

        {userId && assignments.length === 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-white/80">
              That user has no deposit address assigned, so there is no destination this deposit
              could have arrived at. Assign one first — if funds really did arrive, find out which
              address they went to before recording anything.
            </p>
          </div>
        )}

        {assignments.length > 0 && (
          <Select
            label="Asset"
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
            options={assignments.map((entry) => ({
              value: entry.assetId,
              label: `${entry.assetSymbol} · ${entry.network}`,
            }))}
          />
        )}

        {destination && (
          <div className="rounded-xl border border-line bg-base-800 p-4">
            <p className="text-xs uppercase tracking-wider text-muted">Arrived at</p>
            <p className="num mt-2 break-all text-sm text-white">{destination.address}</p>
            {destination.addressTag && (
              <p className="num mt-1 break-all text-sm text-warn">
                tag: {destination.addressTag}
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              Check the transfer landed here before recording it.
            </p>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label={`Amount${destination ? ` (${destination.assetSymbol})` : ''}`}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            hint="Exactly as received, after any network fee."
          />
          <Input
            label="Confirmations"
            value={confirmations}
            onChange={(event) => setConfirmations(event.target.value)}
            placeholder="0"
            inputMode="numeric"
            hint="What the explorer shows now. The threshold is enforced on credit."
          />
        </div>

        <Input
          label="Transaction hash"
          value={txHash}
          onChange={(event) => setTxHash(event.target.value)}
          placeholder="0x… or the chain's own format"
          hint="Required. It is the customer's only way to verify this independently, and it stops the same transfer being recorded twice."
        />

        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder="Where you saw it, sub-account, anything a reviewer would need."
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
          <Button onClick={submit} loading={busy} disabled={!ready} className="sm:flex-1">
            Record deposit
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
/* Credit confirmation                                                 */
/* ------------------------------------------------------------------ */

function CreditDialog({
  deposit,
  onClose,
  onDone,
}: {
  deposit: DepositRow | null
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!deposit) return
    setBusy(true)
    setError(null)

    try {
      const result = await creditDeposit(deposit.id)
      toast({ tone: 'success', title: 'Deposit credited', description: result.message })
      onDone()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'Could not credit that deposit.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(deposit)}
      onClose={onClose}
      title="Credit this deposit"
      description="This changes a real balance and cannot be undone."
      size="md"
    >
      {deposit && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-white/80">
              The customer can withdraw against this the moment it posts. Reversing it later means
              posting an opposing ledger adjustment, which does not help if the funds are already
              gone. Check the amount against the transaction before continuing.
            </p>
          </div>

          <dl className="divide-y divide-line rounded-xl border border-line">
            {[
              ['Customer', `${deposit.userName} · ${deposit.userEmail}`],
              ['Amount', `${deposit.amount} ${deposit.assetSymbol}`],
              ['Network', deposit.networkLabel],
              ['Arrived at', deposit.address],
              ['Transaction', deposit.txHash ?? '—'],
              [
                'Confirmations',
                `${deposit.confirmations} of ${deposit.requiredConfirmations} required`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 p-3.5 sm:flex-row sm:gap-4">
                <dt className="shrink-0 text-xs uppercase tracking-wider text-muted sm:w-32">
                  {label}
                </dt>
                <dd className="num min-w-0 break-all text-sm text-white">{value}</dd>
              </div>
            ))}
          </dl>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-negative/30 bg-negative/[0.07] p-3.5 text-xs leading-relaxed text-negative"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Button onClick={submit} loading={busy} className="sm:flex-1">
              <Check className="h-4 w-4" aria-hidden="true" />
              Credit {deposit.amount} {deposit.assetSymbol}
            </Button>
            <Button variant="secondary" onClick={onClose} className="sm:flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Reject                                                              */
/* ------------------------------------------------------------------ */

function RejectDialog({
  deposit,
  onClose,
  onDone,
}: {
  deposit: DepositRow | null
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!deposit) return
    setBusy(true)
    setError(null)

    try {
      const result = await rejectDeposit(deposit.id, reason.trim())
      toast({ tone: 'success', title: 'Deposit rejected', description: result.message })
      setReason('')
      onDone()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'Could not reject that deposit.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(deposit)}
      onClose={onClose}
      title="Reject this deposit"
      description="No balance changes. The record and your reason are kept."
      size="md"
    >
      <div className="space-y-5">
        <Textarea
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          placeholder="Recorded in error, amount wrong, transfer never confirmed…"
          hint="Write it for the customer. They may well be shown this."
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
            variant="danger"
            onClick={submit}
            loading={busy}
            disabled={reason.trim().length < 4}
            className="sm:flex-1"
          >
            Reject deposit
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
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function DepositReview() {
  const { toast } = useToast()
  const [deposits, setDeposits] = useState<DepositRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('pending')
  const [recordOpen, setRecordOpen] = useState(false)
  const [crediting, setCrediting] = useState<DepositRow | null>(null)
  const [rejecting, setRejecting] = useState<DepositRow | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await listDeposits(
        filter === 'pending' || filter === 'all'
          ? undefined
          : { status: filter as DepositStatus },
      )
      const rows =
        filter === 'pending'
          ? response.deposits.filter(
              (row) => row.status === 'detected' || row.status === 'confirming',
            )
          : response.deposits
      setDeposits(rows)
      setLoadError(null)
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Could not load deposits.'))
      setDeposits([])
    }
  }, [filter])

  useEffect(() => {
    setDeposits(null)
    void load()
  }, [load])

  async function bumpConfirmations(deposit: DepositRow) {
    const entered = window.prompt(
      `Confirmations now showing for this transfer? It needs ${deposit.requiredConfirmations}.`,
      String(deposit.confirmations),
    )
    if (entered === null) return

    const value = Number(entered)
    if (!Number.isInteger(value) || value < 0) {
      toast({ tone: 'warn', title: 'Not a whole number', description: 'Enter a count like 12.' })
      return
    }

    try {
      const result = await setDepositConfirmations(deposit.id, value)
      toast({ tone: 'success', title: 'Updated', description: result.message })
      void load()
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Could not update',
        description: errorMessage(cause, 'Try again.'),
      })
    }
  }

  if (loadError) {
    return (
      <Card className="border-negative/30 bg-negative/[0.05]">
        <CardBody className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-negative">Could not load deposits</p>
            <p className="mt-1 text-sm leading-relaxed text-white/75">{loadError}</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Deposits</CardTitle>
            <p className="mt-1 text-xs text-muted">
              Recording captures what arrived. Crediting changes a balance and is permanent.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
            <div className="sm:w-44">
              <Select
                aria-label="Filter deposits"
                options={STATUS_FILTERS}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => setRecordOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Record deposit
            </Button>
          </div>
        </CardHeader>

        <CardBody className="p-4 sm:p-0">
          {!deposits ? (
            <div className="p-1 sm:p-5">
              <SkeletonRows rows={5} />
            </div>
          ) : deposits.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title={filter === 'pending' ? 'Nothing awaiting action' : 'No deposits'}
              description={
                filter === 'pending'
                  ? 'Every recorded deposit has been credited or rejected.'
                  : 'Nothing matches this filter.'
              }
              className="border-0"
            />
          ) : (
            <>
              <TableWrap className="hidden lg:block">
                <Table className="min-w-[1000px]">
                  <Thead>
                    <Tr>
                      <Th>Recorded</Th>
                      <Th>Customer</Th>
                      <Th>Asset</Th>
                      <Th numeric>Amount</Th>
                      <Th>Transaction</Th>
                      <Th numeric>Confirmations</Th>
                      <Th>Status</Th>
                      <Th numeric>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {deposits.map((row) => (
                      <Tr key={row.id}>
                        <Td className="text-muted">{formatDate(row.detectedAt)}</Td>
                        <Td>
                          <span className="text-white">{row.userName}</span>
                          <span className="block text-xs text-muted">{row.userEmail}</span>
                        </Td>
                        <Td>
                          {row.assetSymbol}
                          <span className="block text-xs text-muted">{row.networkLabel}</span>
                        </Td>
                        <Td numeric className="num text-white">
                          {row.amount}
                        </Td>
                        <Td>
                          <span className="num text-muted" title={row.txHash ?? undefined}>
                            {row.txHash ? truncateAddress(row.txHash, 6) : '—'}
                          </span>
                        </Td>
                        <Td numeric>
                          <span
                            className={
                              row.confirmations >= row.requiredConfirmations
                                ? 'num text-positive'
                                : 'num text-warn'
                            }
                          >
                            {row.confirmations}/{row.requiredConfirmations}
                          </span>
                        </Td>
                        <Td>
                          <Badge tone={STATUS_TONES[row.status]}>{row.status}</Badge>
                        </Td>
                        <Td numeric>
                          <div className="flex justify-end gap-1">
                            {(row.status === 'detected' || row.status === 'confirming') && (
                              <>
                                {!row.creditable && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => bumpConfirmations(row)}
                                  >
                                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                    Update
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!row.creditable}
                                  title={
                                    row.creditable
                                      ? undefined
                                      : `Needs ${row.requiredConfirmations} confirmations`
                                  }
                                  onClick={() => setCrediting(row)}
                                >
                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                  Credit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRejecting(row)}
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                              </>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>

              <MobileCardList className="lg:hidden">
                {deposits.map((row) => (
                  <MobileCard key={row.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="num text-sm font-medium text-white">
                        {row.amount} {row.assetSymbol}
                      </p>
                      <Badge tone={STATUS_TONES[row.status]}>{row.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {row.userName} · {row.userEmail}
                    </p>
                    <div className="mt-3 divide-y divide-line border-t border-line pt-1">
                      <MobileRow label="Network" value={row.networkLabel} />
                      <MobileRow
                        label="Transaction"
                        value={
                          <span className="num">
                            {row.txHash ? truncateAddress(row.txHash, 5) : '—'}
                          </span>
                        }
                      />
                      <MobileRow
                        label="Confirmations"
                        value={
                          <span className="num">
                            {row.confirmations}/{row.requiredConfirmations}
                          </span>
                        }
                      />
                      <MobileRow label="Recorded" value={formatDate(row.detectedAt)} />
                    </div>
                    {(row.status === 'detected' || row.status === 'confirming') && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {!row.creditable && (
                          <Button size="sm" variant="ghost" onClick={() => bumpConfirmations(row)}>
                            Update confirmations
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!row.creditable}
                          onClick={() => setCrediting(row)}
                        >
                          Credit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejecting(row)}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardBody>
      </Card>

      <RecordDepositDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        onRecorded={load}
      />
      <CreditDialog deposit={crediting} onClose={() => setCrediting(null)} onDone={load} />
      <RejectDialog deposit={rejecting} onClose={() => setRejecting(null)} onDone={load} />
    </div>
  )
}
