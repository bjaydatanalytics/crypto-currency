'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, PasswordInput } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { register } from '@/lib/api/auth'
import { cn } from '@/lib/utils'
import { AuthLink } from './auth-shell'

interface Errors {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  confirmPassword?: string
  acceptedTerms?: string
}

/** Rough strength signal — guidance for the user, not a security control. */
function passwordScore(value: string) {
  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/\d/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  return Math.min(score, 4)
}

const strengthLabels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
const strengthColors = ['bg-negative', 'bg-negative', 'bg-warn', 'bg-accent/70', 'bg-accent']

export function RegisterForm() {
  const { toast } = useToast()
  const [errors, setErrors] = useState<Errors>({})
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const score = passwordScore(password)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    const firstName = String(form.get('firstName') ?? '').trim()
    const lastName = String(form.get('lastName') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const pwd = String(form.get('password') ?? '')
    const confirmPassword = String(form.get('confirmPassword') ?? '')
    const acceptedTerms = form.get('acceptedTerms') === 'on'

    const nextErrors: Errors = {}
    if (firstName.length < 2) nextErrors.firstName = 'Enter your first name.'
    if (lastName.length < 2) nextErrors.lastName = 'Enter your last name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      nextErrors.email = 'Enter a valid email address.'
    if (pwd.length < 8) nextErrors.password = 'Use at least 8 characters.'
    else if (passwordScore(pwd) < 2) nextErrors.password = 'Choose a stronger password.'
    if (pwd !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.'
    if (!acceptedTerms) nextErrors.acceptedTerms = 'You must accept the terms to continue.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setNotice(null)

    const { data } = await register({
      firstName,
      lastName,
      email,
      password: pwd,
      acceptedTerms,
    })

    setSubmitting(false)
    setNotice(data.message)
    toast({
      tone: data.registered ? 'success' : 'warn',
      title: data.registered ? 'Check your email' : 'Account not created',
      description: data.message,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="First name"
          name="firstName"
          autoComplete="given-name"
          error={errors.firstName}
          required
        />
        <Input
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          error={errors.lastName}
          required
        />
      </div>

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        icon={<Mail className="h-4 w-4" />}
        error={errors.email}
        required
      />

      <div>
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        {password.length > 0 && !errors.password && (
          <div className="mt-2.5">
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    i < score ? strengthColors[score] : 'bg-white/[0.08]',
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted" aria-live="polite">
              Password strength: {strengthLabels[score]}
            </p>
          </div>
        )}
      </div>

      <PasswordInput
        label="Confirm password"
        name="confirmPassword"
        autoComplete="new-password"
        error={errors.confirmPassword}
        required
      />

      <Checkbox
        name="acceptedTerms"
        error={errors.acceptedTerms}
        label={
          <>
            I agree to the{' '}
            <Link href="/terms" className="text-accent underline underline-offset-4">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-accent underline underline-offset-4">
              Privacy Policy
            </Link>
            , and I have read the{' '}
            <Link href="/risk-disclosure" className="text-accent underline underline-offset-4">
              Risk Disclosure
            </Link>
            .
          </>
        }
      />

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        Create Account
      </Button>

      <p className="text-xs leading-relaxed text-muted">
        Digital assets are volatile and you may get back less than you put in. No return is
        guaranteed.
      </p>

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-warn/25 bg-warn/[0.07] p-3.5 text-xs leading-relaxed text-white/80"
        >
          {notice} You can still{' '}
          <AuthLink href="/dashboard">open the demo dashboard</AuthLink> to explore the interface.
        </p>
      )}
    </form>
  )
}
