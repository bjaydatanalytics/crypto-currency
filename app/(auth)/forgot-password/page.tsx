import type { Metadata } from 'next'
import { AuthLink, AuthShell } from '@/components/auth/auth-shell'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Request a link to reset your account password.',
  alternates: { canonical: '/forgot-password' },
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email address on your account and we'll send you a link to set a new password."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Back to login</AuthLink>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
