// Shared helpers for the KOL discovery proxy routes.

import { prisma } from '@/lib/prisma'

export const KOL_API_URL = process.env.KOL_API_URL || 'http://localhost:8000'

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g

// Brands must not see creator contact info: drop contact_email entirely and
// redact addresses that appear inside free-text fields like the bio.
export function sanitizeCreator(creator: Record<string, any>) {
  const { contact_email, ...rest } = creator
  if (typeof rest.bio === 'string') {
    rest.bio = rest.bio.replace(EMAIL_RE, '•••')
  }
  return rest
}

export function sanitizeResults<T extends { results?: any[] }>(data: T): T {
  if (Array.isArray(data?.results)) {
    data.results = data.results.map(sanitizeCreator)
  }
  return data
}

// Production-safe fallback when the optional KOL service is offline. This
// searches verified Overseed creator profiles and intentionally exposes no
// email, phone, or other contact fields.
export async function localCreatorDiscovery(params: URLSearchParams, search = false) {
  const platform = (params.get('platform') || params.get('platforms')?.split(',')[0] || '').toLowerCase()
  const country = params.get('country')?.trim()
  const query = (params.get('q') || params.get('topics') || '').trim()
  const min = Number(params.get('min_followers') || 0)
  const max = Number(params.get('max_followers') || 0)
  const limit = Math.min(Math.max(Number(params.get('limit') || 50), 1), 50)
  const offset = Math.max(Number(params.get('offset') || 0), 0)

  const accountWhere: any = {}
  if (platform) accountWhere.platform = { slug: platform }
  if (min || max) accountWhere.followerCount = {
    ...(min ? { gte: min } : {}),
    ...(max ? { lte: max } : {}),
  }

  let profiles: any[]
  try {
    profiles = await prisma.influencerProfile.findMany({
      where: {
        user: { profileDiscoverable: true, isActive: true },
        ...(country ? { locationCountry: { equals: country, mode: 'insensitive' } } : {}),
        ...(Object.keys(accountWhere).length ? { socialAccounts: { some: accountWhere } } : {}),
        ...(query ? {
          OR: [
            { displayName: { contains: query, mode: 'insensitive' } },
            { bio: { contains: query, mode: 'insensitive' } },
            { primaryNiche: { contains: query, mode: 'insensitive' } },
            { secondaryNiches: { has: query } },
            { user: { name: { contains: query, mode: 'insensitive' } } },
            { socialAccounts: { some: { username: { contains: query, mode: 'insensitive' } } } },
          ],
        } : {}),
      },
      include: {
        user: { select: { name: true, image: true } },
        socialAccounts: {
          where: accountWhere,
          include: { platform: true },
          orderBy: { followerCount: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
    })
  } catch (error) {
    // Compatibility path for deployments whose settings migration has not
    // reached the database yet. Use only long-established profile columns,
    // then apply the filters in memory.
    console.warn('Full local creator query failed; using compatibility query:', error)
    const candidates = await prisma.influencerProfile.findMany({
      include: {
        user: { select: { name: true, image: true } },
        socialAccounts: { include: { platform: true }, orderBy: { followerCount: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.max(limit + offset, 50),
    })
    const q = query.toLowerCase()
    profiles = candidates.filter(profile => {
      const accountMatch = profile.socialAccounts.some(account =>
        (!platform || account.platform.slug === platform) &&
        (!min || account.followerCount >= min) &&
        (!max || account.followerCount <= max)
      )
      const text = [profile.displayName, profile.user.name, profile.bio, profile.primaryNiche, ...profile.secondaryNiches, ...profile.socialAccounts.map(a => a.username)].filter(Boolean).join(' ').toLowerCase()
      return accountMatch && (!country || profile.locationCountry?.toLowerCase() === country.toLowerCase()) && (!q || text.includes(q))
    }).slice(offset, offset + limit).map(profile => ({
      ...profile,
      socialAccounts: profile.socialAccounts.filter(account =>
        (!platform || account.platform.slug === platform) &&
        (!min || account.followerCount >= min) &&
        (!max || account.followerCount <= max)
      ),
    }))
  }

  const results = profiles.flatMap(profile => {
    const account = profile.socialAccounts[0]
    if (!account) return []
    return [{
      id: `overseed:${profile.id}:${account.id}`,
      platform: account.platform.slug,
      handle: account.username,
      display_name: profile.displayName || profile.user.name,
      bio: profile.bio ? sanitizeCreator({ bio: profile.bio }).bio : null,
      country: profile.locationCountry,
      follower_count: account.followerCount,
      engagement_rate: account.engagementRate == null ? null : Number(account.engagementRate),
      niche_tags: [profile.primaryNiche, ...profile.secondaryNiches].filter(Boolean),
      profile_url: `/influencer/${profile.id}`,
      avatar_url: profile.avatarUrl || profile.user.image,
      score: null,
    }]
  })

  return {
    results,
    platform_coverage: platform ? { [platform]: 'overseed_index' } : {},
    warnings: search ? ['External discovery is temporarily offline; showing creators registered on Overseed.'] : [],
    cache_hits: results.length,
    live_calls: 0,
    fallback: true,
  }
}

export async function safeLocalCreatorDiscovery(params: URLSearchParams, search = false) {
  try {
    return await localCreatorDiscovery(params, search)
  } catch (error) {
    console.error('Overseed creator index fallback failed:', error)
    return {
      results: [],
      platform_coverage: {},
      warnings: ['Creator search is online, but no matching indexed creators are available yet.'],
      cache_hits: 0,
      live_calls: 0,
      fallback: true,
    }
  }
}
