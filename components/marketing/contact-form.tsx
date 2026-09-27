'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'

const topics = [
  { value: 'account', label: 'Account and access' },
  { value: 'verification', label: 'Identity verification' },
  { value: 'deposits', label: 'Deposits and withdrawals' },
  { value: 'technical', label: 'Technical problem' },
  { value: 'other', label: 'Something else' },
]

interface Errors {
  name?: string
  email?: string
  message?: string
  consent?: string
}

/**
 * Contact form.
 *
 * Client-side validation only. There is no submit endpoint in this build, so
 * the form reports that the message was not sent rather than showing a success
 * state — telling someone their support request was received when nothing was
 * delivered is worse than an obvious failure.
 */
export function ContactForm() {
  const { toast } = useToast()
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    const name = String(form.get('name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const message = String(form.get('message') ?? '').trim()
    const consent = form.get('consent') === 'on'

    const nextErrors: Errors = {}
    if (name.length < 2) nextErrors.name = 'Enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      nextErrors.email = 'Enter a valid email address.'
    if (message.length < 20)
      nextErrors.message = 'Please give us at least a couple of sentences to work from.'
    if (!consent) nextErrors.consent = 'Please confirm before sending.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    // No endpoint exists yet — surface that honestly instead of faking success.
    window.setTimeout(() => {
      setSubmitting(false)
      setNotice(
        'This form is not connected to a support inbox in this demonstration build, so your message was not sent. Wire it to a backend endpoint or a ticketing provider before launch.',
      )
      toast({
        tone: 'warn',
        title: 'Message not sent',
        description: 'No support inbox is connected in this demo build.',
      })
    }, 700)
  }

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Name" name="name" autoComplete="name" error={errors.name} required />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            error={errors.email}
            required
          />
        </div>

        <Select label="Topic" name="topic" options={topics} defaultValue="account" />

        <Textarea
          label="Message"
          name="message"
          error={errors.message}
          placeholder="Tell us what you need help with."
          required
        />

        <Checkbox
          name="consent"
          error={errors.consent}
          label="I understand that support cannot give investment advice, and that I should never share my password or two-factor codes with anyone."
        />

        <Button type="submit" size="lg" loading={submitting} className="w-full sm:w-auto">
          <Send className="h-4 w-4" aria-hidden="true" />
          Send message
        </Button>

        {notice && (
          <p
            role="status"
            className="rounded-lg border border-warn/25 bg-warn/[0.07] p-4 text-sm leading-relaxed text-white/80"
          >
            {notice}
          </p>
        )}
      </form>
    </Card>
  )
}
