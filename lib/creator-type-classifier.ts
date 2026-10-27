// Heuristic creator type classification using available signals.
// CreatorDB does NOT provide a native business/individual flag, so we
// infer it from bio text, username patterns, and category metadata.
// Results should be treated as estimates — low-confidence classifications
// should not be used to exclude creators.

export type CreatorType = 'individual' | 'professional' | 'media' | 'business' | 'unknown'

export interface CreatorTypeResult {
  type: CreatorType
  confidence: number // 0-1
  signals: string[]
}

// ── Signal patterns ───────────────────────────────────────────────────────────

const BUSINESS_BIO_PATTERNS = [
  /\b(?:official|oficial|公式)\b/i,
  /\b(?:shop|store|loja|tienda|商店|店铺)\b/i,
  /\b(?:brand|marca|品牌)\b/i,
  /\b(?:company|empresa|公司)\b/i,
  /\b(?:agency|agência|agencia|代理)\b/i,
  /\b(?:wholesale|atacado|批发)\b/i,
  /\b(?:shipping|envio|发货|包邮)\b/i,
  /\b(?:order|pedido|下单|订购)\s*(?:now|here|aqui|👇|⬇)/i,
  /\b(?:dm\s*(?:to|for|para)\s*(?:order|buy|purchase|comprar))/i,
  /(?:www\.|https?:\/\/)\S+\.(?:com|shop|store)/i,
  /\b(?:CEO|founder|fundador|创始人|COO|CTO)\b/i,
]

const MEDIA_BIO_PATTERNS = [
  /\b(?:news|noticias|notícias|新闻)\b/i,
  /\b(?:magazine|revista|杂志)\b/i,
  /\b(?:media|mídia|媒体)\b/i,
  /\b(?:community|comunidade|comunidad|社区)\b/i,
  /\b(?:fan\s*page|fanpage|粉丝页)\b/i,
  /\b(?:memes?|viral|trending)\b/i,
  /\b(?:compilation|repost|转发|搬运)\b/i,
  /\b(?:daily|diário|diario|每日)\s+(?:content|posts?|video)/i,
]

const PROFESSIONAL_BIO_PATTERNS = [
  /\b(?:doctor|dr\.|médico|médica|医生)\b/i,
  /\b(?:lawyer|advogado|advogada|abogado|律师)\b/i,
  /\b(?:engineer|engenheiro|ingeniero|工程师)\b/i,
  /\b(?:chef|chefe|厨师|主厨)\b/i,
  /\b(?:trainer|treinador|entrenador|教练)\b/i,
  /\b(?:photographer|fotógrafo|fotógrafa|摄影师)\b/i,
  /\b(?:nutritionist|nutricionista|营养师)\b/i,
  /\b(?:therapist|terapeuta|治疗师)\b/i,
  /\b(?:consultant|consultor|consultora|顾问)\b/i,
  /\b(?:certified|certificado|certificada|认证)\b/i,
  /\b(?:specialist|especialista|专家)\b/i,
  /\b(?:expert|experto|experta|专业)\b/i,
]

const INDIVIDUAL_BIO_PATTERNS = [
  /\b(?:mom|mãe|mamá|妈妈|mama)\b/i,
  /\b(?:dad|pai|papá|爸爸|papa)\b/i,
  /\b(?:student|estudante|estudiante|学生)\b/i,
  /\b(?:just\s+a|soy\s+un|eu\s+sou)\b/i,
  /\b(?:love|amo|adoro|喜欢)\s+(?:creating|fazer|hacer|cooking|travel)/i,
  /\b(?:\d{1,2}\s*(?:y\.?o\.?|years?\s*old|anos?|años?))\b/i,
  /[♈♉♊♋♌♍♎♏♐♑♒♓]/, // zodiac signs
  /(?:🇦🇷|🇧🇷|🇺🇸|🇬🇧|🇫🇷|🇩🇪|🇯🇵|🇰🇷|🇨🇳|🇲🇽|🇪🇸|🇮🇹|🇮🇳|🇮🇩|🇹🇭|🇻🇳|🇵🇭)/, // country flags
]

const BUSINESS_HANDLE_PATTERNS = [
  /official$/i,
  /^(?:the)?(?:real|original)/i,
  /(?:shop|store|loja)$/i,
  /(?:brand|co|inc|ltd)$/i,
  /(?:hq|global|group)$/i,
]

const BUSINESS_CATEGORIES = new Set([
  'business', 'brand', 'company', 'store', 'shop', 'marketplace',
  'e-commerce', 'ecommerce', 'retail', 'wholesale',
])

const MEDIA_CATEGORIES = new Set([
  'media', 'news', 'magazine', 'blog', 'community', 'fan page',
  'entertainment company', 'media company',
])

/**
 * Classify a creator as individual, professional, media, or business
 * based on available profile signals.
 */
