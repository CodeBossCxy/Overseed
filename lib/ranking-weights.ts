// Creator match scoring — uses AI bio relevance as the primary signal.
// Country and follower range are hard-filtered at the CreatorDB API level,
// so they don't need scoring. The composite score maps to ai_relevance
// for backward compatibility with frontend sorting.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MatchScoreBreakdown {
  total: number // 0-100 composite score
  tier: 'excellent' | 'strong' | 'potential' | 'low'
}

// ── Tier classification ─────────────────────────────────────────────────────

function classifyTier(score: number): MatchScoreBreakdown['tier'] {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'strong'
  if (score >= 40) return 'potential'
  return 'low'
}

// ── Main scoring function ───────────────────────────────────────────────────

export interface ScoreCreatorInput {
  // From search results
  niche_tags?: string[]
  bio?: string | null
  engagement_rate?: number | null
  follower_count?: number | null
  country?: string | null
  platform: string
  // From AI scoring
  ai_relevance?: number | null // AI bio score (0-100)
}

export interface ScoreCreatorContext {
  objective?: string | null
}

/**
 * Compute a match score for a creator against campaign context.
 * Uses multiple signals: AI bio relevance (when available),
 * engagement rate, niche diversity, and bio presence.
 */
export function scoreCreator(
  creator: ScoreCreatorInput,
  context: ScoreCreatorContext,
): MatchScoreBreakdown {
  // If AI bio score is available, use it as the primary signal (0-100)
  if (creator.ai_relevance != null && creator.ai_relevance > 0) {
    const total = Math.min(100, Math.max(0, creator.ai_relevance))
    return { total, tier: classifyTier(total) }
  }

  // Otherwise, compute from available signals
  let score = 0

  // Engagement rate: strong signal of creator quality (0-35 points)
  const er = creator.engagement_rate
  if (er != null && er > 0) {
    if (er >= 5) score += 35
    else if (er >= 3) score += 28
    else if (er >= 1.5) score += 20
    else if (er >= 0.5) score += 12
    else score += 5
  }

  // Niche tags present: indicates categorizable creator (0-25 points)
  const niches = creator.niche_tags?.length ?? 0
  if (niches >= 5) score += 25
  else if (niches >= 3) score += 20
  else if (niches >= 1) score += 12

  // Bio present and meaningful: shows active profile (0-20 points)
  const bioLen = creator.bio?.trim()?.length ?? 0
  if (bioLen >= 100) score += 20
  else if (bioLen >= 30) score += 14
  else if (bioLen > 0) score += 7

  // Follower count in sweet spot (0-20 points)
  const fc = creator.follower_count ?? 0
  if (fc >= 10000 && fc <= 500000) score += 20       // mid-tier — best for collabs
  else if (fc >= 1000 && fc <= 1000000) score += 14   // reasonable range
  else if (fc > 0) score += 7

  const total = Math.min(100, Math.max(0, score))
  return { total, tier: classifyTier(total) }
}

/**
 * Score and sort a batch of creators. Returns the original array with
 * `match_score` and `match_breakdown` attached to each result.
 */
export function scoreAndRankCreators<T extends ScoreCreatorInput>(
  creators: T[],
  context: ScoreCreatorContext,
): (T & { match_score: number; match_breakdown: MatchScoreBreakdown })[] {
  return creators
    .map((c) => {
      const breakdown = scoreCreator(c, context)
      return { ...c, match_score: breakdown.total, match_breakdown: breakdown }
    })
    .sort((a, b) => b.match_score - a.match_score)
}
