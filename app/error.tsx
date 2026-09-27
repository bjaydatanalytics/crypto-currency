'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Replace with a real error reporter before launch.
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-warn/25 bg-warn/10 text-warn">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
        An unexpected error occurred while loading this page. Trying again often resolves it.
      </p>

      {error.digest && (
        <p className="num mt-4 text-xs text-muted">Reference: {error.digest}</p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
    </div>
  )
}
