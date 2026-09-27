# Nexora

A premium dark-theme digital asset platform: marketing site, investor dashboard and
admin scaffolding, built with Next.js 15, React 19, TypeScript, Tailwind CSS,
Framer Motion, Lucide and Recharts.

> **Partly real, partly scaffolding — and it tells you which is which.**
>
> Real and backed by Postgres: accounts, sessions, 2FA, KYC records, market
> prices, the double-entry ledger, deposit addresses, deposits, withdrawals and
> investment plans.
>
> Still mock: portfolio analytics, investment subscriptions, trading, and the
> admin overview. Those screens say so rather than inventing figures.
>
> Deposits and withdrawals run a **centralised, operator-driven** model: the
> business holds the receiving accounts, and a human assigns addresses, credits
> deposits and pays withdrawals. There is no third-party custodian. Read
> [Deployment](#deployment) and [What must be connected](#what-must-be-connected-to-a-real-backend)
> before putting this in front of anyone.

---

## Running it

```bash
npm install
npm run dev              # Turbopack — http://localhost:3000, next free port if busy
npm run dev:webpack      # fallback if Turbopack misbehaves
npm run build            # production build
npm run start            # serve the production build on :3000
npm run lint
npm run db:reset-limits  # clear rate-limit counters and account lockouts (dev only)
```

Node 20+ recommended (developed on Node 24).

Dev uses Turbopack: it boots in ~5s versus ~11s on webpack and uses noticeably
less memory, which matters on an 8 GB machine already running an editor and a
browser. If you hit a Turbopack-specific issue, `npm run dev:webpack` is the
same server on the old compiler.

**Low on RAM?** Next's dev server needs roughly 1–2 GB. If it dies with
`JavaScript heap out of memory` and `external memory pressure`, the machine is
out of RAM rather than the heap being too small — raising `--max-old-space-size`
will not help. Close other dev servers and browser windows.

### Do not run `dev` and `build` at the same time

Both write to `.next`. Running them together corrupts it, and the symptom is
confusing rather than obvious: pages render **completely unstyled**, or the
server throws `Cannot find module './vendor-chunks/next.js'`. It looks like a
CSS bug; it isn't.

Stale output causes the same thing on its own — a second `next build` over an
existing `.next` fails with `Cannot find module for page: /_document` or
`Failed to collect page data`.

`npm run build` now runs `scripts/clean-build.mjs` first, which clears generated
output while keeping `.next/cache` so incremental builds stay fast. If you ever
see unstyled pages, stop every dev server, then rebuild — the styling itself is
fine.

---

## Backend setup

```bash
# 1. Create a Postgres database at https://neon.tech, copy the connection string
cp .env.example .env.local        # then fill in DATABASE_URL

# 2. Generate an encryption key for TOTP secrets at rest
openssl rand -base64 32           # paste into ENCRYPTION_KEY

# 3. Create the tables and seed reference data
npm run db:push          # development only — production uses db:migrate
npm run db:seed -- --admin-email you@example.com --admin-password 'a-long-passphrase'

# 4. Point the frontend at the API
#    NEXT_PUBLIC_API_BASE_URL=/api  in .env.local

npm run dev
```

Once running, an admin has to **record a receiving address and assign it to a
user** at `/admin/deposit-addresses` before that user's deposit screen shows
anything. See [The deposit model](#the-deposit-model).

For production, follow [Deployment](#deployment) instead — the steps differ in
ways that matter.

| Script | Purpose |
|---|---|
| `db:generate` | Write a SQL migration from `db/schema.ts` |
| `db:migrate` | Apply pending migrations (use in CI/production) |
| `db:push` | Sync schema directly — development only |
| `db:studio` | Browse the database |
| `db:seed` | Reference data, plus an optional first admin |

---

## Deployment

Everything below assumes a **fresh production database**. If you are deploying
over a database that was built with `db:push`, read
[Migrating an existing database](#migrating-an-existing-database) first — it
will not work otherwise.

### 1. Prerequisites

| Need | Notes |
|---|---|
| **Node 20+** | Developed on Node 24. There is no `engines` field; set the runtime explicitly on your host |
| **Postgres** | Neon is assumed. The driver connects over **WebSocket**, not HTTP, because several flows need real transactions |
| **Email transport** | Resend *or* SMTP. Without one, verification and password-reset emails are silently never delivered |
| **CoinGecko key** | Optional. Without it, prices come from cache and the UI reports them stale |

There is no `Dockerfile`, `vercel.json` or CI config in this repo. Add whatever
your host needs.

### 2. Environment

Set these in your host's environment, not in a committed file. `.env.local` is
for local development only.

**Required — the app will not work without them:**

```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
ENCRYPTION_KEY=          # openssl rand -base64 32
APP_URL=https://your-domain.com          # absolute; used to build email links
NEXT_PUBLIC_API_BASE_URL=/api            # empty string = mock build, no backend
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

**Strongly recommended:**

```bash
RESEND_API_KEY=                          # or SMTP_URL=
MAIL_FROM="Nexora <no-reply@your-domain.com>"   # domain must be verified
MARKET_API_KEY=                          # CoinGecko
NEXT_PUBLIC_LIVE_MARKET_DATA=true        # only once MARKET_API_KEY works
```

**Capability flags — read
[Capability flags](#capability-flags) before setting either to `true`:**

```bash
NEXT_PUBLIC_CUSTODY_ENABLED=false        # deposits, withdrawals, ledger screens
NEXT_PUBLIC_TRADING_ENABLED=false        # leave false — trading is not implemented
NEXT_PUBLIC_WALLET_MODEL=custodial
```

`ENCRYPTION_KEY` is effectively permanent: rotating it invalidates every
enrolled 2FA device, locking out every user who relies on one. Back it up
somewhere you will still have in a year.

Anything prefixed `NEXT_PUBLIC_` is compiled into the browser bundle and is
readable by every visitor. Never put a secret behind that prefix.

### 3. Schema

```bash
npm run db:migrate        # applies db/migrations/0000 … 0004
```

Use `db:migrate` in production, never `db:push`. Push diffs live tables against
the schema file and applies whatever it infers, with no reviewable artefact and
no ordering guarantee — fine for a scratch database, not for one holding
customer records.

### 4. Seed

```bash
npm run db:seed -- --admin-email you@example.com --admin-password 'a-long-passphrase'
```

This inserts the six assets and the three plan tiers, and creates one admin.
Re-running it is safe: assets refresh their display fields, plans refresh only
their descriptive copy. It will **not** overwrite plan terms you configured or
un-publish a live plan.

The seed creates **no customer accounts, balances or transactions**. A financial
database should contain only records of things that actually happened.

### 5. Build and serve

```bash
npm ci
npm run build             # runs scripts/clean-build.mjs first
npm run start             # next start -p 3000
```

Put a reverse proxy in front for TLS, or use a platform that terminates it.
Security headers (`X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`) are set in `next.config.mjs`; add HSTS and a Content-Security
-Policy at the proxy.

**Do not run `dev` and `build` against the same checkout at once.** Both write
to `.next` and the result is corrupt output with a misleading symptom — pages
render completely unstyled, or the build fails with
`Cannot find module for page: /_document`. Stop every dev server first.

### 6. Live vs mock, on screen

Every admin page carries a badge in its header: green **Live data** for screens
backed by real database records, amber **Mock data** for sample figures.

| Live | Mock |
|---|---|
| Users, Deposit addresses, Deposits, Withdrawals, Plans, Market data | Overview, Investments, Transactions, Settings |

`AdminShell` takes a required `data` prop, so TypeScript will not let a new
admin screen ship without declaring which it is. Mislabelling either way leads
to a decision made on a false premise — an operator crediting a real deposit
under a "Mock data" banner, or reading sample figures as real.

### 7. What is dynamic

Most pages are prerendered. These are server-rendered per request and cannot be
statically cached:

- `/`, `/investment-plans`, `/pricing` — they read published plan terms, and
  baking those into static HTML would leave an operator's edits invisible until
  the next deploy
- `/dashboard/*`, `/admin/*` — per-user data behind a session
- everything under `/api/*`

If you put a CDN in front, do not cache HTML for those paths.

### 8. Before real users — a checklist

These are not optional polish. Each one is something that hurts a real person if
skipped.

- [ ] **Sign in as the admin and change the seeded password.**
- [ ] **Approve each customer's identity verification** at `/admin/users`.
      Nobody can deposit until both their KYC is approved *and* their email is
      confirmed — the screen shows a "Can deposit" column so the two are not
      confused.
- [ ] **Record your real receiving addresses** at `/admin/deposit-addresses`.
      Copy each one from your own exchange deposit screen — never from
      documentation, a chat message, or this README. Delete any test address.
- [ ] **Send a small test deposit** to each address and confirm it arrives
      before any customer uses it.
- [ ] **Configure and publish plan terms** at `/admin/plans`. Plans ship
      unpublished with no amounts set.
- [ ] **Verify email delivery end to end** — register a throwaway account and
      confirm the verification link actually arrives.
- [ ] **Set `NEXT_PUBLIC_CUSTODY_ENABLED=true`** only once an operator is
      genuinely monitoring `/admin/deposits`. The interface promises customers
      their deposits will be credited; in this model a person keeps that promise.
- [ ] **Restrict the audit log** to `INSERT` and `SELECT` for the application
      role, so the trail cannot be rewritten by the app or a stolen credential.
- [ ] **Alert on `/api/health`** — see [Monitoring](#monitoring).
- [ ] **Legal review** of `/terms`, `/privacy` and `/risk-disclosure`. They are
      structural drafts carrying a visible "not yet reviewed" notice.
- [ ] **Fill in every `TODO_CLIENT`** in `lib/config.ts`.

### 9. Known gaps that will bite you in production

Listed because finding these at 2am is worse.

- **One scheduled job exists: `POST /api/cron/maturities`.** Schedule it at
  least daily or investment contracts never pay out. Market quotes still
  refresh only when someone loads a page, and `purgeExpiredSessions` /
  `purgeStaleRateLimits` still never run.
- **No deposit detection.** Nothing watches the chain or your exchange. Every
  deposit is recorded by hand at `/admin/deposits`. If nobody is watching, money
  arrives and balances stay at zero.
- **Withdrawals are paid manually.** Approving does not send anything; an
  operator makes the transfer and records the hash. Single-approver only — there
  is no dual approval, no per-approver limit and no sanctions screening.
- **No automated tests.** Verification so far has been manual and
  script-driven against a live database.

## Deploying to Vercel

The whole path, in order. Steps 1–3 are the ones that block a first deploy.

### 1. Put it in git

Vercel deploys from a git remote. This project was not a repository until now —
`git init` has been run, and `.gitignore` already protects `.env.local`
(verified with `git check-ignore`; `.env.example` contains only empty
placeholders).

```bash
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:you/your-repo.git
git push -u origin main
```

**Check `git status` before the first push.** If `.env.local` ever appears in
it, stop: your database URL, encryption key and API keys would enter git
history, and rewriting history after a push is far harder than not pushing.

### 2. Create a separate production database

**Do not point production at your development database.** Two concrete reasons:

- It currently holds test data and real support tickets mixed together.
- It was built with `db:push`, so its migration journal is empty and
  `db:migrate` will fail against it — see
  [Migrating an existing database](#migrating-an-existing-database).

Create a new Neon database (or a new branch of the existing project), then from
your machine, pointed at the new one:

```bash
DATABASE_URL="postgresql://...prod..." npm run db:migrate
DATABASE_URL="postgresql://...prod..." npm run db:seed -- --admin-email you@example.com --admin-password 'a-long-passphrase'
```

**Use Neon's pooled connection string** — the host containing `-pooler`. Each
Vercel function instance opens its own pool (`max: 10` in `db/index.ts`), so
without the pooler a traffic spike exhausts Neon's connection limit and
requests begin failing on connect rather than on anything you changed.

### 3. Import the project into Vercel

The framework preset is detected automatically. Nothing needs overriding:

| Setting | Value |
|---|---|
| Framework | Next.js (auto-detected) |
| Build command | `npm run build` — runs `prebuild` → `scripts/clean-build.mjs` first |
| Install command | `npm ci` |
| Node version | 22, pinned by `engines` in `package.json` and `.nvmrc` |

**The build does not need a reachable database.** Verified: a build against a
deliberately unreachable `DATABASE_URL` completed all 81 pages. Environment
validation is deferred to first access, and every page that reads the database
is `force-dynamic`. A Neon outage therefore cannot break your deploys — only
your running site.

`next/font` does fetch Google Fonts during the build, so the build needs
outbound network access. Vercel has it.

### 4. Environment variables

Set these under **Settings → Environment Variables**, for Production and
Preview both.

**Required:**

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** string. A different value per environment |
| `ENCRYPTION_KEY` | `openssl rand -base64 32`. **Back it up** — rotating it locks out every 2FA user |
| `APP_URL` | `https://your-domain.com`. Builds the links inside emails, so a wrong value sends people to the wrong site |
| `NEXT_PUBLIC_API_BASE_URL` | `/api` |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` |
| `CRON_SECRET` | `openssl rand -hex 32`. **Required** — the maturity job refuses to run without it, and Vercel sends it automatically |

**Strongly recommended:**

| Variable | Notes |
|---|---|
| `RESEND_API_KEY` or `SMTP_URL` | Without one, no verification or reset email is ever delivered |
| `MAIL_FROM` | `"Nexora <no-reply@your-domain.com>"` — the domain must be verified with your provider |
| `MARKET_API_KEY` | CoinGecko |
| `NEXT_PUBLIC_LIVE_MARKET_DATA` | `true` only once the key works |

**Capability flags** — read [Capability flags](#capability-flags) first:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_CUSTODY_ENABLED` | `true` only when an operator is genuinely watching `/admin/deposits` |
| `NEXT_PUBLIC_TRADING_ENABLED` | `false` — trading is not implemented |
| `NEXT_PUBLIC_WALLET_MODEL` | `custodial` |

> **`NEXT_PUBLIC_*` values are compiled into the browser bundle at build time.**
> Changing one in the dashboard does nothing until you redeploy. This catches
> people out with `NEXT_PUBLIC_CUSTODY_ENABLED` especially: flipping it and
> refreshing changes nothing, which reads as a bug.

### 5. The cron job

`vercel.json` schedules the maturity sweep daily at 02:00 UTC:

```json
{ "crons": [{ "path": "/api/cron/maturities", "schedule": "0 2 * * *" }] }
```

Vercel invokes cron jobs with **GET**, and sends
`Authorization: Bearer $CRON_SECRET` automatically once that variable is set.
The endpoint accepts GET and POST behind the same check — it previously rejected
GET with 405, which would have looked like a working cron that silently never
paid anybody.

`maxDuration` is raised to 60s for that route because the sweep matures
contracts one at a time.

**Hobby plan limits:** two cron jobs, once-per-day granularity only. That is
enough for this one job; Pro allows arbitrary schedules.

Verify it after deploying:

```bash
curl -i https://your-domain.com/api/cron/maturities
# expect 401

curl -i -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/maturities
# expect 200
```

### 6. After the first deploy

- [ ] Sign in as the seeded admin and **change its password**.
- [ ] Record your real receiving addresses at `/admin/deposit-addresses`, copied
      from your own exchange screen. **Delete the test addresses.**
- [ ] Assign an address to a user and confirm it appears on their deposit page.
- [ ] Configure and publish plan terms at `/admin/plans`.
- [ ] **Fund the treasury** at `/admin/investments` if you sell fixed-return
      plans. A contract maturing against an empty treasury is refused, not paid.
- [ ] Register a throwaway account and confirm the verification email arrives.
- [ ] `curl https://your-domain.com/api/health` and check `ledger.balanced`.
- [ ] Restrict the audit log to `INSERT` and `SELECT` for the application role.

---

## Working on it after it is live

### Adding a feature

Vercel builds every branch as its own **preview deployment** with a real URL.

```bash
git checkout -b add-some-feature
npm run lint && npx tsc --noEmit && npm run build
git push -u origin add-some-feature
```

The push produces a preview URL. Merging to `main` deploys to production.

**Give previews their own database.** Neon branches are instant and cheap:
create one and set `DATABASE_URL` for the *Preview* environment to it. Without
this, a preview deployment writes to production — which in this codebase means
crediting real deposits and paying real contracts from a branch you were only
experimenting on.

### Schema changes

Vercel does **not** run migrations. You do:

```bash
npm run db:generate
# review the generated SQL, commit it, then:
DATABASE_URL="postgresql://...prod..." npm run db:migrate
```

Order matters. **Additive changes first:** migrate, then deploy the code that
uses the new column. Deploying first means the running code queries a column
that does not exist yet and every affected request 500s until the migration
lands. For a removal, reverse it — deploy code that stops using the column,
then migrate.

Never `db:push` against production: it applies whatever it infers, with no
reviewable artefact and no ordering guarantee.

### Fixing an error

1. **Find it.** Vercel → the deployment → **Runtime Logs**. Every unhandled
   throw passes through `withErrorHandling`, which logs `[api] unhandled error:`
   with the real message and returns a generic 500 to the caller. The detail is
   in the logs, never in the response.
2. **Roll back if it is bad.** Vercel → Deployments → the last good one →
   **Promote to Production**. Instant, no rebuild. Do this *before* debugging if
   money movement is affected.
3. **Reproduce locally** against a Neon branch copy of production, never
   against production itself.
4. **Check the ledger** after anything touching money: `/api/health` →
   `ledger.balanced` must be `true`. If it is `false`, entries were written
   outside `postTransaction` and the books no longer add up. That is a
   page-someone situation, not a ticket.

### Monitoring to set up

Nothing currently reports errors to you — `app/error.tsx` only calls
`console.error`. Before real traffic, wire an error reporter (Sentry's Next.js
integration also captures server-side route errors) and alert on the fields
listed under [Monitoring](#monitoring).

### Things that will surprise you

| Symptom | Cause |
|---|---|
| A `NEXT_PUBLIC_*` change appears to do nothing | Baked in at build time. Redeploy |
| Deposits never credit | Nothing watches the chain; an operator records them at `/admin/deposits` |
| Contracts never pay out | The cron is the only thing that matures them. Check it is enabled and returning 200 |
| Emails silently never arrive | No transport configured, or an unverified sending domain. `/api/health` reports the transport |
| A new customer cannot deposit | KYC *and* email verification both gate it. Approve them at `/admin/users` |
| Connection errors under load | Use Neon's `-pooler` host |

---

### Migrating an existing database

If your database was created with `db:push`, Drizzle's migration journal is
empty and `npm run db:migrate` will fail — it tries to replay `0000` against
tables that already exist, and the error it prints is unhelpfully vague.

Check first:

```sql
select count(*) from drizzle.__drizzle_migrations;
```

`0` on a database that already has tables means it is push-managed. Either
continue using `db:push` for that database, or baseline it by inserting rows for
the migrations already reflected in its schema before running `db:migrate`.
Pick one mechanism per database and stay with it.

### Monitoring

`GET /api/health` is unauthenticated and returns booleans and counts only — no
keys, hosts or addresses. It answers `503` when degraded.

```json
{
  "status": "ok",
  "checks": {
    "database": { "ok": true },
    "email":    { "ok": true, "transport": "resend" },
    "deposits": { "model": "managed", "activeAddresses": 3, "pendingDeposits": 0 },
    "ledger":   { "balanced": true }
  }
}
```

Alert on:

| Field | Meaning |
|---|---|
| `ledger.balanced: false` | **Page someone.** Entries were written outside `postTransaction` and the books no longer add up |
| `database.ok: false` | The app is down |
| `email.ok: false` | Signups are silently failing — nobody receives a verification link |
| `deposits.pendingDeposits` climbing | Nobody is reviewing deposits; customers' money has arrived and their balances read zero |
| `deposits.activeAddresses: 0` | No receiving addresses recorded, so no customer can deposit at all |

### What the backend implements

Route handlers under `app/api/`, all sharing one response envelope:

| Endpoint | Notes |
|---|---|
| `POST /api/auth/register` | Argon2id hashing; same response whether or not the address exists |
| `POST /api/auth/login` | Rate limited per IP *and* per account; TOTP + recovery codes; lockout |
| `POST /api/auth/logout` | Revokes server-side, not just the cookie |
| `GET/PATCH /api/auth/me` | Current user, sensitive columns stripped. PATCH edits name, phone and country only — never email, role or KYC |
| `POST /api/auth/change-password` | Re-verifies the current password, revokes every other session, emails the owner |
| `POST /api/auth/resend-verification` | Burns outstanding links, issues a fresh one; identical response for unknown addresses |
| `GET /api/auth/login-history` | The user's own sign-ins, failures included, so they can spot one they don't recognise |
| `GET/PATCH /api/account/preferences` | Notification and consent settings. No field for security alerts — they cannot be disabled |
| `GET/POST /api/investments` | The customer's contracts; POST locks the principal and freezes the terms |
| `GET /api/admin/investments` | Every contract |
| `POST /api/admin/investments/[id]` | `mature` (refused if the treasury is short) or `cancel` (principal back, no return) |
| `GET/POST /api/admin/treasury` | Solvency per asset; POST records the business funding it |
| `POST /api/cron/maturities` | Scheduled payout sweep. `Authorization: Bearer <CRON_SECRET>` |
| `POST /api/auth/verify-email` | Single-use token, consumed atomically |
| `POST /api/auth/forgot-password` | Identical response for unknown addresses |
| `POST /api/auth/reset-password` | Revokes every session on success |
| `POST/PUT/DELETE /api/auth/two-factor` | Enrol, confirm, disable (password required) |
| `GET/DELETE /api/sessions` | List live sessions; sign out everywhere else |
| `DELETE /api/sessions/[id]` | Scoped to the caller's own sessions |
| `GET/POST /api/kyc` | Status and submission — stores a provider reference only |
| `GET /api/markets/quotes` | Live prices, cached in Postgres, staleness reported |
| `GET /api/admin/users` | Paginated; every access audited |
| `PATCH /api/admin/users/[id]` | Status and KYC decisions; admins cannot edit themselves; suspension revokes every live session |
| `GET /api/wallet/balances` | Computed from the ledger — no stored balance column |
| `GET /api/wallet/deposit-addresses` | The assets this account has an address for; `[]` until an operator assigns one |
| `GET /api/wallet/deposit-address/[assetId]` | 503 unless an operator assigned one to *this* user; never a placeholder |
| `GET/POST /api/wallet/withdrawals` | KYC + 2FA + allow-list + cooling-off; locks funds, sends nothing |
| `GET /api/transactions` | Read from ledger entries |
| `GET/POST /api/admin/deposit-addresses` | The receiving-address pool. Checksum-validated per network on write |
| `PATCH /api/admin/deposit-addresses/[id]` | Retire an address; revokes its assignments in the same transaction |
| `GET/POST /api/admin/deposit-assignments` | Assign an address to one user — the step that makes it visible to them |
| `GET/POST /api/admin/deposits` | Record an arrived deposit. Recording credits nothing |
| `POST /api/admin/deposits/[id]` | `credit` (enforces the confirmation threshold), `reject`, `confirmations` |
| `GET /api/admin/withdrawals` | Queue for review |
| `POST /api/admin/withdrawals/[id]` | `approve` (moves no money), `settle` (requires a tx hash), `reject` |
| `GET/POST /api/admin/plans` | Plan CRUD. No field exists for a rate of return |
| `PATCH/DELETE /api/admin/plans/[id]` | Edit or remove; previous terms recorded in the audit log |
| `GET /api/plans`, `/api/plans/[id]` | Public. Published plans only — drafts are filtered in the query |
| `GET /api/health` | Database, email, deposit readiness, and **ledger balance** check |

### Two wallet models

Both are implemented. `NEXT_PUBLIC_WALLET_MODEL` picks which the UI uses — they
are alternatives, not layers, and the choice is legal before it is technical.

| | `custodial` (default) | `non-custodial` |
|---|---|---|
| Keys | The business holds the receiving accounts | The user |
| Balances from | Internal double-entry ledger | The chain, read live |
| Deposits / withdrawals | Operator-run: assign, record, credit, pay | None — the user signs their own |
| Platform can move funds | **Yes** | No |
| Third-party vendor | None | None |

**The test regulators apply:** *can you move a customer's funds without them?*
In the custodial model here the answer is **yes** — the business controls the
receiving accounts and an operator pays withdrawals by hand. That makes you a
custodian in most jurisdictions, with the licensing, capital, segregation and
audit obligations that follow. Confirm with counsel against your actual signing
arrangements before taking a customer's money.

#### Non-custodial flow

1. `POST /api/wallets/challenge` — issues a single-use nonce and a readable
   message, bound to one user, address and chain.
2. The user signs it in their own wallet (`personal_sign`).
3. `POST /api/wallets` — verifies the signature, records the claim.

The message is rebuilt server-side from the stored row, never from request
input — otherwise the caller chooses what was "signed" and the proof is
meaningless. The nonce is consumed *before* the signature is checked, so a bad
signature burns the challenge and cannot be ground against.

Nothing in `db/wallet-schema.ts` stores a balance or any key material. There is
no column the platform could edit to change what a user holds.

Verified end to end with real secp256k1 keypairs — 18 checks covering valid
proof, replay, wrong-signer forgery, nonce burning, malformed input, and a live
mainnet balance read.

> **Not yet supported:** smart contract wallets (Safe, Argent, most
> account-abstraction wallets). They sign via a contract and need EIP-1271
> verification. See the note at the foot of `lib/server/wallets/proof.ts`.

### The ledger

Balances are **never a stored, editable number**. A balance is the sum of
immutable double-entry rows, and every transaction must sum to exactly zero per
asset — enforced in `postTransaction` before any write.

That constraint is what makes the books auditable. A mutable balance column can
drift from its history through a partial failure or a stray `UPDATE`, and once
it does there is no way to tell which is right. A sum over an append-only
journal cannot.

- **Exact decimal arithmetic.** Amounts are strings summed via `BigInt` at 1e-18
  scale. JavaScript floats cannot represent `0.1` exactly, and a rounding error
  in a balance is a real loss to a real person.
- **Idempotency keys are mandatory** on every ledger transaction. Retries,
  duplicate webhooks and at-least-once queues are normal; without this a
  redelivered custody webhook credits the same deposit twice.
- **Corrections are new opposing transactions**, never edits — the mistake and
  its reversal both stay visible.
- `verifyLedgerIntegrity()` sums every asset across all accounts. Anything
  non-zero means entries were written outside `postTransaction`. `/api/health`
  reports it; **alert on it**.

Verified with 24 arithmetic checks covering wei-level precision, the balancing
invariant, insufficient-funds by 1 wei, and rejection of malformed amounts.

### Money-movement safety

| Control | Why |
|---|---|
| Deposits credited only at N confirmations | Crediting on detection loses money to chain reorgs |
| Recording a deposit ≠ crediting it | Two deliberate steps, so a misread amount or wrong customer is caught before a balance moves |
| Crediting is idempotent twice over | Row status *and* the ledger's idempotency key. The caller is a button a tired person clicks twice |
| Funds locked at withdrawal *request* | Otherwise concurrent requests each pass their own balance check |
| 2FA re-verified at withdrawal | A hijacked session is the realistic attack |
| Address allow-list + 24h cooling-off | An attacker can add an address but not drain before the owner is alerted |
| Approving ≠ paying | Approval moves nothing; a wrong destination gets one more chance to be caught |
| Approver ≠ requester | Separation of duties |
| Every address checksum-validated | Wrong-network addresses are a permanent loss |

### The deposit model

There is **no custody provider**, and no credentials to configure. The business
holds the receiving accounts — an exchange account, typically — and operators
run the flow:

```
admin records a receiving address        /admin/deposit-addresses
        ↓
admin assigns it to one user             ← the step that makes it visible
        ↓
user sees address + network + memo       /dashboard/deposits
        ↓
user sends funds
        ↓
admin records the arrival                /admin/deposits   (no balance changes)
        ↓
confirmations reach the threshold
        ↓
admin credits it                         (balance moves, once, permanently)
```

**A user sees nothing until an address is assigned to them.** Adding one to the
pool is not enough — that is the single most common point of confusion. Their
deposit screen shows an honest empty state rather than any fallback address.

Addresses are validated on write against the network chosen: EIP-55 checksums
for EVM chains, base58check for Bitcoin, Tron and XRP, bech32/bech32m for segwit,
and a length check for Solana. Chains that need a memo refuse an address without
one. An operator must type the address twice and the two must match.

Nothing here invents an address, ever. A string in that position is a string
somebody sends money to, and a transfer to an address nobody holds keys for is
gone permanently — so the endpoint returns 503 with an explanation rather than a
placeholder, an example, or another account's address.

The honest cost of this model: **crediting a deposit and paying a withdrawal are
human steps.** If nobody is watching `/admin/deposits`, customers' money arrives
and their balances stay at zero. Every action is written to the audit log with
the operator, the amount and the destination.

### Fixed-return investments

Plans may promise a **contractual fixed return** — a debt the business owes at
maturity whatever its own performance was. Four controls make that operable,
all enforced in code:

- **A promise cannot be published unexplained.** A rate requires a term and a
  written source of the money. Blocked in the form, the API schema, and a
  database CHECK constraint.
- **The principal is locked** from subscription to maturity, exactly as a
  pending withdrawal is. One balance cannot back a contract and a withdrawal at
  once.
- **Terms freeze at subscription.** Rate, term, disclosure and the computed
  payout are copied onto the contract. Editing a plan later changes new
  subscriptions only — never a live one.
- **Returns must be funded before they are paid.** Maturity debits
  `platform_treasury` and is *refused* if it cannot cover the amount. That
  refusal is the point: without it the treasury would silently go negative,
  which in plain terms is paying one customer's return out of another's
  deposit. `/admin/investments` shows held, committed and surplus per asset.

`POST /api/cron/maturities` is what actually pays contracts out. **Nothing
matures without it.** Schedule it daily.

### Notifications and consent

Three rules, enforced in code rather than stated in a policy:

- **Security alerts cannot be switched off.** There is no column for it in
  `user_preferences`. They are how someone discovers their account was taken
  over, and an attacker holding a live session would disable them first.
- **Transaction emails are a real switch.** Turning them off genuinely stops
  the notices sent when a deposit is credited or a withdrawal is paid — every
  such send routes through `sendTransactionNotice`, which consults the
  preference first.
- **Consent is opt-in and dated.** Marketing and analytics default to `false`
  with a timestamp recorded when the choice changes, and withdrawing consent
  clears the date. "Had they agreed on this date" is a question that gets
  asked in earnest, and a bare boolean cannot answer it. Changes are audited.

Nothing sends marketing or loads analytics today. The consent record exists so
that whatever is built later has an opt-in to check, and the profile screen
says plainly that the choice is stored rather than implying mail is flowing.

### Security decisions worth knowing

- **Sessions, not JWTs.** Revocation has to be immediate — "sign out all devices"
  must take effect now. That requires server-side state.
- **Secrets stored hashed.** Session tokens, verification tokens and recovery
  codes are SHA-256'd; a database leak yields no usable credential. TOTP secrets
  can't be hashed (the server must reproduce codes), so they're AES-256-GCM
  encrypted with `ENCRYPTION_KEY`.
- **No user enumeration.** Registration, login and password reset return
  identical responses for known and unknown addresses, and login runs a dummy
  Argon2 hash on a miss so response timing doesn't leak either.
- **Rate limiting in Postgres, not memory.** Serverless instances don't share
  memory, so an in-process counter hands every cold start a fresh allowance.
- **Authorization in route handlers.** `requireUser` / `requireAdmin` check the
  database on every request. The server-layout gates (`lib/server/auth-gate.ts`)
  protect *pages*; they are not a substitute and the API never relies on them.
- **Money is `numeric`, never float.** Prices use `numeric(38,12)`.

There is deliberately **no Edge middleware**. It can only see whether a cookie
exists, because the Edge runtime has no database access — the server-layout
gates validate the real session instead.

## Environment variables

With none set the app runs on mock data. Copy `.env.example` to `.env.local` to
change that; for production see [Deployment](#deployment).

See `.env.example` for the full list. The load-bearing ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. **Required** for the backend |
| `ENCRYPTION_KEY` | Encrypts TOTP secrets at rest. **Required**. Rotating it invalidates every enrolled 2FA device |
| `APP_URL` | Absolute origin used to build links inside emails |
| `NEXT_PUBLIC_API_BASE_URL` | `/api` uses this app's route handlers. Empty = pure mock build |
| `MARKET_API_KEY` | CoinGecko key. Server-side only — never reaches the browser |
| `RESEND_API_KEY` / `SMTP_URL` | Configure one. Without either, verification and reset emails are **not sent** |
| `CRON_SECRET` | **Required** if you sell fixed-return plans: protects `POST /api/cron/maturities`, the job that pays matured contracts. Without it that endpoint refuses to run |

**Deposits and withdrawals need no configuration.** There is no custody
provider, no API key and no adapter to select — see
[The deposit model](#the-deposit-model).

Anything prefixed `NEXT_PUBLIC_` is embedded in the client bundle and readable by
every visitor. Never put a secret there.

### Capability flags

`demoMode` is now *derived* — it's true exactly when no backend is configured, so
it cannot contradict reality. The rest are explicit:

| Flag | Enables |
|---|---|
| `NEXT_PUBLIC_LIVE_MARKET_DATA` | Real prices instead of the simulated feed |
| `NEXT_PUBLIC_CUSTODY_ENABLED` | Deposit, withdrawal and ledger-backed screens |
| `NEXT_PUBLIC_TRADING_ENABLED` | Order placement — **leave false**, trading is not implemented |

**Setting a flag does not implement the capability.** It only stops the UI from
saying the capability is missing. Turning on custody while nobody watches
`/admin/deposits` produces a site that invites deposits it will not credit.

`portfolioServiceEnabled` is **hard-coded `false`** in `lib/config.ts`, not an
env flag, because `/api/portfolio` and `/api/investments` do not exist. It is
deliberately separate from `custodyEnabled` so that enabling working deposits
does not silently point the portfolio screens at a 404.

While `custodyEnabled` is off but the backend is live, the portfolio, wallet,
transaction and investment services return **empty** — not sample data. A real
account with no deposits genuinely holds nothing, and showing invented holdings
against a real login would be a fabricated balance.

---

## Project structure

```
app/
  (site)/              Public marketing pages + shared nav/footer layout
    page.tsx           Home
    about, markets, services, investment-plans, pricing,
    faq, contact, security, risk-disclosure, privacy, terms
  (auth)/              Split-screen auth layout
    login, register, forgot-password, verify-email
  dashboard/           Investor app (sidebar + mobile bottom nav)
    page.tsx           Overview
    portfolio, markets, trade, investments, wallet,
    deposits, withdrawals, transactions, profile,
    security, notifications
  admin/               Admin surfaces (behind a server-side role check)
    page.tsx, users, investments, transactions,
    deposit-addresses, deposits, withdrawals,
    plans, market-data, settings
  layout.tsx           Root layout, fonts, metadata
  globals.css          Design tokens, base styles, reduced-motion handling
  sitemap.ts, robots.ts, not-found.tsx, error.tsx

components/
  ui/                  Design system: button, card, badge, input, select, modal,
                       table, tabs, dropdown, tooltip, toast, skeleton,
                       empty-state, reveal, section, asset-icon, demo-notice
  charts/              area-chart, bar-chart, price-chart, allocation-donut,
                       sparkline, chart-tooltip
  layout/              navbar, footer, page-header, demo-banner
  marketing/           hero, hero-visual, features, market-section, services,
                       plans, how-it-works, trading-preview, trust, faq,
                       testimonials, cta, contact-form
  markets/             market-card, market-grid
  trading/             trading-interface (shared by marketing + dashboard)
  dashboard/           sidebar, bottom-nav, dashboard-header, stat-card,
                       holdings-table, transactions-table, transaction-history,
                       wallet-action-modal
  admin/               admin-shell, admin-notice, admin-transactions,
                       deposit-address-manager, deposit-review,
                       withdrawal-review, plan-editor
  brand/               logo (wordmark + original geometric mark)

lib/
  config.ts            Brand, company info, platform flags, navigation
  types.ts             Domain model — the contract between UI and data
  mock-data.ts         Remaining sample data (plans now live in Postgres)
  faq-data.ts          FAQ content (plain module, shared by server + client)
  utils.ts             Formatting, seeded RNG, class merging
  chart-theme.ts       Chart tokens + validated categorical palette
  api/                 Service layer (see below)
```

### Design system

Tokens live in `tailwind.config.ts` and `app/globals.css`:

- **Backgrounds** `#050505` / `#080A07` / `#0B0D09`, **cards** `#0D100C` / `#11140F`
- **Accent** `#B8FF00` / `#C6FF24`, reserved for primary buttons, active states,
  key figures, positive indicators and small accents — not applied broadly
- **Text** `#FFFFFF` / `#E8E8E8`, **muted** `#8C9188`, **borders** `rgba(255,255,255,0.10)`
- **Type** Inter for UI, JetBrains Mono for figures. The `.num` utility applies
  tabular figures so financial columns align.

Rebranding is a single-file change: edit `brand` in `lib/config.ts` and the
wordmark/mark in `components/brand/logo.tsx`.

### Chart colours

`lib/chart-theme.ts` separates two colour jobs:

- **Single-series** marks (portfolio performance, volume, sparklines) use the
  brand lime. One series needs no categorical palette.
- **Categorical** slots (asset allocation) use a fixed, validated order. Every hue
  sits in the OKLCH L 0.48–0.67 band for the dark surface, clears the chroma
  floor, holds ΔE ≥ 8 between adjacent pairs under deuteranopia and tritanopia,
  and passes 3:1 contrast against `#0D100C`.

Do not reorder or substitute those hues without re-validating, and never cycle the
list for extra series.

---

## Mock data and the API layer

**All sample data lives in `lib/mock-data.ts`** (plus `lib/faq-data.ts` for FAQ
copy). It is deterministic — fixed constants and a seeded PRNG — so server render
and client hydration agree.

**No component fetches directly.** Every screen calls a service in `lib/api/`:

| Module | Covers |
|---|---|
| `client.ts` | Transport, `ApiError`, and `withFallback` (live call, else mock) |
| `auth.ts` | Login, register, password reset, email verification |
| `markets.ts` | Assets, quotes, candles, `subscribeToQuotes` |
| `portfolio.ts` | Portfolio, holdings, performance history |
| `investments.ts` | Plans (live) and subscriptions (mock) |
| `transactions.ts` | Filtered, paginated history |
| `wallet.ts` | Balances, deposit address, deposit/withdraw/transfer |
| `deposit-addresses.ts` | The user's assigned addresses; admin pool and assignment |
| `treasury.ts` | Admin deposit recording/crediting and withdrawal approval |
| `plans.ts` | Admin plan CRUD |
| `trading.ts` | Order placement, fee estimates |
| `admin.ts` | Platform stats, user list, volume |

`deposit-addresses.ts`, `treasury.ts` and `plans.ts` deliberately have **no mock
fallback**. A fabricated deposit address, deposit row or plan fee is a figure
someone would act on with real money.

Each function calls `withFallback(live, mock)`: when `NEXT_PUBLIC_API_BASE_URL` is
set it hits the backend, otherwise it returns mock data after a short simulated
latency (so loading states are exercised). Swapping to a real backend is an
implementation change inside `lib/api/*` — no UI component changes.

---

## What must be connected to a real backend

Ordered by risk.

1. **Deposit detection.** Nothing watches the chain or your exchange. Deposits
   are recorded by hand. A webhook or poller would remove the window where
   money has arrived and a balance still reads zero.
2. **Scheduled jobs.** No cron endpoint exists. Market quotes refresh only on
   page load, and `purgeExpiredSessions` / `purgeStaleRateLimits` never run.
3. **Withdrawal controls.** Single approver, no per-approver release limit, no
   sanctions or AML screening on the destination. Add all three before handling
   meaningful volume.
4. **Trading.** `lib/api/trading.ts` returns `executed: false`. Needs venue or
   liquidity integration, order management and a real fee schedule.
5. **Portfolio and investments.** `/api/portfolio` and `/api/investments` do not
   exist; those screens render empty behind `portfolioServiceEnabled`.
6. **Contact form.** `components/marketing/contact-form.tsx` has no endpoint and
   says so rather than reporting a false success.
7. **Persistence** for notification read state. Profile details, password,
   two-factor settings and notification/consent preferences are real. Display
   currency and language are stored but offer one option each — other
   currencies need an exchange-rate source, other languages need translations.
8. **Automated tests.** Verification has been manual and script-driven against a
   live database. There is no test suite in the repo.

---

## Content the client must supply and verify

These render as visible "to be supplied" markers rather than plausible filler, so
nothing ships that reads as verified when it is not. Search for `TODO_CLIENT` in
`lib/config.ts` and `PendingInfo` in the components.

- Legal entity name, company number, registered address, jurisdiction
- Regulatory status — **only** with a reference verifiable on the regulator's own
  public register
- Complete fee schedule
- Support channels, hours and target response times
- Complaints procedure and dispute resolution
- Restricted jurisdictions list
- Custody arrangements and any security audit report
- Verified customer testimonials, with consent to publish

**Never fabricated anywhere in this codebase:** licences, registrations,
approvals, audits, certifications, insurance, partnerships, company addresses,
performance figures, or customer testimonials.

### Legal documents

`/terms`, `/privacy` and `/risk-disclosure` are **structural drafts** showing what
the final documents must cover. Each carries a visible "not yet legally reviewed"
notice. They must be written or reviewed by a qualified lawyer in every
jurisdiction served before launch.

---

## Accessibility and responsiveness

- Semantic landmarks, one `h1` per page, skip-to-content link
- Visible focus rings throughout; modal focus trap with restore; Escape to close
- ARIA labelling on icon-only controls, charts (`role="img"` with a text summary),
  progress bars and live regions
- `prefers-reduced-motion` neutralises all decorative animation
- Verified at 360 / 390 / 414 / 768 / 1024 / 1280 / 1440 px: no horizontal
  overflow and no console errors on any audited page
- Tables become stacked cards below `sm`; sidebar becomes a drawer plus a
  five-item bottom bar; charts resize via `ResponsiveContainer`

---

## Remaining TODOs

- [x] Put `/admin` behind server-side authorisation
- [x] Real authentication, sessions, 2FA, KYC records, admin RBAC
- [x] Live market data with server-side caching
- [x] Transactional email — Resend (HTTP) and SMTP transports, HTML + text
- [x] Double-entry ledger with exact decimal arithmetic and integrity checking
- [x] Wallet, withdrawal and transaction endpoints backed by the ledger
- [x] Removed the custody-provider abstraction in favour of the centralised
      operator-driven model; no third-party keys or credentials anywhere
- [x] Non-custodial prototype — wallet linking by signature proof, live chain
      balance reads, `NEXT_PUBLIC_WALLET_MODEL` to switch models
- [ ] Decide the wallet model with counsel — this gates everything below
- [ ] Non-custodial, if chosen: EIP-1271 for smart contract wallets, ERC-20
      token balances (native only today), dedicated RPC endpoints, an indexer
      for transaction history
- [x] Centralised deposit model — operator-managed receiving addresses,
      per-user assignment, checksum validation per network, and deposit
      crediting gated on confirmations
- [x] Investment plans persisted, with admin CRUD, draft/publish and audited
      term changes
- [x] Admin identity-verification review — approve, reject with a reason,
      suspend and reinstate, with the decision-maker recorded
- [ ] Deposit detection: a webhook or poller, so arrivals are not spotted by eye
- [ ] Withdrawal hardening: dual approval, per-approver limits, sanctions screening
- [ ] Trading: venue integration, order management, fee schedule
- [ ] Portfolio valuation endpoint (ledger + prices)
- [ ] KYC provider webhook to receive decisions asynchronously
- [ ] Grant the audit log INSERT/SELECT only, so the trail cannot be rewritten
- [ ] Scheduled jobs: market refresh, `purgeExpiredSessions`, `purgeStaleRateLimits`
- [ ] Replace remaining mock data in `lib/mock-data.ts`
- [ ] Legal review of terms, privacy and risk disclosure
- [ ] Supply and verify all company, regulatory and fee information
- [x] Open Graph image and favicon, generated at build time from the brand config
- [ ] Wire an error reporter in `app/error.tsx` (currently `console.error`)
- [ ] Automated accessibility (axe) and end-to-end tests
- [ ] Cookie consent, if analytics or marketing cookies are introduced
- [ ] Migrate lint to the ESLint CLI (`next lint` is deprecated in Next.js 16)
