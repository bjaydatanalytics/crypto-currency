'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ban, Check, RotateCcw, Search, ShieldAlert, ShieldCheck, Users, X } from 'lucide-react'
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
  decideVerification,
  fetchUsers,
  setAccountStatus,
  type AccountStatus,
  type AdminUserRecord,
  type VerificationDecision,
} from '@/lib/api/admin'
import { formatDate } from '@/lib/utils'

/**
 * Users and identity verification.
 *
 * Approving verification is a compliance decision, not a UI toggle. Three
 * things this screen refuses to blur:
 *
 * 1. **Whether anything was actually submitted.** A customer who never filed
 *    documents looks different from one who did. Approving the former is
 *    sometimes legitimate and sometimes a serious mistake, and an operator
 *    cannot tell which without being shown.
 * 2. **Why a refusal happened.** Rejecting requires a written reason, because
 *    the person refused is entitled to know.
 * 3. **Whether the customer can actually deposit.** KYC alone is not enough —
 *    email verification gates it too. Approving KYC and still seeing "cannot
 *    deposit" is confusing unless the screen explains it.
 */

const VERIFICATION_TONES: Record<string, 'success' | 'warn' | 'danger' | 'neutral'> = {
  verified: 'success',
  pending: 'warn',
  rejected: 'danger',
  unverified: 'neutral',
}

const VERIFICATION_FILTERS = [
  { value: 'queue', label: 'Awaiting review' },
  { value: 'all', label: 'All users' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'unverified', label: 'Not submitted' },
]

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

/* ------------------------------------------------------------------ */
/* Decision dialog                                                     */
/* ------------------------------------------------------------------ */

