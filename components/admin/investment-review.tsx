'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Plus, ShieldAlert, TrendingUp, Wallet, X } from 'lucide-react'
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
  cancelInvestment,
  fetchTreasury,
  fundTreasury,
  listAllInvestments,
  matureInvestment,
  type AdminInvestmentContract,
  type InvestmentState,
  type TreasuryPosition,
} from '@/lib/api/investments'
import { formatDate } from '@/lib/utils'

/**
 * Investment contracts and treasury solvency.
 *
 * The treasury panel sits above the contract list on purpose. A fixed-return
 * product's only real question is whether the promises are funded, and an
 * operator should not have to go looking for the answer. A shortfall is shown
 * as a shortfall — not a warning about the future, but a statement that money
 * already promised is not held, with a maturity date already fixed.
 */

const STATE_TONES: Record<InvestmentState, 'accent' | 'success' | 'neutral'> = {
  active: 'accent',
  matured: 'success',
  cancelled: 'neutral',
}

const FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All contracts' },
  { value: 'matured', label: 'Matured' },
  { value: 'cancelled', label: 'Cancelled' },
]

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

function trimZeros(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}

/* ------------------------------------------------------------------ */
/* Treasury                                                            */
/* ------------------------------------------------------------------ */

function FundDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [assetId, setAssetId] = useState('usdt')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [key] = useState(() => `fund-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const result = await fundTreasury({
        assetId,
        amount: amount.trim(),
        note: note.trim() || undefined,
        idempotencyKey: key,
      })
      toast({ tone: 'success', title: 'Treasury funded', description: result.message })
      onDone()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'Could not record that funding.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fund the treasury"
      description="Records money the business has put in to cover promised returns."
      size="md"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-white/80">
            Only record this <span className="font-medium text-warn">after</span> the funds have
            actually been moved into the business account. Recording a funding that did not happen
            inflates the treasury on paper and lets a maturity pay out against nothing — which
            means paying that customer from another customer&apos;s deposit.
          </p>
        </div>

        <Select
          label="Asset"
          value={assetId}
          onChange={(event) => setAssetId(event.target.value)}
          options={[
            { value: 'usdt', label: 'USDT' },
            { value: 'btc', label: 'BTC' },
            { value: 'eth', label: 'ETH' },
            { value: 'sol', label: 'SOL' },
            { value: 'bnb', label: 'BNB' },
            { value: 'xrp', label: 'XRP' },
          ]}
        />

        <Input
          label="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          hint="In asset units, exactly as transferred."
        />

        <Textarea
          label="Note (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Source of funds, reference, anything a reviewer would need."
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
            disabled={Number(amount) <= 0}
            className="sm:flex-1"
          >
            Record funding
          </Button>
          <Button variant="secondary" onClick={onClose} className="sm:flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function TreasuryPanel({
  positions,
  solvent,
  onFund,
}: {
  positions: TreasuryPosition[] | null
  solvent: boolean
  onFund: () => void
}) {
  const shortfalls = positions?.filter((position) => !position.funded) ?? []

  return (
    <Card
      className={
        shortfalls.length > 0 ? 'border-negative/40 bg-negative/[0.05]' : undefined
      }
    >
      <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div>
          <CardTitle>Treasury</CardTitle>
          <p className="mt-1 text-xs text-muted">
            Funds held to pay promised returns
          </p>
        </div>
        <div className="flex items-center gap-3 sm:ml-auto">
          {positions !== null && (
            <Badge tone={solvent ? 'success' : 'danger'} dot>
              {solvent ? 'Promises funded' : 'Shortfall'}
            </Badge>
          )}
          <Button size="sm" variant="secondary" onClick={onFund}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Fund
          </Button>
        </div>
      </CardHeader>

      <CardBody>
        {positions === null ? (
          <SkeletonRows rows={2} />
        ) : positions.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            Nothing held and nothing owed. Fund the treasury before any contract matures —
            a maturity with no funds behind it is refused, not paid.
          </p>
        ) : (
          <>
            {shortfalls.length > 0 && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-negative/40 bg-negative/[0.08] p-4">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-negative"
                  aria-hidden="true"
                />
                <div className="text-sm leading-relaxed text-white/85">
                  <p className="font-medium text-negative">
                    You have promised more than the treasury holds
                  </p>
                  <p className="mt-1">
                    This is not a projection. The shortfall exists now, and it will surface as a
                    refused maturity on a date already fixed by those contracts. Fund the
                    treasury, or cancel contracts and return the principal, before then.
                  </p>
                </div>
              </div>
            )}

            <TableWrap>
              <Table className="min-w-[520px]">
                <Thead>
                  <Tr>
                    <Th>Asset</Th>
                    <Th numeric>Held</Th>
                    <Th numeric>Owed on active contracts</Th>
                    <Th numeric>Surplus</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {positions.map((position) => (
                    <Tr key={position.assetId}>
                      <Td className="text-white">{position.symbol}</Td>
                      <Td numeric className="num text-white">
                        {trimZeros(position.balance)}
                      </Td>
                      <Td numeric className="num text-muted">
                        {trimZeros(position.committed)}
                      </Td>
                      <Td numeric>
                        <span
                          className={
                            position.funded ? 'num text-positive' : 'num text-negative'
                          }
                        >
                          {trimZeros(position.surplus)}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function InvestmentReview() {
  const { toast } = useToast()
  const [contracts, setContracts] = useState<AdminInvestmentContract[] | null>(null)
  const [positions, setPositions] = useState<TreasuryPosition[] | null>(null)
  const [solvent, setSolvent] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('active')
  const [fundOpen, setFundOpen] = useState(false)
  const [cancelling, setCancelling] = useState<AdminInvestmentContract | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [list, treasury] = await Promise.all([
        listAllInvestments(filter === 'all' ? undefined : (filter as InvestmentState)),
        fetchTreasury(),
      ])
      setContracts(list.investments)
      setPositions(treasury.positions)
      setSolvent(treasury.solvent)
      setLoadError(null)
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Could not load investments.'))
      setContracts([])
    }
  }, [filter])

  useEffect(() => {
    setContracts(null)
    void load()
  }, [load])

  async function mature(contract: AdminInvestmentContract) {
    setBusy(true)
    try {
      const result = await matureInvestment(contract.id)
      toast({ tone: 'success', title: 'Contract matured', description: result.message })
      void load()
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Could not pay that out',
        description: errorMessage(cause, 'Try again.'),
      })
    } finally {
      setBusy(false)
    }
  }

  async function submitCancel() {
    if (!cancelling) return
    setBusy(true)
    try {
      const result = await cancelInvestment(cancelling.id, reason.trim())
      toast({ tone: 'success', title: 'Contract cancelled', description: result.message })
      setCancelling(null)
      setReason('')
      void load()
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Could not cancel',
        description: errorMessage(cause, 'Try again.'),
      })
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <Card className="border-negative/30 bg-negative/[0.05]">
        <CardBody className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-negative">Could not load investments</p>
            <p className="mt-1 text-sm leading-relaxed text-white/75">{loadError}</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <TreasuryPanel positions={positions} solvent={solvent} onFund={() => setFundOpen(true)} />

      <Card>
        <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Contracts</CardTitle>
            <p className="mt-1 text-xs text-muted">
              Maturity pays principal plus the return, debited from the treasury
            </p>
          </div>
          <div className="w-full sm:ml-auto sm:w-44">
            <Select
              aria-label="Filter contracts"
              options={FILTERS}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
        </CardHeader>

        <CardBody className="p-4 sm:p-0">
          {contracts === null ? (
            <div className="p-1 sm:p-5">
              <SkeletonRows rows={4} />
            </div>
          ) : contracts.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-5 w-5" />}
              title="No contracts"
              description="Nothing matches this filter."
              className="border-0"
            />
          ) : (
            <>
              <TableWrap className="hidden lg:block">
                <Table className="min-w-[1000px]">
                  <Thead>
                    <Tr>
                      <Th>Customer</Th>
                      <Th>Plan</Th>
                      <Th numeric>Principal</Th>
                      <Th numeric>Return owed</Th>
                      <Th>Matures</Th>
                      <Th>Status</Th>
                      <Th numeric>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {contracts.map((contract) => {
                      const due = contract.status === 'active' && contract.daysRemaining === 0
                      return (
                        <Tr key={contract.id}>
                          <Td>
                            <span className="text-white">{contract.userName}</span>
                            <span className="block text-xs text-muted">{contract.userEmail}</span>
                          </Td>
                          <Td>
                            {contract.planName}
                            <span className="num block text-xs text-muted">
                              {contract.fixedRatePercent}%{' '}
                              {contract.rateBasis === 'annual' ? 'a year' : 'per term'}
                            </span>
                          </Td>
                          <Td numeric className="num text-white">
                            {trimZeros(contract.principal)} {contract.assetSymbol}
                          </Td>
                          <Td numeric className="num text-accent">
                            {trimZeros(contract.expectedReturn)}
                          </Td>
                          <Td className="text-muted">
                            {formatDate(contract.maturesAt)}
                            {due && (
                              <span className="block text-xs text-warn">due now</span>
                            )}
                          </Td>
                          <Td>
                            <Badge tone={STATE_TONES[contract.status]}>{contract.status}</Badge>
                          </Td>
                          <Td numeric>
                            {contract.status === 'active' && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!due || busy}
                                  title={
                                    due
                                      ? 'Pay principal plus the return'
                                      : 'Not due until the term ends'
                                  }
                                  onClick={() => mature(contract)}
                                >
                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                  Pay out
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setCancelling(contract)}
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                              </div>
                            )}
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </TableWrap>

              <MobileCardList className="lg:hidden">
                {contracts.map((contract) => {
                  const due = contract.status === 'active' && contract.daysRemaining === 0
                  return (
                    <MobileCard key={contract.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="num text-sm font-medium text-white">
                          {trimZeros(contract.principal)} {contract.assetSymbol}
                        </p>
                        <Badge tone={STATE_TONES[contract.status]}>{contract.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {contract.userName} · {contract.userEmail}
                      </p>
                      <div className="mt-3 divide-y divide-line border-t border-line pt-1">
                        <MobileRow label="Plan" value={contract.planName} />
                        <MobileRow
                          label="Return owed"
                          value={
                            <span className="num">{trimZeros(contract.expectedReturn)}</span>
                          }
                        />
                        <MobileRow label="Matures" value={formatDate(contract.maturesAt)} />
                      </div>
                      {contract.status === 'active' && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!due || busy}
                            onClick={() => mature(contract)}
                          >
                            Pay out
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCancelling(contract)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </MobileCard>
                  )
                })}
              </MobileCardList>
            </>
          )}
        </CardBody>
      </Card>

      <FundDialog open={fundOpen} onClose={() => setFundOpen(false)} onDone={load} />

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel this contract"
        description="The principal is returned in full and no return is paid."
        size="md"
      >
        {cancelling && (
          <div className="space-y-5">
            <div className="rounded-xl border border-line p-4">
              <p className="num text-sm font-medium text-white">
                {trimZeros(cancelling.principal)} {cancelling.assetSymbol}
              </p>
              <p className="mt-1 text-sm text-muted">
                {cancelling.userName} · {cancelling.userEmail}
              </p>
            </div>

            <p className="rounded-xl border border-warn/30 bg-warn/[0.06] p-4 text-sm leading-relaxed text-white/80">
              There are no early-exit terms, so the whole principal goes back — keeping any part
              of it would be a penalty the customer never agreed to.
            </p>

            <Textarea
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Opened in error, customer request, contract unwound…"
              hint="Write it for the customer — they are shown this."
            />

            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <Button
                variant="danger"
                onClick={submitCancel}
                loading={busy}
                disabled={reason.trim().length < 4}
                className="sm:flex-1"
              >
                Cancel and return principal
              </Button>
              <Button
                variant="secondary"
                onClick={() => setCancelling(null)}
                className="sm:flex-1"
              >
                Keep it open
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
