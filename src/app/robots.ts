import { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl() || "https://www.verifii.in";
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/dashboard', '/feedback'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
