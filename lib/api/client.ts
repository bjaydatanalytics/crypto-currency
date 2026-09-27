/**
 * Thin transport used by every service in `lib/api/*`.
 *
 * While `NEXT_PUBLIC_API_BASE_URL` is unset the app runs entirely on local mock
 * data: `request()` is never called and each service returns its fallback. Once
 * a real backend exists, set the env var and the same services start hitting it
 * — no UI component has to change, because components only ever import the
 * service functions, never fetch directly.
 */

import { platform } from '../config'
import type { ApiResult } from '../types'
import { delay } from '../utils'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const isBackendConfigured = () => platform.apiBaseUrl.length > 0

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Appended to the URL as a query string. */
  query?: Record<string, string | number | boolean | undefined>
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isBackendConfigured()) {
    throw new ApiError('No API base URL configured', 0)
  }

  const { body, query, headers, ...rest } = options

  /**
   * Supports both a same-origin base ("/api") and an absolute one.
   *
   * `new URL` needs an absolute base, so a relative base is resolved against
   * the current origin in the browser. On the server a relative base has no
   * origin to resolve against, which is a configuration error worth failing on
   * loudly rather than silently falling back to mock data.
   */
  const base = platform.apiBaseUrl.replace(/\/$/, '')
  const origin =
    base.startsWith('http')
      ? base
      : typeof window !== 'undefined'
        ? `${window.location.origin}${base}`
        : null

  if (!origin) {
    throw new ApiError(
      `Relative API base URL ("${base}") cannot be used during server rendering. ` +
        'Call this from a client component, or set an absolute NEXT_PUBLIC_API_BASE_URL.',
      0,
    )
  }

  const url = new URL(path.replace(/^\//, ''), `${origin}/`)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url.toString(), {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    // Auth: attach the session cookie once the backend issues one.
    credentials: 'include',
  })

  if (!response.ok) {
    let parsed: unknown
    try {
      parsed = await response.json()
    } catch {
      parsed = await response.text().catch(() => undefined)
    }

    // Surface the server's own message where it sent one — these are written
    // for the person reading them ("That code is not valid"), so replacing them
    // with a generic string makes the UI less useful, not safer.
    const serverMessage =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? (parsed as { error?: { message?: string } }).error?.message
        : undefined

    throw new ApiError(
      serverMessage ?? `Request to ${path} failed`,
      response.status,
      parsed,
    )
  }

  return (await response.json()) as T
}

/**
 * For features whose backend does not exist yet.
 *
 * Three distinct states, and conflating them is how a UI ends up lying:
 *
 * - No backend at all → sample data, clearly labelled. That is the demo build.
 * - Backend live, but this capability is off (no custodian, so no ledger) →
 *   the genuine answer is *empty*, not sample data. A real account with no
 *   deposits has no holdings, and showing invented ones would be a fabricated
 *   balance on a real account.
 * - Capability on → call the API.
 */
export async function withCapability<T>(
  capabilityEnabled: boolean,
  live: () => Promise<T>,
  empty: () => T,
  mock: () => T,
  latencyMs = 200,
): Promise<ApiResult<T>> {
  if (!isBackendConfigured()) {
    await delay(latencyMs)
    return { data: mock(), isMock: true }
  }

  if (!capabilityEnabled) {
    // Not an error: the feature is genuinely unavailable, and empty is the
    // truthful representation of an account that cannot yet hold anything.
    return { data: empty(), isMock: false }
  }

  return { data: await live(), isMock: false }
}

/**
 * Runs `live` when a backend is configured, otherwise resolves the mock value
 * after a short simulated latency so loading states are exercised in the
 * prototype exactly as they will be in production.
 */
export async function withFallback<T>(
  live: () => Promise<T>,
  mock: () => T,
  latencyMs = 220,
): Promise<ApiResult<T>> {
  if (isBackendConfigured()) {
    try {
      return { data: await live(), isMock: false }
    } catch (error) {
      // Surface the failure in development; fall back so the prototype stays usable.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[api] live request failed, using mock data:', error)
      } else {
        throw error
      }
    }
  }

  await delay(latencyMs)
  return { data: mock(), isMock: true }
}
