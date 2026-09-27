import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { Logo } from '@/components/brand/logo'

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 text-center">
      <div className="glow-radial pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <Logo className="mb-12" />

      <p className="num text-[clamp(4rem,14vw,8rem)] font-semibold leading-none tracking-tight text-accent/25">
        404
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Page not found</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
        The page you were looking for doesn&apos;t exist or may have moved.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/">Back to home</ButtonLink>
        <ButtonLink href="/markets" variant="secondary">
          Explore markets
        </ButtonLink>
      </div>

      <p className="mt-10 text-sm text-muted">
        Need help?{' '}
        <Link href="/contact" className="text-accent underline underline-offset-4">
          Contact support
        </Link>
      </p>
    </div>
  )
}
