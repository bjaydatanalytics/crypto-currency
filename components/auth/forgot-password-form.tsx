'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { requestPasswordReset } from '@/lib/api/auth'

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }

    setError(undefined)
    setSubmitting(true)

    const { data } = await requestPasswordReset(email)

    setSubmitting(false)
    setNotice(
      data.sent
        ? 'If an account exists for that address, a reset link has been sent.'
        : 'No email was sent: this demonstration build has no mail service connected. Wire the auth service to a backend to enable password resets.',
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        icon={<Mail className="h-4 w-4" />}
        error={error}
        hint="We'll send a reset link to this address."
        required
      />

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        Send reset link
      </Button>

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
