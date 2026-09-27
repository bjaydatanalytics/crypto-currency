import type { MetadataRoute } from 'next'
import { brand } from '@/lib/config'

/**
 * Public routes only.
 *
 * Auth, dashboard and admin routes are deliberately excluded — they are marked
 * noindex in their own metadata and have nothing useful for a crawler.
 */
const routes: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/markets', priority: 0.9, changeFrequency: 'daily' },
  { path: '/services', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/investment-plans', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/security', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/risk-disclosure', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.4, changeFrequency: 'monthly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${brand.url}${path === '/' ? '' : path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
