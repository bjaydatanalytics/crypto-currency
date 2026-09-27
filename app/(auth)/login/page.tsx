import type { Metadata } from 'next'
import { AuthLink, AuthShell } from '@/components/auth/auth-shell'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your account.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to access your portfolio, markets and account settings."
      footer={
        <>
          Don&apos;t have an account? <AuthLink href="/register">Create one</AuthLink>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  )
}
