import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CandlestickChart,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  PieChart,
  PiggyBank,
  Receipt,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavEntry {
  label: string
  href: string
  Icon: LucideIcon
  /**
   * Marks a destination with no feature behind it yet.
   *
   * The sidebar renders these with a "Soon" tag so the panel never implies a
   * capability the platform does not have. Remove the flag when the feature
   * ships — the nav entry itself does not change.
   */
  planned?: boolean
}

/**
 * Primary navigation, in the order the customer panel presents it.
 *
 * Money movement sits directly under the portfolio entries because that is the
 * path most sessions take: check the balance, then act on it.
 */
export const primaryNav: NavEntry[] = [
  { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { label: 'Investments', href: '/dashboard/investments', Icon: TrendingUp },
  { label: '401k', href: '/dashboard/401k', Icon: PiggyBank },
  { label: 'Deposit', href: '/dashboard/deposits', Icon: ArrowDownToLine },
  { label: 'Withdraw', href: '/dashboard/withdrawals', Icon: ArrowUpFromLine },
  {
    label: 'Transfer Balance',
    href: '/dashboard/transfer',
    Icon: ArrowLeftRight,
    planned: true,
  },
  { label: 'Transactions', href: '/dashboard/transactions', Icon: Receipt },
  { label: 'Referrals', href: '/dashboard/referrals', Icon: Users, planned: true },
  { label: 'Support Ticket', href: '/dashboard/support', Icon: LifeBuoy },
]

/**
 * Markets and custody.
 *
 * Grouped separately rather than dropped: these pages are built and working,
 * and removing their only entry point would strand them. Kept below the main
 * list so the primary path stays as short as the design intends.
 */
export const marketsNav: NavEntry[] = [
  { label: 'Markets', href: '/dashboard/markets', Icon: LineChart },
  { label: 'Portfolio', href: '/dashboard/portfolio', Icon: PieChart },
  { label: 'Trade', href: '/dashboard/trade', Icon: CandlestickChart },
  { label: 'Wallet', href: '/dashboard/wallet', Icon: Wallet },
]

/** Account settings. */
export const secondaryNav: NavEntry[] = [
  { label: '2FA', href: '/dashboard/security#two-factor', Icon: ShieldCheck },
  { label: 'Profile', href: '/dashboard/profile', Icon: User },
  { label: 'Change Password', href: '/dashboard/security#password', Icon: KeyRound },
]

/** Mobile bottom bar — five destinations is the practical maximum. */
export const mobileNav: NavEntry[] = [
  { label: 'Home', href: '/dashboard', Icon: LayoutDashboard },
  { label: 'Invest', href: '/dashboard/investments', Icon: TrendingUp },
  { label: 'Deposit', href: '/dashboard/deposits', Icon: ArrowDownToLine },
  { label: 'Withdraw', href: '/dashboard/withdrawals', Icon: ArrowUpFromLine },
  { label: 'History', href: '/dashboard/transactions', Icon: Receipt },
]
