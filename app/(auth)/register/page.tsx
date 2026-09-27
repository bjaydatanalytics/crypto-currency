import type { Metadata } from 'next'
import { AuthLink, AuthShell } from '@/components/auth/auth-shell'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Open an account to follow markets and manage a digital asset portfolio.',
  alternates: { canonical: '/register' },
  robots: { index: false, follow: false },
}

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      description="It takes a couple of minutes. You'll confirm your email before you can use the platform."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Login</AuthLink>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  )
}
