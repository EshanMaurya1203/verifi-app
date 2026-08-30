import { MetadataRoute } from 'next'
import { supabaseServer } from '@/lib/supabase-server'
import { getSiteUrl } from '@/lib/site-url'
import { canStartupBePublic } from '@/lib/visibility'
import { isDemoStartupUserId } from '@/lib/verification-data'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl() || "https://www.verifii.in";

  // 1. Retrieve startups that are marked public
  const { data: startups } = await supabaseServer
    .from('startup_submissions')
    .select('slug, last_verified_at, user_id, verification_status, payment_connected')
    .eq('is_public', true)

  // 2. Filter using canonical visibility rules (excludes unverified, flagged, demo, and private startups)
  const eligibleStartups = (startups || []).filter((s) => {
    if (!s.slug) return false
    if (s.verification_status === 'flagged') return false
    if (isDemoStartupUserId(s.user_id)) return false
    if (!canStartupBePublic(s).eligible) return false
    return true
  })

  const startupUrls = eligibleStartups.map((s) => ({
    url: `${baseUrl}/startup/${encodeURIComponent(s.slug)}/`,
    lastModified: s.last_verified_at ? new Date(s.last_verified_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: `${baseUrl}`,
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
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/what-is-verifii`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/startup-revenue-verification`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/verified-mrr`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/submit`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...startupUrls,
  ]
}

