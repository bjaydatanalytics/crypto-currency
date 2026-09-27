import type { Metadata } from 'next'
import { AuthLink, AuthShell } from '@/components/auth/auth-shell'
import { VerifyEmailForm } from '@/components/auth/verify-email-form'

export const metadata: Metadata = {
  title: 'Verify Email',
  description: 'Confirm your email address to finish setting up your account.',
  alternates: { canonical: '/verify-email' },
  robots: { index: false, follow: false },
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

  return (
    <AuthShell
      title="Check your email"
      description={
        email
          ? `We've sent a six-digit code to ${email}. Enter it below to confirm your address.`
          : 'Enter the six-digit code we sent to your email address.'
      }
      footer={
        <>
          Wrong address? <AuthLink href="/register">Start again</AuthLink>
        </>
      }
    >
      <VerifyEmailForm email={email} />
    </AuthShell>
  )
}
