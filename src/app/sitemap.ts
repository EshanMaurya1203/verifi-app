import { MetadataRoute } from 'next'
import { supabaseServer } from '@/lib/supabase-server'
import { getSiteUrl } from '@/lib/site-url'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()

  // 1. Retrieve all startups that have completed dynamic revenue verification
  const { data: startups } = await supabaseServer
    .from('startup_submissions')
    .select('slug, last_verified_at, updated_at')
    .neq('verification_status', 'flagged')

  const startupUrls = (startups || []).map((s) => ({
    url: `${baseUrl}/startup/${s.slug}`,
    lastModified: s.last_verified_at ? new Date(s.last_verified_at) : (s.updated_at ? new Date(s.updated_at) : new Date()),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/submit`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...startupUrls,
  ]
}
