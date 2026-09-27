import type { MetadataRoute } from 'next'
import { brand } from '@/lib/config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private areas: no value to a crawler, and admin must never be indexed.
        disallow: ['/dashboard', '/admin', '/login', '/register', '/forgot-password', '/verify-email'],
      },
    ],
    sitemap: `${brand.url}/sitemap.xml`,
    host: brand.url,
  }
}
