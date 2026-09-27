'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { resendVerification, verifyEmail } from '@/lib/api/auth'
import { cn } from '@/lib/utils'

const LENGTH = 6

/** Six-box code entry with paste, backspace and arrow-key handling. */
export function VerifyEmailForm({ email }: { email?: string }) {
  const { toast } = useToast()
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''))
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  const code = digits.join('')
  const complete = code.length === LENGTH

  function setDigit(index: number, value: string) {
    setDigits((current) => {
      const next = [...current]
      next[index] = value
      return next
    })
  }

  function handleChange(index: number, rawValue: string) {
    const value = rawValue.replace(/\D/g, '')
    if (!value) {
      setDigit(index, '')
      return
    }

    // Typing or pasting several digits fills forward from this box
    if (value.length > 1) {
      setDigits((current) => {
        const next = [...current]
        value
          .slice(0, LENGTH - index)
          .split('')
          .forEach((char, offset) => {
            next[index + offset] = char
          })
        return next
      })
      inputs.current[Math.min(index + value.length, LENGTH - 1)]?.focus()
      return
    }

    setDigit(index, value)
    if (index < LENGTH - 1) inputs.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus()
    if (event.key === 'ArrowRight' && index < LENGTH - 1) inputs.current[index + 1]?.focus()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!complete) return

    setSubmitting(true)
    try {
      const { data, isMock } = await verifyEmail(code)

      setNotice(
        data.verified
          ? 'Your email address has been confirmed. You can sign in now.'
          : isMock
            ? 'No backend is configured in this build, so nothing was verified.'
            : 'That code is not valid or has expired. Request a new link below.',
      )
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : 'That code could not be checked. Try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setResending(true)
    try {
      const { isMock } = await resendVerification(email ?? '')

      toast(
        isMock
          ? {
              tone: 'warn',
              title: 'No email sent',
              description: 'No backend is configured in this build.',
            }
          : {
              tone: 'success',
              // Deliberately non-committal: the endpoint answers identically
              // for unknown addresses so it cannot be used to discover who has
              // an account, and this message must not give that away either.
              title: 'Check your inbox',
              description:
                'If that address belongs to an unverified account, a new link is on its way. It expires in 24 hours.',
            },
      )
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Could not send that',
        description: cause instanceof Error ? cause.message : 'Try again in a moment.',
      })
    } finally {
      setResending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-white/90">Verification code</legend>
        <div className="flex gap-2 sm:gap-3">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputs.current[index] = el
              }}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={LENGTH}
              aria-label={`Digit ${index + 1} of ${LENGTH}`}
              className={cn(
                'num h-14 w-full rounded-xl border border-line bg-base-800 text-center text-xl text-white transition-colors',
                'focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20',
                digit && 'border-accent/40',
              )}
            />
          ))}
        </div>
      </fieldset>

      <Button type="submit" size="lg" fullWidth loading={submitting} disabled={!complete}>
        Verify email
      </Button>

      <p className="text-center text-sm text-muted">
        Didn&apos;t get a code?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-medium text-accent underline underline-offset-4 transition-colors hover:text-accent-bright disabled:opacity-50"
        >
          {resending ? 'Sending…' : 'Resend'}
        </button>
      </p>

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-warn/25 bg-warn/[0.07] p-3.5 text-xs leading-relaxed text-white/80"
        >
          {notice}
        </p>
      )}
    </form>
  )
}