function DecisionDialog({
  user,
  decision,
  onClose,
  onDone,
}: {
  user: AdminUserRecord | null
  decision: 'verified' | 'rejected' | null
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setReason('')
    setError(null)
  }, [user, decision])

  async function submit() {
    if (!user || !decision) return
    setBusy(true)
    setError(null)

    try {
      await decideVerification(user.id, decision, decision === 'rejected' ? reason.trim() : undefined)
      toast({
        tone: 'success',
        title: decision === 'verified' ? 'Verification approved' : 'Verification rejected',
        description:
          decision === 'verified'
            ? user.emailVerified
              ? `${user.name} can now deposit.`
              : `${user.name} is approved, but still cannot deposit until they confirm their email address.`
            : `${user.name} has been refused, with your reason on record.`,
      })
      onDone()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'That decision could not be recorded.'))
    } finally {
      setBusy(false)
    }
  }

  const neverSubmitted = user !== null && user.kycSubmittedAt === null

  return (
    <Modal
      open={Boolean(user && decision)}
      onClose={onClose}
      title={decision === 'verified' ? 'Approve verification' : 'Reject verification'}
      description={
        decision === 'verified'
          ? 'This lets the customer deposit funds.'
          : 'The customer is refused and told why.'
      }
      size="md"
    >
      {user && decision && (
        <div className="space-y-5">
          <div className="rounded-xl border border-line p-4">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-sm text-muted">{user.email}</p>
          </div>

          {decision === 'verified' && (
            <div
              className={
                neverSubmitted
                  ? 'flex items-start gap-3 rounded-xl border border-negative/30 bg-negative/[0.07] p-4'
                  : 'flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4'
              }
            >
              <ShieldAlert
                className={
                  neverSubmitted
                    ? 'mt-0.5 h-4 w-4 shrink-0 text-negative'
                    : 'mt-0.5 h-4 w-4 shrink-0 text-warn'
                }
                aria-hidden="true"
              />
              <div className="text-sm leading-relaxed text-white/80">
                {neverSubmitted ? (
                  <>
                    <p className="font-medium text-negative">
                      This customer has submitted no identity documents.
                    </p>
                    <p className="mt-1">
                      There is no KYC record for this account. Approving anyway lets them deposit
                      without any identity check having taken place — which is the situation
                      anti-money-laundering rules exist to prevent. Only do this if you have
                      verified them through some other channel you can evidence later.
                    </p>
                  </>
                ) : (
                  <p>
                    Check the provider&apos;s result before approving. Your name and the time are
                    recorded against this decision — &quot;the system approved it&quot; is not an
                    answer a regulator accepts.
                  </p>
                )}
              </div>
            </div>
          )}

          {user.kycSubmittedAt && (
            <dl className="divide-y divide-line rounded-xl border border-line">
              {[
                ['Submitted', formatDate(user.kycSubmittedAt)],
                ['Provider', user.kycProvider ?? '—'],
                ['Reference', user.kycProviderReference ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1 p-3.5 sm:flex-row sm:gap-4">
                  <dt className="shrink-0 text-xs uppercase tracking-wider text-muted sm:w-28">
                    {label}
                  </dt>
                  <dd className="num min-w-0 break-all text-sm text-white">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {decision === 'rejected' && (
            <Textarea
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Document unreadable, name mismatch, provider returned a fail…"
              hint="Required. Write it for the customer — they are entitled to know why."
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
              variant={decision === 'rejected' ? 'danger' : 'primary'}
              disabled={decision === 'rejected' && reason.trim().length < 4}
              className="sm:flex-1"
            >
              {decision === 'verified' ? 'Approve verification' : 'Reject verification'}
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
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function UserReview({ currentAdminId }: { currentAdminId?: string }) {
  const { toast } = useToast()
  const [users, setUsers] = useState<AdminUserRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('queue')
  const [target, setTarget] = useState<AdminUserRecord | null>(null)
  const [decision, setDecision] = useState<'verified' | 'rejected' | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetchUsers({
        search,
        kycStatus:
          filter === 'queue' || filter === 'all'
            ? undefined
            : (filter as VerificationDecision),
        pageSize: 50,
      })

      // "Awaiting review" is anything not yet decided — both those who
      // submitted and those who never did, since both block a deposit.
      const rows =
        filter === 'queue'
          ? response.items.filter(
              (user) => user.verification === 'pending' || user.verification === 'unverified',
            )
          : response.items

      setUsers(rows)
      setLoadError(null)
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Could not load users.'))
      setUsers([])
    }
  }, [search, filter])

  useEffect(() => {
    setUsers(null)
    const timer = setTimeout(() => void load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  function decide(user: AdminUserRecord, next: 'verified' | 'rejected') {
    setTarget(user)
    setDecision(next)
  }

  async function toggleStatus(user: AdminUserRecord) {
    const next: AccountStatus = user.status === 'active' ? 'suspended' : 'active'

    if (
      next === 'suspended' &&
      !window.confirm(
        `Suspend ${user.name}? Every one of their sessions is revoked immediately and they cannot sign in.`,
      )
    ) {
      return
    }

    try {
      await setAccountStatus(user.id, next)
      toast({
        tone: 'success',
        title: next === 'suspended' ? 'Account suspended' : 'Account reinstated',
        description:
          next === 'suspended'
            ? `${user.name} has been signed out everywhere.`
            : `${user.name} can sign in again.`,
      })
      void load()
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Could not change that',
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
            <p className="text-sm font-medium text-negative">Could not load users</p>
            <p className="mt-1 text-sm leading-relaxed text-white/75">{loadError}</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  const queueCount = users?.filter(
    (user) => user.verification === 'pending' || user.verification === 'unverified',
  ).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-col items-start gap-4 lg:flex-row lg:items-center">
          <div>
            <CardTitle>Users and verification</CardTitle>
            <p className="mt-1 text-xs text-muted">
              {users === null
                ? 'Loading…'
                : filter === 'queue'
                  ? `${queueCount ?? 0} awaiting a decision — none of them can deposit yet`
                  : `${users.length} shown`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 lg:ml-auto lg:w-auto lg:flex-row">
            <div className="lg:w-48">
              <Select
                aria-label="Filter by verification"
                options={VERIFICATION_FILTERS}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>
            <div className="lg:w-64">
              <Input
                type="search"
                placeholder="Search name or email"
                aria-label="Search users"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                icon={<Search className="h-4 w-4" />}
              />
            </div>
          </div>
        </CardHeader>

        <CardBody className="p-4 sm:p-0">
          {users === null ? (
            <div className="p-1 sm:p-5">
              <SkeletonRows rows={6} />
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title={filter === 'queue' ? 'Nothing awaiting review' : 'No users found'}
              description={
                filter === 'queue'
                  ? 'Every account has had a verification decision.'
                  : 'Nothing matches the current filter.'
              }
              className="border-0"
            />
          ) : (
            <>
              <TableWrap className="hidden lg:block">
                <Table className="min-w-[940px]">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Email</Th>
                      <Th>Verification</Th>
                      <Th>Submitted</Th>
                      <Th>Can deposit</Th>
                      <Th>Status</Th>
                      <Th numeric>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {users.map((user) => {
                      const self = user.id === currentAdminId
                      return (
                        <Tr key={user.id}>
                          <Td className="font-medium text-white">
                            {user.name}
                            {user.role === 'admin' && (
                              <Badge tone="accent" className="ml-2">
                                admin
                              </Badge>
                            )}
                          </Td>
                          <Td className="text-muted">
                            {user.email}
                            {!user.emailVerified && (
                              <span className="block text-xs text-warn">email unconfirmed</span>
                            )}
                          </Td>
                          <Td>
                            <Badge tone={VERIFICATION_TONES[user.verification] ?? 'neutral'}>
                              {user.verification}
                            </Badge>
                          </Td>
                          <Td className="text-muted">
                            {user.kycSubmittedAt ? (
                              formatDate(user.kycSubmittedAt)
                            ) : (
                              <span className="text-xs italic">never submitted</span>
                            )}
                          </Td>
                          <Td>
                            {user.canDeposit ? (
                              <span className="inline-flex items-center gap-1.5 text-sm text-positive">
                                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                yes
                              </span>
                            ) : (
                              <span className="text-sm text-muted">no</span>
                            )}
                          </Td>
                          <Td>
                            <Badge tone={user.status === 'active' ? 'success' : 'danger'} dot>
                              {user.status}
                            </Badge>
                          </Td>
                          <Td numeric>
                            <div className="flex justify-end gap-1">
                              {self ? (
                                <span className="text-xs italic text-muted">your account</span>
                              ) : (
                                <>
                                  {user.verification !== 'verified' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => decide(user, 'verified')}
                                    >
                                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                      Approve
                                    </Button>
                                  )}
                                  {user.verification !== 'rejected' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => decide(user, 'rejected')}
                                    >
                                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                                      Reject
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleStatus(user)}
                                    title={
                                      user.status === 'active'
                                        ? 'Suspend and revoke every session'
                                        : 'Reinstate this account'
                                    }
                                  >
                                    {user.status === 'active' ? (
                                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                                    ) : (
                                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </TableWrap>

              <MobileCardList className="lg:hidden">
                {users.map((user) => {
                  const self = user.id === currentAdminId
                  return (
                    <MobileCard key={user.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{user.name}</p>
                          <p className="truncate text-xs text-muted">{user.email}</p>
                        </div>
                        <Badge tone={VERIFICATION_TONES[user.verification] ?? 'neutral'}>
                          {user.verification}
                        </Badge>
                      </div>
                      <div className="mt-3 divide-y divide-line border-t border-line pt-1">
                        <MobileRow
                          label="Submitted"
                          value={
                            user.kycSubmittedAt ? formatDate(user.kycSubmittedAt) : 'never submitted'
                          }
                        />
                        <MobileRow label="Can deposit" value={user.canDeposit ? 'yes' : 'no'} />
                        <MobileRow
                          label="Email"
                          value={user.emailVerified ? 'confirmed' : 'unconfirmed'}
                        />
                        <MobileRow
                          label="Status"
                          value={
                            <Badge tone={user.status === 'active' ? 'success' : 'danger'} dot>
                              {user.status}
                            </Badge>
                          }
                        />
                      </div>
                      {!self && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {user.verification !== 'verified' && (
                            <Button size="sm" variant="ghost" onClick={() => decide(user, 'verified')}>
                              Approve
                            </Button>
                          )}
                          {user.verification !== 'rejected' && (
                            <Button size="sm" variant="ghost" onClick={() => decide(user, 'rejected')}>
                              Reject
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => toggleStatus(user)}>
                            {user.status === 'active' ? 'Suspend' : 'Reinstate'}
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

      <DecisionDialog
        user={target}
        decision={decision}
        onClose={() => {
          setTarget(null)
          setDecision(null)
        }}
        onDone={load}
      />
    </div>
  )
}
