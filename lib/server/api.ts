import 'server-only'
import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'
import { env } from './env'

/**
 * Shared response helpers.
 *
 * Every route returns the same envelope so the client layer in `lib/api/*` can
 * treat all endpoints identically.
 */

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init })
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 })
}

export function fail(
  code: string,
  message: string,
  status: number,
  fields?: Record<string, string>,
) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message, fields } }, { status })
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  fail('bad_request', message, 400, fields)

export const unauthorized = (message = 'You must be signed in to do that.') =>
  fail('unauthorized', message, 401)

export const forbidden = (message = 'You do not have access to this resource.') =>
  fail('forbidden', message, 403)

export const notFound = (message = 'Not found.') => fail('not_found', message, 404)

export const conflict = (message: string) => fail('conflict', message, 409)

export const tooManyRequests = (message: string, retryAfterSeconds: number) =>
  NextResponse.json<ApiErrorBody>(
    { error: { code: 'rate_limited', message } },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  )

/**
 * 503, used when a capability genuinely is not wired up.
 *
 * This is the honest response for "deposits" before a custodian exists: the
 * request was understood and deliberately not performed. It must never be
 * answered with a 200 and a fabricated success.
 */
export const notConfigured = (capability: string, detail: string) =>
  fail('not_configured', `${capability} is not available. ${detail}`, 503)

/**
 * Parses and validates a JSON body.
 *
 * Returns a discriminated result rather than throwing, so routes handle the
 * failure path explicitly.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { success: false, response: badRequest('Request body must be valid JSON.') }
  }

  try {
    return { success: true, data: schema.parse(raw) }
  } catch (error) {
    if (error instanceof ZodError) {
      const fields: Record<string, string> = {}
      for (const issue of error.issues) {
        const key = issue.path.join('.') || 'root'
        if (!fields[key]) fields[key] = issue.message
      }
      return {
        success: false,
        response: badRequest('Please correct the highlighted fields.', fields),
      }
    }
    return { success: false, response: badRequest('Invalid request.') }
  }
}

/**
 * Wraps a handler so an unexpected throw becomes a 500 without leaking
 * internals. The real error is logged server-side; the client gets a code.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      console.error('[api] unhandled error:', error)
      return fail(
        'internal_error',
        env.NODE_ENV === 'production'
          ? 'Something went wrong. Please try again.'
          : `Internal error: ${error instanceof Error ? error.message : String(error)}`,
        500,
      )
    }
  }
}
