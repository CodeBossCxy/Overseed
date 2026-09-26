// AI-powered creator selection for mass outreach campaigns.
// 1. Queries CreatorProfile cache first (free), then Influencers Club (costs credits)
// 2. Uses AI to score/rank creators by relevance to brand's brief
// 3. Enforces anti-spam guards (no creator contacted >3x in 30 days)

import OpenAI from 'openai'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface OutreachCriteria {
  platform: 'instagram' | 'youtube' | 'tiktok'
  niche?: string
  country?: string
  minFollowers?: number
  maxFollowers?: number
  language?: string
  keywords?: string[]
}

export interface ScoredCreator {
  creatorProfileId: string
  platform: string
  handle: string
  displayName: string | null
  email: string | null
  avatarUrl: string | null
  followerCount: number | null
  engagementRate: number | null
  matchScore: number
  matchReason: string
}

// ── Deepseek client ────────────────────────────────────────────────────────────

function deepseekClient() {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  })
}

// ── Heuristic fallback score ───────────────────────────────────────────────────

function heuristicScore(followerCount: number | null, engagementRate: number | null): number {
  let score = 40
  if (followerCount != null) {
    if (followerCount >= 1_000_000) score += 30
    else if (followerCount >= 100_000) score += 20
    else if (followerCount >= 10_000) score += 10
  }
  if (engagementRate != null) {
    const r = Number(engagementRate)
    if (r >= 5) score += 30
    else if (r >= 3) score += 20
    else if (r >= 1) score += 10
  }
  return Math.min(score, 100)
}

// ── AI scoring ─────────────────────────────────────────────────────────────────

interface CreatorForScoring {
  handle: string
  niche: string[]
  followers: number | null
  country: string | null
  bio: string | null
  engagementRate: number | null
}

interface AiScoreResult {
  handle: string
  score: number
  reason: string
}

function criteriaSummary(criteria: OutreachCriteria): string {
  const parts: string[] = [`platform: ${criteria.platform}`]
  if (criteria.niche) parts.push(`niche: ${criteria.niche}`)
  if (criteria.country) parts.push(`country: ${criteria.country}`)
  if (criteria.language) parts.push(`language: ${criteria.language}`)
  if (criteria.minFollowers != null) parts.push(`min followers: ${criteria.minFollowers}`)
  if (criteria.maxFollowers != null) parts.push(`max followers: ${criteria.maxFollowers}`)
  if (criteria.keywords?.length) parts.push(`keywords: ${criteria.keywords.join(', ')}`)
  return parts.join(', ')
}

async function scoreCreatorsBatch(
  brandBrief: string,
  criteria: OutreachCriteria,
  creators: CreatorForScoring[]
): Promise<AiScoreResult[]> {
  const client = deepseekClient()
  const creatorList = creators
    .map(
      (c, i) =>
        `${i + 1}. @${c.handle} | niche: ${c.niche.join(', ') || 'unknown'} | followers: ${c.followers ?? 'unknown'} | engagement: ${c.engagementRate != null ? `${c.engagementRate}%` : 'unknown'} | country: ${c.country || 'unknown'} | bio: ${c.bio ? c.bio.slice(0, 100) : 'none'}`
    )
    .join('\n')

  const prompt = `You are a creator-brand matching engine. Score each creator 0-100 on how well they match this brand's outreach brief.

Brand brief: "${brandBrief}"
Target criteria: ${criteriaSummary(criteria)}

Creators to score:
${creatorList}

Return JSON array: [{ "handle": "...", "score": 0-100, "reason": "1 sentence" }]`

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })

  const raw = response.choices[0]?.message?.content ?? ''
  const parsed = JSON.parse(raw)
  const arr: any[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.results) ? parsed.results : [])

  return arr
    .filter((item) => typeof item?.handle === 'string' && typeof item?.score === 'number')
    .map((item) => ({
      handle: item.handle,
      score: Math.max(0, Math.min(100, Math.round(item.score))),
      reason: typeof item.reason === 'string' ? item.reason.slice(0, 300) : '',
    }))
}

async function scoreCreators(
  brandBrief: string,
  criteria: OutreachCriteria,
  creators: CreatorForScoring[]
): Promise<Map<string, AiScoreResult>> {
  const BATCH_SIZE = 20
  const results = new Map<string, AiScoreResult>()

  for (let i = 0; i < creators.length; i += BATCH_SIZE) {
    const batch = creators.slice(i, i + BATCH_SIZE)
    try {
      const scored = await scoreCreatorsBatch(brandBrief, criteria, batch)
      for (const s of scored) {
        results.set(s.handle.toLowerCase(), s)
      }
    } catch (err) {
      console.error('outreach-ai: Deepseek scoring failed, using heuristic fallback', err)
      for (const c of batch) {
        results.set(c.handle.toLowerCase(), {
          handle: c.handle,
          score: heuristicScore(c.followers, c.engagementRate),
          reason: 'Score based on follower count and engagement rate.',
        })
      }
    }
  }

  return results
}