export function classifyCreatorType(creator: {
  bio?: string | null
  handle?: string | null
  category?: string | null
  niche_tags?: string[]
  follower_count?: number | null
}): CreatorTypeResult {
  const signals: string[] = []
  let businessScore = 0
  let mediaScore = 0
  let professionalScore = 0
  let individualScore = 0

  const bio = (creator.bio || '').trim()
  const handle = (creator.handle || '').toLowerCase().replace(/[^a-z0-9_]/g, '')
  const category = (creator.category || '').toLowerCase()

  // ── Bio analysis ──
  if (bio) {
    for (const pattern of BUSINESS_BIO_PATTERNS) {
      if (pattern.test(bio)) {
        businessScore += 2
        signals.push(`bio:business(${pattern.source.slice(0, 30)})`)
        break // one signal per category is enough
      }
    }
    for (const pattern of MEDIA_BIO_PATTERNS) {
      if (pattern.test(bio)) {
        mediaScore += 2
        signals.push(`bio:media(${pattern.source.slice(0, 30)})`)
        break
      }
    }
    for (const pattern of PROFESSIONAL_BIO_PATTERNS) {
      if (pattern.test(bio)) {
        professionalScore += 2
        signals.push(`bio:professional(${pattern.source.slice(0, 30)})`)
        break
      }
    }
    for (const pattern of INDIVIDUAL_BIO_PATTERNS) {
      if (pattern.test(bio)) {
        individualScore += 2
        signals.push(`bio:individual(${pattern.source.slice(0, 30)})`)
        break
      }
    }

    // Multiple links or contact info suggest business
    const linkCount = (bio.match(/https?:\/\//g) || []).length
    if (linkCount >= 2) {
      businessScore += 1
      signals.push('bio:multipleLinks')
    }
  }

  // ── Handle analysis ──
  if (handle) {
    for (const pattern of BUSINESS_HANDLE_PATTERNS) {
      if (pattern.test(handle)) {
        businessScore += 1.5
        signals.push(`handle:business(${pattern.source.slice(0, 20)})`)
        break
      }
    }
  }

  // ── Category analysis ──
  if (category) {
    if (BUSINESS_CATEGORIES.has(category)) {
      businessScore += 2
      signals.push(`category:business(${category})`)
    }
    if (MEDIA_CATEGORIES.has(category)) {
      mediaScore += 2
      signals.push(`category:media(${category})`)
    }
  }

  // ── Niche tag analysis ──
  if (creator.niche_tags?.length) {
    const tags = creator.niche_tags.map(t => t.toLowerCase())
    if (tags.some(t => t.includes('shop') || t.includes('store') || t.includes('brand'))) {
      businessScore += 1
      signals.push('niche:business')
    }
  }

  // ── Default: individual ──
  // If no strong signals, assume individual (most creators are)
  if (businessScore === 0 && mediaScore === 0 && professionalScore === 0) {
    individualScore += 1
  }

  // ── Determine winner ──
  const scores = [
    { type: 'business' as CreatorType, score: businessScore },
    { type: 'media' as CreatorType, score: mediaScore },
    { type: 'professional' as CreatorType, score: professionalScore },
    { type: 'individual' as CreatorType, score: individualScore },
  ].sort((a, b) => b.score - a.score)

  const winner = scores[0]
  const runnerUp = scores[1]

  // If no signal at all, return unknown
  if (winner.score === 0) {
    return { type: 'unknown', confidence: 0, signals }
  }

  // Confidence based on margin between winner and runner-up
  const margin = winner.score - runnerUp.score
  const totalSignals = scores.reduce((sum, s) => sum + s.score, 0)
  const confidence = Math.min(1, (winner.score / totalSignals) * (0.5 + margin * 0.15))

  // If margin is too thin, mark as unknown
  if (margin < 1 && winner.score < 3) {
    return { type: 'unknown', confidence: Math.round(confidence * 100) / 100, signals }
  }

  return {
    type: winner.type,
    confidence: Math.round(confidence * 100) / 100,
    signals,
  }
}

// ── In-memory cache (TTL 7 days) ──────────────────────────────────────────────

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const cache = new Map<string, { result: CreatorTypeResult; ts: number }>()

/**
 * Classify with caching. Key is `platform:handle`.
 */
export function classifyCreatorTypeCached(
  key: string,
  creator: Parameters<typeof classifyCreatorType>[0],
): CreatorTypeResult {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.result
  }
  const result = classifyCreatorType(creator)
  cache.set(key, { result, ts: Date.now() })
  // Evict old entries if cache grows too large
  if (cache.size > 10000) {
    const cutoff = Date.now() - CACHE_TTL_MS
    for (const [k, v] of cache) {
      if (v.ts < cutoff) cache.delete(k)
    }
  }
  return result
}
