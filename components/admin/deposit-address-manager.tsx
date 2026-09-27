'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Plus, ShieldAlert, UserPlus, Wallet } from 'lucide-react'
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
import {
  assignAddress,
  createPlatformAddress,
  listAssignments,
  listPlatformAddresses,
  retirePlatformAddress,
  revokeAssignment,
  type Assignment,
  type AwaitingUser,
  type PlatformAddress,
} from '@/lib/api/deposit-addresses'
import { DEPOSIT_NETWORKS, networksForAsset, truncateAddress } from '@/lib/deposit-networks'
import { formatDate } from '@/lib/utils'

/**
 * Receiving-address administration.
 *
 * Two operations, deliberately separated:
 *
 *   1. Record a receiving address the business controls (the pool).
 *   2. Decide which user is shown which of those addresses.
 *
 * Keeping them apart is what makes the second reviewable. Entering an address
 * and assigning it in one motion means every assignment is also an
 * un-reviewed address entry, and the address is the part that loses money when
 * it is wrong.
 */

const ASSET_OPTIONS = [
  { value: 'btc', label: 'BTC — Bitcoin' },
  { value: 'eth', label: 'ETH — Ethereum' },
  { value: 'usdt', label: 'USDT — Tether' },
  { value: 'sol', label: 'SOL — Solana' },
  { value: 'bnb', label: 'BNB — BNB' },
  { value: 'xrp', label: 'XRP — XRP' },
]

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

/* ------------------------------------------------------------------ */
/* Add address                                                         */
/* ------------------------------------------------------------------ */

function AddAddressDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [assetId, setAssetId] = useState('usdt')
  const [network, setNetwork] = useState('tron')
  const [address, setAddress] = useState('')
  const [confirmAddress, setConfirmAddress] = useState('')
  const [addressTag, setAddressTag] = useState('')
  const [label, setLabel] = useState('')
  const [custodian, setCustodian] = useState('bybit')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableNetworks = useMemo(() => networksForAsset(assetId), [assetId])
  const selectedNetwork = useMemo(
    () => availableNetworks.find((entry) => entry.id === network),
    [availableNetworks, network],
  )

  // Keep the network valid for the asset — USDT on Tron is fine, BTC on Tron
  // is a way to destroy someone's deposit.
  useEffect(() => {
    if (!availableNetworks.some((entry) => entry.id === network)) {
      setNetwork(availableNetworks[0]?.id ?? '')
    }
  }, [availableNetworks, network])

  const shapeLooksWrong =
    address.length > 0 && selectedNetwork ? !selectedNetwork.pattern.test(address) : false
  const mismatch = confirmAddress.length > 0 && confirmAddress !== address

  function reset() {
    setAddress('')
    setConfirmAddress('')
    setAddressTag('')
    setLabel('')
    setNotes('')
    setError(null)
  }

  async function submit() {
    setBusy(true)
    setError(null)

    try {
      await createPlatformAddress({
        assetId,
        network,
        address: address.trim(),
        confirmAddress: confirmAddress.trim(),
        addressTag: addressTag.trim() || undefined,
        label: label.trim(),
        custodian: custodian.trim(),
        notes: notes.trim() || undefined,
      })

      toast({
        tone: 'success',
        title: 'Address recorded',
        description: 'It can now be assigned to users. Nothing is shown to anyone until you do.',
      })
      reset()
      onCreated()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'Could not save that address.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a receiving address"
      description="An address the business controls, at an exchange or custodian."
      size="lg"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-white/80">
            Paste this from the source account, never from a message or a document. Everything
            sent to it by every user you assign it to arrives here, and a transfer to a wrong
            address cannot be reversed by anyone.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Asset"
            options={ASSET_OPTIONS}
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
          />
          <Select
            label="Network"
            options={availableNetworks.map((entry) => ({
              value: entry.id,
              label: entry.label,
            }))}
            value={network}
            onChange={(event) => setNetwork(event.target.value)}
            hint={
              availableNetworks.length === 0
                ? 'This asset has no supported deposit network.'
                : undefined
            }
          />
        </div>

        <Input
          label="Receiving address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder={selectedNetwork?.id === 'tron' ? 'T…' : '0x…'}
          error={shapeLooksWrong ? `That does not look like a ${selectedNetwork?.label} address.` : undefined}
          hint="Checksum-verified on save. An address that fails is rejected, not warned about."
        />

        <Input
          label="Re-enter the address"
          value={confirmAddress}
          onChange={(event) => setConfirmAddress(event.target.value)}
          error={mismatch ? 'The two do not match.' : undefined}
          hint="Paste it a second time. This catches a truncated paste and a swapped clipboard."
        />

        {selectedNetwork && (
          <Input
            label={`${selectedNetwork.tagLabel ?? 'Memo / tag'}${selectedNetwork.requiresTag ? '' : ' (optional)'}`}
            value={addressTag}
            onChange={(event) => setAddressTag(event.target.value)}
            hint={
              selectedNetwork.requiresTag
                ? `${selectedNetwork.label} requires this. Give each user their own tag on the same address and deposits stay attributable.`
                : 'Only if the destination account issued one. A wrong tag misroutes the deposit.'
            }
          />
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Bybit main — USDT TRC-20"
            hint="How you will recognise it in this list."
          />
          <Input
            label="Held at"
            value={custodian}
            onChange={(event) => setCustodian(event.target.value)}
            placeholder="bybit"
            hint="Which account this address belongs to."
          />
        </div>

        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder="Sub-account, who has access, reconciliation owner…"
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
            disabled={
              !address.trim() ||
              confirmAddress !== address ||
              label.trim().length < 3 ||
              !network
            }
            className="sm:flex-1"
          >
            Save address
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
/* Assign                                                              */
/* ------------------------------------------------------------------ */

function AssignDialog({
  open,
  onClose,
  addresses,
  presetUserId,
  onAssigned,
}: {
  open: boolean
  onClose: () => void
  addresses: PlatformAddress[]
  presetUserId?: string | null
  onAssigned: () => void
}) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<AdminUserSearchResult[]>([])
  const [userId, setUserId] = useState(presetUserId ?? '')
  const [addressId, setAddressId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setUserId(presetUserId ?? '')
  }, [open, presetUserId])

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

  const assignable = addresses.filter((entry) => entry.status === 'active')
  const chosen = assignable.find((entry) => entry.id === addressId)

  async function submit() {
    setBusy(true)
    setError(null)

    try {
      await assignAddress({ userId, platformAddressId: addressId })
      toast({
        tone: 'success',
        title: 'Address assigned',
        description: 'It is now what that user sees on their deposit screen.',
      })
      onAssigned()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'Could not assign that address.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign an address to a user"
      description="The user's deposit screen will show this address immediately."
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
          onChange={(event) => setUserId(event.target.value)}
          options={[
            { value: '', label: users.length ? 'Choose a user…' : 'No matches' },
            ...users.map((user) => ({
              value: user.id,
              label: `${user.name} · ${user.email}${user.verification === 'verified' ? '' : ` · ${user.verification}`}`,
            })),
          ]}
        />

        <Select
          label="Receiving address"
          value={addressId}
          onChange={(event) => setAddressId(event.target.value)}
          options={[
            { value: '', label: assignable.length ? 'Choose an address…' : 'None recorded yet' },
            ...assignable.map((entry) => ({
              value: entry.id,
              label: `${entry.label} · ${entry.assetSymbol} · ${truncateAddress(entry.address, 6)}`,
            })),
          ]}
        />

        {chosen && (
          <div className="rounded-xl border border-line bg-base-800 p-4">
            <p className="text-xs uppercase tracking-wider text-muted">Will be shown as</p>
            <p className="num mt-2 break-all text-sm text-white">{chosen.address}</p>
            {chosen.addressTag && (
              <p className="num mt-2 break-all text-sm text-warn">tag: {chosen.addressTag}</p>
            )}
            <p className="mt-2 text-xs text-muted">
              {chosen.assetSymbol} over {chosen.network} · held at {chosen.custodian}
            </p>
          </div>
        )}

        {chosen && chosen.assignedUsers > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-white/80">
              This address is already shown to {chosen.assignedUsers} other{' '}
              {chosen.assignedUsers === 1 ? 'user' : 'users'}
              {chosen.addressTag ? '' : ' and carries no memo'}.{' '}
              {chosen.addressTag
                ? 'Make sure each user has a distinct tag, or deposits cannot be told apart.'
                : 'An incoming transfer will not identify which of them sent it — crediting becomes manual reconciliation.'}
            </p>
          </div>
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
            disabled={!userId || !addressId}
            className="sm:flex-1"
          >
            Assign
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
/* Manager                                                             */
/* ------------------------------------------------------------------ */

export function DepositAddressManager() {
  const { toast } = useToast()
  const [addresses, setAddresses] = useState<PlatformAddress[] | null>(null)
  const [awaiting, setAwaiting] = useState<AwaitingUser[]>([])
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [presetUserId, setPresetUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [pool, assigned] = await Promise.all([listPlatformAddresses(), listAssignments()])
      setAddresses(pool.addresses)
      setAwaiting(pool.usersAwaitingAddress)
      setAssignments(assigned.assignments)
      setLoadError(null)
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Could not load receiving addresses.'))
      setAddresses([])
      setAssignments([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function retire(entry: PlatformAddress) {
    const warning =
      entry.assignedUsers > 0
        ? `${entry.label} is shown to ${entry.assignedUsers} user${entry.assignedUsers === 1 ? '' : 's'}. Retiring it removes it from their deposit screens — they will not be able to deposit until another is assigned. Continue?`
        : `Retire ${entry.label}? It cannot be reinstated; record a new address instead.`

    if (!window.confirm(warning)) return

    try {
      const result = await retirePlatformAddress(entry.id)
      toast({ tone: 'success', title: 'Address retired', description: result.message })
      void load()
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Could not retire that address',
        description: errorMessage(cause, 'Try again.'),
      })
    }
  }

  async function unassign(entry: Assignment) {
    if (
      !window.confirm(
        `Stop showing this address to ${entry.userName}? They will have nowhere to deposit ${entry.assetSymbol} until another is assigned.`,
      )
    ) {
      return
    }

    try {
      const result = await revokeAssignment(entry.id)
      toast({ tone: 'success', title: 'Assignment removed', description: result.message })
      void load()
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Could not remove that assignment',
        description: errorMessage(cause, 'Try again.'),
      })
    }
  }

  function openAssign(userId?: string) {
    setPresetUserId(userId ?? null)
    setAssignOpen(true)
  }

  if (loadError) {
    return (
      <Card className="border-negative/30 bg-negative/[0.05]">
        <CardBody className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-negative">Could not load addresses</p>
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
            <CardTitle>Receiving addresses</CardTitle>
            <p className="mt-1 text-xs text-muted">
              Addresses the business controls. Nothing here is visible to a user until it is
              assigned.
            </p>
          </div>
          <Button size="sm" className="sm:ml-auto" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add address
          </Button>
        </CardHeader>

        <CardBody className="p-4 sm:p-0">
          {!addresses ? (
            <div className="p-1 sm:p-5">
              <SkeletonRows rows={4} />
            </div>
          ) : addresses.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-5 w-5" />}
              title="No receiving addresses"
              description="Record the address your deposits should arrive at. Until one exists and is assigned, no user can deposit."
              className="border-0"
              action={<Button onClick={() => setAddOpen(true)}>Add address</Button>}
            />
          ) : (
            <>
              <TableWrap className="hidden sm:block">
                <Table className="min-w-[900px]">
                  <Thead>
                    <Tr>
                      <Th>Label</Th>
                      <Th>Asset</Th>
                      <Th>Network</Th>
                      <Th>Address</Th>
                      <Th>Held at</Th>
                      <Th numeric>Users</Th>
                      <Th>Status</Th>
                      <Th numeric>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {addresses.map((entry) => (
                      <Tr key={entry.id}>
                        <Td className="text-white">{entry.label}</Td>
                        <Td>{entry.assetSymbol}</Td>
                        <Td className="text-muted">{entry.network}</Td>
                        <Td>
                          <span className="num text-muted" title={entry.address}>
                            {truncateAddress(entry.address)}
                          </span>
                          {entry.addressTag && (
                            <span className="num ml-2 text-warn">tag {entry.addressTag}</span>
                          )}
                        </Td>
                        <Td className="text-muted">{entry.custodian}</Td>
                        <Td numeric>
                          {entry.assignedUsers > 1 && !entry.addressTag ? (
                            <span
                              className="text-warn"
                              title="Shared with no memo — deposits cannot be attributed from the chain."
                            >
                              {entry.assignedUsers}
                            </span>
                          ) : (
                            entry.assignedUsers
                          )}
                        </Td>
                        <Td>
                          <Badge tone={entry.status === 'active' ? 'success' : 'neutral'}>
                            {entry.status}
                          </Badge>
                        </Td>
                        <Td numeric>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={entry.status !== 'active'}
                            onClick={() => retire(entry)}
                          >
                            Retire
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>

              <MobileCardList className="sm:hidden">
                {addresses.map((entry) => (
                  <MobileCard key={entry.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{entry.label}</p>
                      <Badge tone={entry.status === 'active' ? 'success' : 'neutral'}>
                        {entry.status}
                      </Badge>
                    </div>
                    <div className="mt-3 divide-y divide-line border-t border-line pt-1">
                      <MobileRow label="Asset" value={`${entry.assetSymbol} · ${entry.network}`} />
                      <MobileRow
                        label="Address"
                        value={<span className="num">{truncateAddress(entry.address, 6)}</span>}
                      />
                      {entry.addressTag && (
                        <MobileRow
                          label="Tag"
                          value={<span className="num">{entry.addressTag}</span>}
                        />
                      )}
                      <MobileRow label="Users" value={String(entry.assignedUsers)} />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-3"
                      disabled={entry.status !== 'active'}
                      onClick={() => retire(entry)}
                    >
                      Retire
                    </Button>
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Who sees which address</CardTitle>
            <p className="mt-1 text-xs text-muted">
              Each row is what one user is shown on their deposit screen right now.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="sm:ml-auto"
            onClick={() => openAssign()}
            disabled={!addresses?.some((entry) => entry.status === 'active')}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Assign address
          </Button>
        </CardHeader>

        <CardBody className="p-4 sm:p-0">
          {!assignments ? (
            <div className="p-1 sm:p-5">
              <SkeletonRows rows={4} />
            </div>
          ) : assignments.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="h-5 w-5" />}
              title="No addresses assigned"
              description="No user can deposit yet. Assign a recorded address to someone to change that."
              className="border-0"
            />
          ) : (
            <>
              <TableWrap className="hidden sm:block">
                <Table className="min-w-[860px]">
                  <Thead>
                    <Tr>
                      <Th>User</Th>
                      <Th>Asset</Th>
                      <Th>Network</Th>
                      <Th>Address shown</Th>
                      <Th>Assigned</Th>
                      <Th numeric>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {assignments.map((entry) => (
                      <Tr key={entry.id}>
                        <Td>
                          <span className="text-white">{entry.userName}</span>
                          <span className="block text-xs text-muted">{entry.userEmail}</span>
                        </Td>
                        <Td>{entry.assetSymbol}</Td>
                        <Td className="text-muted">{entry.network}</Td>
                        <Td>
                          <span className="num text-muted" title={entry.address}>
                            {truncateAddress(entry.address)}
                          </span>
                          {entry.addressTag && (
                            <span className="num ml-2 text-warn">tag {entry.addressTag}</span>
                          )}
                        </Td>
                        <Td className="text-muted">{formatDate(entry.assignedAt)}</Td>
                        <Td numeric>
                          <Button size="sm" variant="ghost" onClick={() => unassign(entry)}>
                            Remove
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>

              <MobileCardList className="sm:hidden">
                {assignments.map((entry) => (
                  <MobileCard key={entry.id}>
                    <p className="text-sm font-medium text-white">{entry.userName}</p>
                    <p className="text-xs text-muted">{entry.userEmail}</p>
                    <div className="mt-3 divide-y divide-line border-t border-line pt-1">
                      <MobileRow label="Asset" value={`${entry.assetSymbol} · ${entry.network}`} />
                      <MobileRow
                        label="Address"
                        value={<span className="num">{truncateAddress(entry.address, 6)}</span>}
                      />
                      <MobileRow label="Assigned" value={formatDate(entry.assignedAt)} />
                    </div>
                    <Button size="sm" variant="ghost" className="mt-3" onClick={() => unassign(entry)}>
                      Remove
                    </Button>
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardBody>
      </Card>

      {awaiting.length > 0 && (
        <Card className="border-warn/25">
          <CardHeader>
            <div>
              <CardTitle>Users with no address</CardTitle>
              <p className="mt-1 text-xs text-muted">
                These accounts have nowhere to send funds. Each one is a customer who reached the
                deposit screen and found nothing on it.
              </p>
            </div>
          </CardHeader>
          <CardBody className="p-4 sm:p-0">
            <TableWrap>
              <Table className="min-w-[620px]">
                <Thead>
                  <Tr>
                    <Th>User</Th>
                    <Th>Verification</Th>
                    <Th>Joined</Th>
                    <Th numeric>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {awaiting.map((user) => (
                    <Tr key={user.id}>
                      <Td>
                        <span className="text-white">{user.name}</span>
                        <span className="block text-xs text-muted">{user.email}</span>
                      </Td>
                      <Td>
                        <Badge tone={user.kycStatus === 'verified' ? 'success' : 'neutral'}>
                          {user.kycStatus}
                        </Badge>
                      </Td>
                      <Td className="text-muted">{formatDate(user.joined)}</Td>
                      <Td numeric>
                        <Button size="sm" variant="ghost" onClick={() => openAssign(user.id)}>
                          Assign
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      )}

      <AddAddressDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
      <AssignDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        addresses={addresses ?? []}
        presetUserId={presetUserId}
        onAssigned={load}
      />
    </div>
  )
}

/** Networks the form offers, exported so the page can describe coverage. */
export const SUPPORTED_NETWORK_COUNT = DEPOSIT_NETWORKS.length
