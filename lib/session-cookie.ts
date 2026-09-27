/**
 * Session cookie name, isolated in its own module.
 *
 * `middleware.ts` runs on the Edge runtime and needs this constant. Importing
 * it from `lib/server/session.ts` would pull in Argon2 and `node:crypto`, which
 * the Edge runtime cannot load — so the shared value lives here, with no
 * imports of its own.
 */
export const SESSION_COOKIE = 'nexora_session'
