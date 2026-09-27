'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import {
  AlertTriangle,
  Check,
  Fingerprint,
  KeyRound,
  Laptop,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordInput, Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
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
import { changePassword, fetchAccount, type AccountSummary } from '@/lib/api/auth'
import {
  confirmTwoFactor,
  disableTwoFactor,
  listLoginHistory,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  startTwoFactor,
  type ActiveSession,
  type LoginEvent,
  type TwoFactorSetup,
} from '@/lib/api/security'
import { formatDate, relativeTime } from '@/lib/utils'

/**
 * Account security.
 *
 * Every control here acts on the signed-in account for real. This page used to
 * render `demoUser`, `demoSessions` and `demoLoginHistory` and report "this
 * build has no account system" — telling a signed-in person their security
 * settings were imaginary while showing them somebody else's sessions.
 *
 * That failure mode matters more here than anywhere else in the product: the
 * whole purpose of a security page is to let someone check whether their
 * account is safe, and a fabricated answer to that question is worse than no
 * answer at all.
 */

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

/** Turns a raw user-agent into something a person can recognise. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device'
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : /Firefox\//.test(userAgent)
            ? 'Firefox'
            : 'Browser'
  const platform = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(userAgent)
      ? 'iOS'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown OS'
  return `${browser} on ${platform}`
}

/* ------------------------------------------------------------------ */
/* Two-factor enrolment                                                */
/* ------------------------------------------------------------------ */

function TwoFactorDialog({
  open,
  onClose,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSetup(null)
    setCode('')
    setCodes(null)
    setError(null)

    startTwoFactor()
      .then(setSetup)
      .catch((cause) => setError(errorMessage(cause, 'Could not start setup.')))
  }, [open])

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const result = await confirmTwoFactor(code.trim())
      setCodes(result.recoveryCodes)
      onChanged()
    } catch (cause) {
      setError(errorMessage(cause, 'That code could not be confirmed.'))
    } finally {
      setBusy(false)
    }
  }

  function finish() {
    toast({
      tone: 'success',
      title: 'Two-factor authentication is on',
      description: 'Keep your recovery codes somewhere safe and offline.',
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={codes ? finish : onClose}
      title={codes ? 'Save your recovery codes' : 'Turn on two-factor authentication'}
      description={
        codes
          ? 'These are shown once and cannot be retrieved later.'
          : 'Scan the code with an authenticator app, then enter the six digits it shows.'
      }
      size="md"
    >
      {codes ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-white/80">
              Only hashes of these codes are stored, so nobody — including support — can show
              them to you again. Each works once. They are how you get back in if you lose your
              authenticator.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-base-800 p-4">
            {codes.map((entry) => (
              <li key={entry} className="num text-sm text-white">
                {entry}
              </li>
            ))}
          </ul>

          <Button
            fullWidth
            onClick={() => {
              void navigator.clipboard?.writeText(codes.join('\n')).catch(() => undefined)
              finish()
            }}
          >
            Copy and close
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {!setup && !error && <SkeletonRows rows={4} />}

          {setup && (
            <>
              <div className="flex justify-center">
                <Image
                  src={setup.qrCode}
                  alt="Two-factor setup QR code"
                  width={192}
                  height={192}
                  unoptimized
                  className="rounded-xl border border-line bg-white p-2"
                />
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted">
                  Or enter this key manually
                </p>
                <p className="num break-all rounded-lg border border-line bg-base-800 p-3 text-sm text-white">
                  {setup.secret}
                </p>
              </div>

              <Input
                label="Six-digit code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                hint="2FA is not active until this code is confirmed, so a failed setup cannot lock you out."
              />
            </>
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
              onClick={confirm}
              loading={busy}
              disabled={!setup || code.trim().length !== 6}
              className="sm:flex-1"
            >
              Confirm and enable
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
/* Password / disable-2FA dialogs                                      */
/* ------------------------------------------------------------------ */

function PasswordDialog({
  open,
  onClose,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmValue, setConfirmValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCurrent('')
    setNext('')
    setConfirmValue('')
    setError(null)
  }, [open])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const result = await changePassword(current, next)
      toast({ tone: 'success', title: 'Password changed', description: result.message })
      onChanged()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'Could not change your password.'))
    } finally {
      setBusy(false)
    }
  }

  const mismatch = confirmValue.length > 0 && confirmValue !== next

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change password"
      description="Every other signed-in device will be signed out."
      size="md"
    >
      <div className="space-y-5">
        <PasswordInput
          label="Current password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          autoComplete="current-password"
        />
        <PasswordInput
          label="New password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          autoComplete="new-password"
          hint="At least 10 characters. Length beats symbols — a passphrase is fine."
        />
        <PasswordInput
          label="Confirm new password"
          value={confirmValue}
          onChange={(event) => setConfirmValue(event.target.value)}
          autoComplete="new-password"
          error={mismatch ? 'These do not match.' : undefined}
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
            disabled={!current || next.length < 10 || mismatch || !confirmValue}
            className="sm:flex-1"
          >
            Change password
          </Button>
          <Button variant="secondary" onClick={onClose} className="sm:flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DisableTwoFactorDialog({
  open,
  onClose,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setError(null)
  }, [open])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const result = await disableTwoFactor(password)
      toast({ tone: 'warn', title: 'Two-factor turned off', description: result.message })
      onChanged()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'Could not turn off two-factor authentication.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Turn off two-factor authentication"
      description="Your password is required again."
      size="sm"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-white/80">
            Without a second factor, anyone who learns your password can sign in. Turning this
            off is exactly what an attacker with a live session wants to do — which is why your
            password is asked for again.
          </p>
        </div>

        <PasswordInput
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
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
            disabled={!password}
            className="sm:flex-1"
          >
            Turn off
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

