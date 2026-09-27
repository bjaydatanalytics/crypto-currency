'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, PasswordInput } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { login } from '@/lib/api/auth'
import { AuthLink } from './auth-shell'

export function LoginForm() {
  const { toast } = useToast()
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    const nextErrors: typeof errors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      nextErrors.email = 'Enter a valid email address.'
    if (password.length < 1) nextErrors.password = 'Enter your password.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setNotice(null)

    try {
      const { data } = await login({ email, password, remember: form.get('remember') === 'on' })
      setSubmitting(false)

      // 2FA accounts get a challenge before any session exists.
      if (data.requiresTwoFactor) {
        setNotice(data.message ?? 'Enter the code from your authenticator app.')
        return
      }

      if (data.authenticated) {
        toast({ tone: 'success', title: 'Signed in', description: 'Welcome back.' })
        // Full navigation so the new session cookie is picked up server-side.
        window.location.assign('/dashboard')
        return
      }

      setNotice(data.message ?? 'Could not sign in.')
      toast({ tone: 'warn', title: 'Not signed in', description: data.message ?? '' })
    } catch (error) {
      setSubmitting(false)
      const message =
        error instanceof Error ? error.message : 'Could not sign in. Please try again.'
      setNotice(message)
      toast({ tone: 'error', title: 'Sign-in failed', description: message })
    }
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
        error={errors.email}
        required
      />

      <div>
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Your password"
          error={errors.password}
          required
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox name="remember" label="Remember me" />
        <Link
          href="/forgot-password"
          className="text-sm text-accent underline underline-offset-4 transition-colors hover:text-accent-bright"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        Login
      </Button>

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-warn/25 bg-warn/[0.07] p-3.5 text-xs leading-relaxed text-white/80"
        >
          {notice} You can still{' '}
          <AuthLink href="/dashboard">open the demo dashboard</AuthLink> to explore the interface
          with sample data.
        </p>
      )}
    </form>
  )
}
