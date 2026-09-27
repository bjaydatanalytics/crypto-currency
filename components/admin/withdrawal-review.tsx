'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowUpFromLine, Check, Copy, Send, ShieldAlert, X } from 'lucide-react'
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
import {
  approveWithdrawal,
  listWithdrawals,
  rejectWithdrawal,
  settleWithdrawal,
  type WithdrawalRow,
  type WithdrawalStatus,
} from '@/lib/api/treasury'
import { truncateAddress } from '@/lib/deposit-networks'
import { formatDate } from '@/lib/utils'

/**
 * Withdrawal review.
 *
 * Three states, and the gaps between them are the point:
 *
 *   pending_approval  funds locked, nothing sent, destination not yet checked
 *   approved          cleared to pay — an operator now sends it by hand
 *   completed         payment went out; the hash is recorded and the ledger settles
 *
 * "Approve" does not move money, and the UI says so every time, because an
 * operator who believes approving pays will not go and make the payment. The
 * customer's balance stays locked either way, so nothing is double-spendable
 * while the request sits in between.
 */

const STATUS_TONES: Record<string, 'success' | 'warn' | 'danger' | 'accent' | 'neutral'> = {
  pending_approval: 'warn',
  approved: 'accent',
  broadcasting: 'accent',
  completed: 'success',
  rejected: 'danger',
  failed: 'danger',
  requested: 'neutral',
}

const STATUS_FILTERS = [
  { value: 'pending_approval', label: 'Awaiting approval' },
  { value: 'approved', label: 'Approved — to pay' },
  { value: 'all', label: 'All withdrawals' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
]

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

/** The destination, rendered in full with a copy button. Never truncated. */
function DestinationBlock({ withdrawal }: { withdrawal: WithdrawalRow }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(withdrawal.destinationAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        tone: 'warn',
        title: 'Could not copy',
        description: 'Select the address and copy it manually.',
      })
    }
  }

  return (
    <div className="rounded-xl border border-line bg-base-800 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-muted">
          Send to · {withdrawal.networkLabel}
        </p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="num break-all text-sm leading-relaxed text-white">
        {withdrawal.destinationAddress}
      </p>
      {withdrawal.destinationTag && (
        <p className="num mt-2 break-all rounded-lg border border-warn/30 bg-warn/[0.06] p-2.5 text-sm text-white">
          tag: {withdrawal.destinationTag}
        </p>
      )}
    </div>
  )
}

