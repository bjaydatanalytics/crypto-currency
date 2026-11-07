import Link from 'next/link'
import { Github, Linkedin, Send, Twitter } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { brand, companyInfo, footerNav, hasCompanyInfo } from '@/lib/config'

const socials = [
  { label: 'X (Twitter)', href: brand.social.x, Icon: Twitter },
  { label: 'LinkedIn', href: brand.social.linkedin, Icon: Linkedin },
  { label: 'GitHub', href: brand.social.github, Icon: Github },
  { label: 'Telegram', href: brand.social.telegram, Icon: Send },
]

export function Footer() {
  return (
    <footer className="border-t border-line bg-base-800">
      <div className="container-x py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:gap-8">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted">{brand.description}</p>

            <ul className="mt-6 flex gap-2">
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-accent/30 hover:text-accent"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {Object.entries(footerNav).map(([heading, links]) => (
            <nav key={heading} aria-label={heading}>
              <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink">
                {heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted">
            <p>
              © {new Date().getFullYear()} {brand.wordmark}. All rights reserved.
            </p>
            {hasCompanyInfo ? (
              <p className="mt-1">
                {companyInfo.legalName}
                {companyInfo.registrationNumber && ` · Reg. ${companyInfo.registrationNumber}`}
                {companyInfo.registeredAddress && ` · ${companyInfo.registeredAddress}`}
              </p>
            ) : (
              <p className="mt-1">
                Company registration, registered address and regulatory details to be supplied and
                verified before launch.
              </p>
            )}
          </div>

          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {footerNav.Legal.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-muted transition-colors hover:text-accent">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
