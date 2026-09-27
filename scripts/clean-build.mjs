import { readdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Clears stale build output before `next build`.
 *
 * Why this exists: running `next build` over an existing `.next` leaves stale
 * server manifests behind, and the next build fails with errors like
 * "Cannot find module for page: /_document" or "Failed to collect page data".
 * Running `next dev` and `next build` together corrupts it the same way, since
 * both write to `.next`.
 *
 * `.next/cache` is preserved deliberately — that is webpack's incremental
 * cache, and wiping it turns every build into a slow cold build for no benefit.
 * Only the generated output is removed.
 *
 * Wired to `prebuild`, so `npm run build` handles it with no extra step.
 */

const BUILD_DIR = '.next'
const PRESERVE = new Set(['cache'])

if (!existsSync(BUILD_DIR)) {
  console.log('[clean-build] no .next directory — nothing to clean')
  process.exit(0)
}

let removed = 0
for (const entry of readdirSync(BUILD_DIR)) {
  if (PRESERVE.has(entry)) continue
  rmSync(join(BUILD_DIR, entry), { recursive: true, force: true })
  removed++
}

console.log(`[clean-build] cleared ${removed} entries from .next (kept cache/)`)