function ActionDialog({
  withdrawal,
  mode,
  onClose,
  onDone,
}: {
  withdrawal: WithdrawalRow | null
  mode: 'approve' | 'settle' | 'reject' | null
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [txHash, setTxHash] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTxHash('')
    setReason('')
    setError(null)
  }, [withdrawal, mode])

  async function submit() {
    if (!withdrawal || !mode) return
    setBusy(true)
    setError(null)

    try {
      const result =
        mode === 'approve'
          ? await approveWithdrawal(withdrawal.id)
          : mode === 'settle'
            ? await settleWithdrawal(withdrawal.id, txHash.trim())
            : await rejectWithdrawal(withdrawal.id, reason.trim())

      toast({
        tone: 'success',
        title:
          mode === 'approve'
            ? 'Approved for payment'
            : mode === 'settle'
              ? 'Withdrawal settled'
              : 'Withdrawal rejected',
        description: result.message,
      })
      onDone()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'That action did not complete.'))
    } finally {
      setBusy(false)
    }
  }

  const titles = {
    approve: 'Approve for payment',
    settle: 'Record the payment',
    reject: 'Reject this withdrawal',
  }

  const descriptions = {
    approve: 'Clears it to be paid. No funds move now.',
    settle: 'Confirms the payment went out. This settles the ledger.',
    reject: 'Returns the locked funds to the customer.',
  }

  return (
    <Modal
      open={Boolean(withdrawal && mode)}
      onClose={onClose}
      title={mode ? titles[mode] : ''}
      description={mode ? descriptions[mode] : undefined}
      size="md"
    >
      {withdrawal && mode && (
        <div className="space-y-5">
          <div className="rounded-xl border border-line p-4">
            <p className="num text-lg font-semibold text-white">
              {withdrawal.amount} {withdrawal.assetSymbol}
            </p>
            <p className="mt-1 text-sm text-muted">
              {withdrawal.userName} · {withdrawal.userEmail}
            </p>
          </div>

          {mode !== 'reject' && <DestinationBlock withdrawal={withdrawal} />}

          {mode === 'approve' && (
            <div className="flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/[0.06] p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-white/80">
                <span className="font-medium text-accent">This sends nothing.</span> Approving
                records that you checked the request and the destination. You then make the
                payment yourself and come back to record the transaction hash. Until you do, the
                customer&apos;s funds stay locked and unspent.
              </p>
            </div>
          )}

          {mode === 'settle' && (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-white/80">
                  Only record this <span className="font-medium text-warn">after</span> the
                  payment has actually been sent. Settling first shows the customer a completed
                  withdrawal for money still sitting in the business account.
                </p>
              </div>
              <Input
                label="Transaction hash"
                value={txHash}
                onChange={(event) => setTxHash(event.target.value)}
                placeholder="0x… or the chain's own format"
                hint="From the send confirmation. The customer sees this and can verify it independently."
              />
            </>
          )}

          {mode === 'reject' && (
            <Textarea
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Failed review, address not recognised, customer asked to cancel…"
              hint="Write it for the customer — they may well be shown this."
            />
          )}

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
              variant={mode === 'reject' ? 'danger' : 'primary'}
              disabled={
                (mode === 'settle' && txHash.trim().length < 16) ||
                (mode === 'reject' && reason.trim().length < 4)
              }
              className="sm:flex-1"
            >
              {mode === 'approve' && 'Approve — nothing sent yet'}
              {mode === 'settle' && 'Mark as paid'}
              {mode === 'reject' && 'Reject and return funds'}
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

export function WithdrawalReview() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('pending_approval')
  const [target, setTarget] = useState<WithdrawalRow | null>(null)
  const [mode, setMode] = useState<'approve' | 'settle' | 'reject' | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await listWithdrawals(
        filter === 'all'
          ? undefined
          : { status: filter as 'pending_approval' | 'approved' | 'completed' | 'rejected' },
      )
      setWithdrawals(response.withdrawals)
      setLoadError(null)
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Could not load withdrawals.'))
      setWithdrawals([])
    }
  }, [filter])

  useEffect(() => {
    setWithdrawals(null)
    void load()
  }, [load])

  function act(row: WithdrawalRow, next: 'approve' | 'settle' | 'reject') {
    setTarget(row)
    setMode(next)
  }

  if (loadError) {
    return (
      <Card className="border-negative/30 bg-negative/[0.05]">
        <CardBody className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-negative">Could not load withdrawals</p>
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
            <CardTitle>Withdrawals</CardTitle>
            <p className="mt-1 text-xs text-muted">
              Approving clears a payment. Sending it is a separate, manual step.
            </p>
          </div>
          <div className="w-full sm:ml-auto sm:w-52">
            <Select
              aria-label="Filter withdrawals"
              options={STATUS_FILTERS}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
        </CardHeader>

        <CardBody className="p-4 sm:p-0">
          {!withdrawals ? (
            <div className="p-1 sm:p-5">
              <SkeletonRows rows={5} />
            </div>
          ) : withdrawals.length === 0 ? (
            <EmptyState
              icon={<ArrowUpFromLine className="h-5 w-5" />}
              title="Nothing here"
              description="No withdrawals match this filter."
              className="border-0"
            />
          ) : (
            <>
              <TableWrap className="hidden lg:block">
                <Table className="min-w-[980px]">
                  <Thead>
                    <Tr>
                      <Th>Requested</Th>
                      <Th>Customer</Th>
                      <Th numeric>Amount</Th>
                      <Th>Destination</Th>
                      <Th>Status</Th>
                      <Th numeric>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {withdrawals.map((row) => (
                      <Tr key={row.id}>
                        <Td className="text-muted">{formatDate(row.requestedAt)}</Td>
                        <Td>
                          <span className="text-white">{row.userName}</span>
                          <span className="block text-xs text-muted">{row.userEmail}</span>
                        </Td>
                        <Td numeric className="num text-white">
                          {row.amount} {row.assetSymbol}
                        </Td>
                        <Td>
                          <span className="num text-muted" title={row.destinationAddress}>
                            {truncateAddress(row.destinationAddress)}
                          </span>
                          <span className="block text-xs text-muted">{row.networkLabel}</span>
                        </Td>
                        <Td>
                          <Badge tone={STATUS_TONES[row.status] ?? 'neutral'}>
                            {row.status.replace('_', ' ')}
                          </Badge>
                        </Td>
                        <Td numeric>
                          <div className="flex justify-end gap-1">
                            {row.status === 'pending_approval' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => act(row, 'approve')}
                                >
                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                  Approve
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => act(row, 'reject')}>
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                              </>
                            )}
                            {(row.status === 'approved' || row.status === 'broadcasting') && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => act(row, 'settle')}>
                                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                                  Mark paid
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => act(row, 'reject')}>
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                              </>
                            )}
                            {row.status === 'completed' && row.txHash && (
                              <span className="num text-xs text-muted" title={row.txHash}>
                                {truncateAddress(row.txHash, 6)}
                              </span>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>

              <MobileCardList className="lg:hidden">
                {withdrawals.map((row) => (
                  <MobileCard key={row.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="num text-sm font-medium text-white">
                        {row.amount} {row.assetSymbol}
                      </p>
                      <Badge tone={STATUS_TONES[row.status] ?? 'neutral'}>
                        {row.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {row.userName} · {row.userEmail}
                    </p>
                    <div className="mt-3 divide-y divide-line border-t border-line pt-1">
                      <MobileRow
                        label="Destination"
                        value={
                          <span className="num">{truncateAddress(row.destinationAddress, 5)}</span>
                        }
                      />
                      <MobileRow label="Network" value={row.networkLabel} />
                      <MobileRow label="Requested" value={formatDate(row.requestedAt)} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.status === 'pending_approval' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => act(row, 'approve')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => act(row, 'reject')}>
                            Reject
                          </Button>
                        </>
                      )}
                      {(row.status === 'approved' || row.status === 'broadcasting') && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => act(row, 'settle')}>
                            Mark paid
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => act(row, 'reject')}>
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardBody>
      </Card>

      <ActionDialog
        withdrawal={target}
        mode={mode}
        onClose={() => {
          setTarget(null)
          setMode(null)
        }}
        onDone={load}
      />
    </div>
  )
}