export default function DashboardSecurityPage() {
  const { toast } = useToast()
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null)
  const [history, setHistory] = useState<LoginEvent[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'2fa' | 'disable2fa' | 'password' | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextAccount, nextSessions, nextHistory] = await Promise.all([
        fetchAccount(),
        listSessions(),
        listLoginHistory(),
      ])
      setAccount(nextAccount)
      setSessions(nextSessions.sessions)
      setHistory(nextHistory.events)
      setLoadError(null)
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Could not load your security settings.'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function endSession(id: string) {
    try {
      await revokeSession(id)
      toast({ tone: 'success', title: 'Session ended', description: 'That device is signed out.' })
      void load()
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Could not end that session',
        description: errorMessage(cause, 'Try again.'),
      })
    }
  }

  async function endOthers() {
    try {
      const result = await revokeOtherSessions()
      toast({ tone: 'success', title: 'Signed out elsewhere', description: result.message })
      void load()
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Could not sign out other devices',
        description: errorMessage(cause, 'Try again.'),
      })
    }
  }

  if (loadError) {
    return (
      <>
        <DashboardHeader title="Security" />
        <div className="p-4 sm:p-6">
          <Card className="border-negative/30 bg-negative/[0.05]">
            <CardBody>
              <p className="text-sm font-medium text-negative">
                Could not load your security settings
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/75">{loadError}</p>
              <Button variant="secondary" className="mt-4" onClick={() => void load()}>
                Try again
              </Button>
            </CardBody>
          </Card>
        </div>
      </>
    )
  }

  const twoFactorOn = Boolean(account?.user.twoFactorEnabled)

  return (
    <>
      <DashboardHeader title="Security" />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ---------- Two-factor ---------- */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Two-factor authentication</CardTitle>
                <p className="mt-1 text-sm text-muted">
                  A second factor so a stolen password is not enough
                </p>
              </div>
              {account && (
                <Badge tone={twoFactorOn ? 'success' : 'warn'} dot className="ml-auto">
                  {twoFactorOn ? 'On' : 'Off'}
                </Badge>
              )}
            </CardHeader>
            <CardBody>
              {!account ? (
                <SkeletonRows rows={2} />
              ) : (
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                    <Fingerprint className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-muted">
                      {twoFactorOn
                        ? `Required at sign-in and again before any withdrawal. ${account.recoveryCodesRemaining} recovery code${account.recoveryCodesRemaining === 1 ? '' : 's'} remaining.`
                        : 'Withdrawals require two-factor authentication, so you will need this before you can move funds out.'}
                    </p>
                    {twoFactorOn && account.recoveryCodesRemaining <= 2 && (
                      <p className="mt-2 rounded-lg border border-warn/30 bg-warn/[0.06] p-2.5 text-xs leading-relaxed text-white/80">
                        You are nearly out of recovery codes. Turn 2FA off and on again to issue a
                        fresh set before you lose access to your authenticator.
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant={twoFactorOn ? 'secondary' : 'primary'}
                      className="mt-4"
                      onClick={() => setDialog(twoFactorOn ? 'disable2fa' : '2fa')}
                    >
                      {twoFactorOn ? 'Turn off' : 'Turn on'}
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* ---------- Password ---------- */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Password</CardTitle>
                <p className="mt-1 text-sm text-muted">Used together with your second factor</p>
              </div>
            </CardHeader>
            <CardBody>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-accent">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-muted">
                    Changing your password signs out every other device, so anyone else who was
                    signed in is ejected.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-4"
                    onClick={() => setDialog('password')}
                  >
                    Change password
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ---------- Sessions ---------- */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Active sessions</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Devices signed in to your account right now
              </p>
            </div>
            {sessions && sessions.length > 1 && (
              <Button size="sm" variant="secondary" className="ml-auto" onClick={endOthers}>
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign out everywhere else
              </Button>
            )}
          </CardHeader>
          <CardBody className="p-4 sm:p-0">
            {!sessions ? (
              <div className="p-1 sm:p-5">
                <SkeletonRows rows={3} />
              </div>
            ) : (
              <>
                <TableWrap className="hidden sm:block">
                  <Table className="min-w-[640px]">
                    <Thead>
                      <Tr>
                        <Th>Device</Th>
                        <Th>IP address</Th>
                        <Th>Last active</Th>
                        <Th numeric>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {sessions.map((session) => (
                        <Tr key={session.id}>
                          <Td>
                            <span className="flex items-center gap-2.5 text-white">
                              <Laptop className="h-4 w-4 text-muted" aria-hidden="true" />
                              {describeDevice(session.userAgent)}
                              {session.current && (
                                <Badge tone="accent" className="ml-1">
                                  this device
                                </Badge>
                              )}
                            </span>
                          </Td>
                          <Td className="num text-muted">{session.ipAddress ?? '—'}</Td>
                          <Td className="text-muted">{relativeTime(session.lastActive)}</Td>
                          <Td numeric>
                            {!session.current && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => endSession(session.id)}
                              >
                                Sign out
                              </Button>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableWrap>

                <MobileCardList className="sm:hidden">
                  {sessions.map((session) => (
                    <MobileCard key={session.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">
                          {describeDevice(session.userAgent)}
                        </p>
                        {session.current && <Badge tone="accent">this device</Badge>}
                      </div>
                      <div className="mt-3 divide-y divide-line border-t border-line pt-1">
                        <MobileRow
                          label="IP"
                          value={<span className="num">{session.ipAddress ?? '—'}</span>}
                        />
                        <MobileRow label="Last active" value={relativeTime(session.lastActive)} />
                      </div>
                      {!session.current && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-3"
                          onClick={() => endSession(session.id)}
                        >
                          Sign out
                        </Button>
                      )}
                    </MobileCard>
                  ))}
                </MobileCardList>
              </>
            )}
          </CardBody>
        </Card>

        {/* ---------- Login history ---------- */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent sign-in activity</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Failed attempts are shown too — a run of them from an address you do not
                recognise is worth acting on
              </p>
            </div>
          </CardHeader>
          <CardBody className="p-4 sm:p-0">
            {!history ? (
              <div className="p-1 sm:p-5">
                <SkeletonRows rows={4} />
              </div>
            ) : history.length === 0 ? (
              <p className="p-5 text-sm text-muted">No sign-in activity recorded yet.</p>
            ) : (
              <TableWrap>
                <Table className="min-w-[560px]">
                  <Thead>
                    <Tr>
                      <Th>When</Th>
                      <Th>Result</Th>
                      <Th>IP address</Th>
                      <Th>Device</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {history.map((event) => (
                      <Tr key={event.id}>
                        <Td className="text-muted">{formatDate(event.at, 'long')}</Td>
                        <Td>
                          {event.success ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-positive">
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-sm text-negative">
                              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                              Failed
                            </span>
                          )}
                        </Td>
                        <Td className="num text-muted">{event.ipAddress ?? '—'}</Td>
                        <Td className="text-muted">{describeDevice(event.userAgent)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            )}
          </CardBody>
        </Card>

        <Card className="border-accent/25 bg-accent/[0.04]">
          <CardBody className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-white/75">
              Nobody here will ever ask for your password, your two-factor codes or your recovery
              codes — not by email, not by phone, not in chat. Any such request is an attempt to
              take your account.
            </p>
          </CardBody>
        </Card>
      </div>

      <TwoFactorDialog open={dialog === '2fa'} onClose={() => setDialog(null)} onChanged={load} />
      <DisableTwoFactorDialog
        open={dialog === 'disable2fa'}
        onClose={() => setDialog(null)}
        onChanged={load}
      />
      <PasswordDialog
        open={dialog === 'password'}
        onClose={() => setDialog(null)}
        onChanged={load}
      />
    </>
  )
}
