/**
 * Central brand + platform configuration.
 *
 * Everything that identifies the business lives here so the placeholder brand
 * ("NEXORA") can be swapped for the real one by editing a single file.
 *
 * NOTE: Fields marked TODO_CLIENT are deliberately empty. They must be filled
 * with information the client has verified. Do not invent company addresses,
 * licence numbers, registrations or partnerships.
 */

export const brand = {
  name: 'Nexora',
  wordmark: 'NEXORA',
  tagline: 'Smarter digital asset investing',
  description:
    'Explore digital assets, monitor market movements and manage your portfolio through a modern financial platform.',
  /** Used for canonical URLs, sitemap and Open Graph. Override with NEXT_PUBLIC_SITE_URL. */
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://nexora.example',
  email: 'support@nexora.example', // TODO_CLIENT: replace with a monitored mailbox
  social: {
    x: '#',
    linkedin: '#',
    github: '#',
    telegram: '#',
  },
} as const

/**
 * Company / legal details.
 * Intentionally blank — these must come from the client's verified records.
 */
export const companyInfo = {
  legalName: '', // TODO_CLIENT
  registrationNumber: '', // TODO_CLIENT
  registeredAddress: '', // TODO_CLIENT
  jurisdiction: '', // TODO_CLIENT
  /**
   * Regulatory status. Leave empty unless the client supplies a licence that
   * has been verified against the regulator's public register.
   */
  regulatoryStatus: '', // TODO_CLIENT
  supportHours: '', // TODO_CLIENT
} as const

/** Is any verified company information available yet? Drives placeholder UI. */
export const hasCompanyInfo = Object.values(companyInfo).some((v) => v.length > 0)

/**
 * Capability flags.
 *
 * These are separate on purpose. A deployment can have real accounts and real
 * prices while custody and trading remain unavailable, and the UI has to say
 * exactly that — not "everything is a demo" (untrue, the account is real) and
 * not nothing at all (untrue, deposits don't work).
 *
 * Each flag must reflect what is genuinely wired up. Turning one on without the
 * integration behind it produces an interface that lies to its users.
 */

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ''

export const platform = {
  /** Base URL of the backend. "/api" uses the route handlers in this app. */
  apiBaseUrl,

  /**
   * True when no backend is configured at all — the pure mock build.
   * Derived rather than hand-set so it cannot contradict reality.
   */
  demoMode: apiBaseUrl.length === 0,

  /** Accounts, sessions and KYC are backed by a real database. */
  authEnabled: apiBaseUrl.length > 0,

  /** Prices come from a licensed provider rather than a simulated feed. */
  liveMarketData: process.env.NEXT_PUBLIC_LIVE_MARKET_DATA === 'true',

  /**
   * Deposits, withdrawals and the ledger behind them.
   *
   * The model is centralised and operator-driven: the business holds the
   * receiving accounts, an admin records and assigns the addresses, credits
   * deposits once confirmed, and pays withdrawals by hand. There is no
   * third-party custodian and nothing to configure credentials for.
   *
   * Enable this only when an operator is genuinely watching /admin/deposits.
   * The interface promises that deposits will be credited; in this model that
   * promise is kept by a person, not a webhook.
   */
  custodyEnabled: process.env.NEXT_PUBLIC_CUSTODY_ENABLED === 'true',

  /**
   * Portfolio analytics and investment plan subscriptions.
   *
   * Hard-coded false, not an env flag, because the `/portfolio` and
   * `/investments` endpoints do not exist — there is nothing to turn on. It is
   * separate from `custodyEnabled` so that shipping working deposits does not
   * silently switch these screens from "unavailable" to calling a 404.
   */
  portfolioServiceEnabled: false,

  /**
   * Order placement against a real venue.
   * Requires custody plus a liquidity arrangement.
   */
  tradingEnabled: process.env.NEXT_PUBLIC_TRADING_ENABLED === 'true',

  /**
   * Which wallet model the product runs.
   *
   * 'custodial'     — the platform holds keys via a custodian; balances come
   *                   from the internal ledger. Needs a custody licence in most
   *                   jurisdictions.
   * 'non-custodial' — the user holds keys; balances are read from chain. The
   *                   platform can never move funds.
   *
   * These are alternatives, not layers. Both are implemented; this picks which
   * the UI uses. The choice is a legal one before it is a technical one.
   */
  walletModel:
    process.env.NEXT_PUBLIC_WALLET_MODEL === 'non-custodial'
      ? ('non-custodial' as const)
      : ('custodial' as const),
} as const

export const isNonCustodial = platform.walletModel === 'non-custodial'

export const navLinks = [
  { label: 'Markets', href: '/markets' },
  { label: 'Services', href: '/services' },
  { label: 'Investment Plans', href: '/investment-plans' },
  { label: 'About', href: '/about' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
] as const

export const footerNav = {
  Product: [
    { label: 'Markets', href: '/markets' },
    { label: 'Trading', href: '/services#spot-trading' },
    { label: 'Portfolio', href: '/services#portfolio-management' },
    { label: 'Investment Plans', href: '/investment-plans' },
    { label: 'Pricing', href: '/pricing' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Security', href: '/security' },
    { label: 'Contact', href: '/contact' },
    { label: 'FAQ', href: '/faq' },
  ],
  Legal: [
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Risk Disclosure', href: '/risk-disclosure' },
  ],
  Resources: [
    { label: 'Help Center', href: '/contact' },
    { label: 'Documentation', href: '/faq' },
    { label: 'API', href: '/faq#api' },
  ],
} as const
