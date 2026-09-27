import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CandlestickChart,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  PieChart,
  Receipt,
  Settings,
  ShieldCheck,
  TrendingUp,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavEntry {
  label: string
  href: string
  Icon: LucideIcon
}

/** Primary application navigation. */
export const primaryNav: NavEntry[] = [
  { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { label: 'Markets', href: '/dashboard/markets', Icon: LineChart },
  { label: 'Portfolio', href: '/dashboard/portfolio', Icon: PieChart },
  { label: 'Trade', href: '/dashboard/trade', Icon: CandlestickChart },
  { label: 'Investments', href: '/dashboard/investments', Icon: TrendingUp },
  { label: 'Wallet', href: '/dashboard/wallet', Icon: Wallet },
  { label: 'Transactions', href: '/dashboard/transactions', Icon: Receipt },
]

/** Money movement — grouped separately so it reads as a distinct concern. */
export const transferNav: NavEntry[] = [
  { label: 'Deposits', href: '/dashboard/deposits', Icon: ArrowDownToLine },
  { label: 'Withdrawals', href: '/dashboard/withdrawals', Icon: ArrowUpFromLine },
]

export const secondaryNav: NavEntry[] = [
  { label: 'Support', href: '/dashboard/support', Icon: LifeBuoy },
  { label: 'Security', href: '/dashboard/security', Icon: ShieldCheck },
  { label: 'Profile', href: '/dashboard/profile', Icon: User },
  { label: 'Settings', href: '/dashboard/profile#settings', Icon: Settings },
]

/** Mobile bottom bar — five destinations is the practical maximum. */
export const mobileNav: NavEntry[] = [
  { label: 'Home', href: '/dashboard', Icon: LayoutDashboard },
  { label: 'Markets', href: '/dashboard/markets', Icon: LineChart },
  { label: 'Trade', href: '/dashboard/trade', Icon: ArrowLeftRight },
  { label: 'Portfolio', href: '/dashboard/portfolio', Icon: PieChart },
  { label: 'Wallet', href: '/dashboard/wallet', Icon: Wallet },
]