// ── upsertCreatorProfile ───────────────────────────────────────────────────────

type CreatorProfileData = {
  displayName?: string | null
  avatarUrl?: string | null
  bio?: string | null
  email?: string | null
  followerCount?: number | null
  engagementRate?: number | null
  country?: string | null
  language?: string | null
  nicheTags?: string[]
  audienceDemographics?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null
  contentCategories?: string[]
  avgViews?: number | null
  avgLikes?: number | null
}

export async function upsertCreatorProfile(
  platform: string,
  handle: string,
  data: CreatorProfileData
): Promise<string> {
  const now = new Date()
  const existing = await prisma.creatorProfile.findUnique({
    where: { platform_handle: { platform, handle: handle.toLowerCase() } },
    select: { id: true },
  })

  if (existing) {
    await prisma.creatorProfile.update({
      where: { id: existing.id },
      data: {
        lastRefreshedAt: now,
        refreshCount: { increment: 1 },
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.followerCount !== undefined && { followerCount: data.followerCount }),
        ...(data.engagementRate !== undefined && { engagementRate: data.engagementRate }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.language !== undefined && { language: data.language }),
        ...(data.nicheTags !== undefined && { nicheTags: data.nicheTags }),
        ...(data.audienceDemographics !== undefined && {
          audienceDemographics: data.audienceDemographics ?? Prisma.DbNull,
        }),
        ...(data.contentCategories !== undefined && { contentCategories: data.contentCategories }),
        ...(data.avgViews !== undefined && { avgViews: data.avgViews }),
        ...(data.avgLikes !== undefined && { avgLikes: data.avgLikes }),
      },
    })
    return existing.id
  }

  const created = await prisma.creatorProfile.create({
    data: {
      platform,
      handle: handle.toLowerCase(),
      firstSeenAt: now,
      lastRefreshedAt: now,
      displayName: data.displayName ?? null,
      avatarUrl: data.avatarUrl ?? null,
      bio: data.bio ?? null,
      email: data.email ?? null,
      followerCount: data.followerCount ?? null,
      engagementRate: data.engagementRate ?? null,
      country: data.country ?? null,
      language: data.language ?? null,
      nicheTags: data.nicheTags ?? [],
      audienceDemographics: data.audienceDemographics ?? Prisma.DbNull,
      contentCategories: data.contentCategories ?? [],
      avgViews: data.avgViews ?? null,
      avgLikes: data.avgLikes ?? null,
    },
    select: { id: true },
  })
  return created.id
}

// ── markCreatorContacted ───────────────────────────────────────────────────────

export async function markCreatorContacted(creatorProfileId: string): Promise<void> {
  await prisma.creatorProfile.update({
    where: { id: creatorProfileId },
    data: {
      lastContactedAt: new Date(),
      contactCount: { increment: 1 },
    },
  })
}

// ── selectCreators ─────────────────────────────────────────────────────────────

