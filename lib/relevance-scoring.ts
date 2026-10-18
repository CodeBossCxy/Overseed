export interface RelevanceWeights {
  bio: number    // default 0.7
  niche: number  // default 0.3
}

export interface RelevanceResult {
  score: number      // 0-100
  bioScore: number   // 0-100 (before weighting)
  nicheScore: number // 0-100 (before weighting)
}

// Common stop words to ignore during scoring
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'and', 'or', 'but', 'not', 'no', 'so', 'if', 'do', 'does', 'did',
  'has', 'have', 'had', 'will', 'would', 'could', 'should', 'may',
  'can', 'this', 'that', 'it', 'i', 'me', 'my', 'we', 'our', 'you',
  'your', 'they', 'them', 'their', 'who', 'what', 'which', 'how',
  'about', 'up', 'out', 'all', 'just', 'also', 'than', 'very',
  'want', 'need', 'looking', 'find', 'search', 'get',
])

export function calculateRelevance(
  query: string,
  bio: string | null,
  nicheTags: string[],
  weights?: Partial<RelevanceWeights>,
): RelevanceResult {
  const bioWeight = weights?.bio ?? 0.7
  const nicheWeight = weights?.niche ?? 0.3

  if (!query.trim()) {
    return { score: 0, bioScore: 0, nicheScore: 0 }
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))

  if (terms.length === 0) {
    return { score: 0, bioScore: 0, nicheScore: 0 }
  }

  // Bio score: term frequency — how densely the bio mentions query terms.
  // A bio mentioning "fashion" 5 times scores higher than one mentioning it once.
  let bioScore = 0
  if (bio && bio.trim().length > 0) {
    const bioLower = bio.toLowerCase()
    const bioWords = bioLower.split(/\s+/)
    let totalHits = 0
    for (const term of terms) {
      // Count occurrences of each term in the bio
      let count = 0
      let idx = 0
      while ((idx = bioLower.indexOf(term, idx)) !== -1) {
        count++
        idx += term.length
      }
      if (count > 0) totalHits += Math.min(count, 5) // cap at 5 per term to avoid spam
    }
    // Normalize: hits per term, scaled by bio length (shorter bios with same hits = more relevant)
    const density = totalHits / terms.length
    // Score: density of 1 = 50, density of 3+ = ~100
    bioScore = Math.min(100, density * 40)
  }

  // Niche score: how many niche tags match query terms, weighted by position
  // (earlier/primary niches are worth more)
  let nicheScore = 0
  if (nicheTags.length > 0) {
    const tagsLower = nicheTags.map((t) => t.toLowerCase())
    let weightedHits = 0
    for (const term of terms) {
      for (let i = 0; i < tagsLower.length; i++) {
        const tag = tagsLower[i]
        if (tag.includes(term) || term.includes(tag)) {
          // Earlier tags (primary niches) get more weight
          const positionWeight = 1 - (i / (tagsLower.length * 2))
          weightedHits += positionWeight
          break // one match per term is enough
        }
      }
    }
    nicheScore = Math.min(100, (weightedHits / terms.length) * 100)
  }

  const score = Math.round(bioScore * bioWeight + nicheScore * nicheWeight)

  return {
    score: Math.min(100, score),
    bioScore: Math.round(bioScore),
    nicheScore: Math.round(nicheScore),
  }
}
