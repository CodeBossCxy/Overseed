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
 * Score is driven by AI bio relevance — the only dimension that
 * meaningfully differentiates creators after hard API filters.
 */
export function scoreCreator(
  creator: ScoreCreatorInput,
  context: ScoreCreatorContext,
): MatchScoreBreakdown {
  const total = Math.min(100, Math.max(0, creator.ai_relevance ?? 0))

  return {
    total,
    tier: classifyTier(total),
  }
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