export async function selectCreators(
  brandBrief: string,
  criteria: OutreachCriteria,
  quantity: number,
  excludeHandles: string[] = []
): Promise<ScoredCreator[]> {
  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const excludeSet = new Set(excludeHandles.map((h) => h.toLowerCase()))

  // ── Step 1: query CreatorProfile cache ──────────────────────────────────────
  const cachedProfiles = await prisma.creatorProfile.findMany({
    where: {
      platform: criteria.platform,
      email: { not: null },
      NOT: [
        // contacted within 14 days
        { lastContactedAt: { gte: fourteenDaysAgo } },
        // contacted 3+ times in the last 30 days
        { AND: [{ contactCount: { gte: 3 } }, { lastContactedAt: { gte: thirtyDaysAgo } }] },
      ],
      ...(criteria.country ? { country: criteria.country } : {}),
      ...(criteria.language ? { language: criteria.language } : {}),
      ...(criteria.minFollowers != null || criteria.maxFollowers != null
        ? {
            followerCount: {
              ...(criteria.minFollowers != null ? { gte: criteria.minFollowers } : {}),
              ...(criteria.maxFollowers != null ? { lte: criteria.maxFollowers } : {}),
            },
          }
        : {}),
      ...(criteria.niche
        ? { nicheTags: { has: criteria.niche } }
        : {}),
    },
    take: Math.ceil(quantity * 3),
  })

  const filtered = cachedProfiles.filter((p) => !excludeSet.has(p.handle.toLowerCase()))

  // ── Step 2: supplement with Influencers Club if cache is thin ───────────────
  const threshold = quantity * 1.5
  if (filtered.length < threshold) {
    try {
      const { clubSearch, clubEnrich } = await import('@/lib/influencers-club')

      const searchResult = await clubSearch({
        platform: criteria.platform,
        query: [criteria.niche, ...(criteria.keywords ?? [])].filter(Boolean).join(' ') || undefined,
        country: criteria.country,
        minFollowers: criteria.minFollowers,
        maxFollowers: criteria.maxFollowers,
        language: criteria.language,
        limit: Math.min(50, quantity * 2),
      })

      const clubCreators: Array<{ handle: string; [k: string]: any }> = Array.isArray(
        searchResult?.results
      )
        ? searchResult.results
        : []

      // Enrich top results to get emails
      const toEnrich = clubCreators
        .filter((c) => c?.handle && !excludeSet.has(String(c.handle).toLowerCase()))
        .slice(0, Math.ceil(quantity * 2))

      await Promise.allSettled(
        toEnrich.map(async (c) => {
          try {
            const detail = await clubEnrich(criteria.platform, c.handle)
            const email: string | null = detail?.email ?? null
            if (!email) return

            const handle = String(c.handle).toLowerCase()
            // Check if already in filtered set
            if (filtered.some((p) => p.handle === handle)) return

            const id = await upsertCreatorProfile(criteria.platform, handle, {
              displayName: detail?.name ?? c.name ?? null,
              avatarUrl: detail?.avatar_url ?? c.avatar_url ?? null,
              bio: detail?.bio ?? null,
              email,
              followerCount:
                typeof (detail?.followers ?? c.followers) === 'number'
                  ? detail?.followers ?? c.followers
                  : null,
              engagementRate:
                typeof (detail?.engagement_rate ?? c.engagement_rate) === 'number'
                  ? detail?.engagement_rate ?? c.engagement_rate
                  : null,
              country: detail?.location ?? c.country ?? null,
              language: detail?.language ?? c.language ?? null,
              nicheTags: Array.isArray(detail?.niche) ? detail.niche : [],
              contentCategories: Array.isArray(detail?.content_categories)
                ? detail.content_categories
                : [],
              avgViews: typeof detail?.avg_views === 'number' ? detail.avg_views : null,
              avgLikes: typeof detail?.avg_likes === 'number' ? detail.avg_likes : null,
            })

            // Add synthetic record to filtered pool
            filtered.push({
              id,
              platform: criteria.platform,
              handle,
              displayName: detail?.name ?? c.name ?? null,
              avatarUrl: detail?.avatar_url ?? c.avatar_url ?? null,
              bio: detail?.bio ?? null,
              email,
              followerCount:
                typeof (detail?.followers ?? c.followers) === 'number'
                  ? detail?.followers ?? c.followers
                  : null,
              engagementRate:
                typeof (detail?.engagement_rate ?? c.engagement_rate) === 'number'
                  ? detail?.engagement_rate ?? c.engagement_rate
                  : null,
              country: detail?.location ?? c.country ?? null,
              language: detail?.language ?? c.language ?? null,
              nicheTags: Array.isArray(detail?.niche) ? detail.niche : [],
              audienceDemographics: null,
              contentCategories: Array.isArray(detail?.content_categories)
                ? detail.content_categories
                : [],
              avgViews: typeof detail?.avg_views === 'number' ? detail.avg_views : null,
              avgLikes: typeof detail?.avg_likes === 'number' ? detail.avg_likes : null,
              lastContactedAt: null,
              contactCount: 0,
              firstSeenAt: new Date(),
              lastRefreshedAt: new Date(),
              refreshCount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any)
          } catch (err) {
            console.error('outreach-ai: clubEnrich failed for', c.handle, err)
          }
        })
      )
    } catch (err) {
      console.error('outreach-ai: clubSearch supplement failed', err)
    }
  }

  if (filtered.length === 0) return []

  // ── Step 3: AI scoring ───────────────────────────────────────────────────────
  const forScoring: CreatorForScoring[] = filtered.map((p) => ({
    handle: p.handle,
    niche: [...(p.nicheTags ?? []), ...(p.contentCategories ?? [])],
    followers: p.followerCount,
    country: p.country,
    bio: p.bio ?? null,
    engagementRate: p.engagementRate != null ? Number(p.engagementRate) : null,
  }))

  const scoreMap = await scoreCreators(brandBrief, criteria, forScoring)

  // ── Step 4: sort and return top `quantity` ───────────────────────────────────
  const scored: ScoredCreator[] = filtered.map((p) => {
    const aiResult = scoreMap.get(p.handle.toLowerCase())
    const score = aiResult?.score ?? heuristicScore(p.followerCount, p.engagementRate != null ? Number(p.engagementRate) : null)
    const reason = aiResult?.reason ?? 'Score based on follower count and engagement rate.'
    return {
      creatorProfileId: p.id,
      platform: p.platform,
      handle: p.handle,
      displayName: p.displayName ?? null,
      email: p.email ?? null,
      avatarUrl: p.avatarUrl ?? null,
      followerCount: p.followerCount ?? null,
      engagementRate: p.engagementRate != null ? Number(p.engagementRate) : null,
      matchScore: score,
      matchReason: reason,
    }
  })

  scored.sort((a, b) => b.matchScore - a.matchScore)
  return scored.slice(0, quantity)
}
