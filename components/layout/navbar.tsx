'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { Button, ButtonLink } from '@/components/ui/button'
import { navLinks } from '@/lib/config'
import { cn } from '@/lib/utils'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the drawer on navigation
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Lock background scroll while the drawer is open
  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-line bg-base/80 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <nav className="container-x flex h-[72px] items-center justify-between gap-6" aria-label="Main">
          <Logo />

          <ul className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              const active = pathname === link.href
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative rounded-lg px-3.5 py-2 text-sm transition-colors',
                      active ? 'text-white' : 'text-muted hover:text-white',
                    )}
                  >
                    {link.label}
                    {active && (
                      <span className="absolute inset-x-3.5 -bottom-0.5 h-px bg-accent" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="hidden items-center gap-3 lg:flex">
            <ButtonLink href="/login" variant="ghost" size="sm">
              Login
            </ButtonLink>
            <ButtonLink href="/register" size="sm">
              Get Started
            </ButtonLink>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </nav>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />

            <motion.div
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="absolute right-0 top-0 flex h-full w-[min(88vw,360px)] flex-col border-l border-line bg-base-800"
            >
              <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-line px-5">
                <Logo />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <ul className="flex-1 space-y-1 overflow-y-auto p-5">
                {navLinks.map((link, index) => (
                  <motion.li
                    key={link.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 + index * 0.05 }}
                  >
                    <Link
                      href={link.href}
                      className={cn(
                        'block rounded-xl px-4 py-3.5 text-[15px] transition-colors',
                        pathname === link.href
                          ? 'bg-accent/10 text-accent'
                          : 'text-white/85 hover:bg-white/[0.05]',
                      )}
                    >
                      {link.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>

              <div className="shrink-0 space-y-3 border-t border-line p-5">
                <ButtonLink href="/login" variant="secondary" fullWidth>
                  Login
                </ButtonLink>
                <ButtonLink href="/register" fullWidth>
                  Get Started
                </ButtonLink>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
