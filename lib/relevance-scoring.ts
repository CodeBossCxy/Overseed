export interface RelevanceWeights {
  bio: number    // default 0.7
  niche: number  // default 0.3
}

export interface RelevanceResult {
  score: number      // 0-100
  bioScore: number   // 0-100 (before weighting)
  nicheScore: number // 0-100 (before weighting)
}

// Common stop words to ignore during scoring (EN + ZH + ES + PT + KO + JA)
const STOP_WORDS = new Set([
  // English
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'and', 'or', 'but', 'not', 'no', 'so', 'if', 'do', 'does', 'did',
  'has', 'have', 'had', 'will', 'would', 'could', 'should', 'may',
  'can', 'this', 'that', 'it', 'i', 'me', 'my', 'we', 'our', 'you',
  'your', 'they', 'them', 'their', 'who', 'what', 'which', 'how',
  'about', 'up', 'out', 'all', 'just', 'also', 'than', 'very',
  'want', 'need', 'looking', 'find', 'search', 'get',
  // Chinese
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
  '没有', '看', '好', '自己', '这', '他', '她', '它', '们',
  // Spanish
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'en', 'con', 'por',
  'para', 'es', 'del', 'que', 'se', 'al', 'lo', 'como', 'más', 'su',
  'ya', 'me', 'mi', 'te', 'tu', 'nos',
  // Portuguese
  'o', 'os', 'as', 'um', 'uma', 'do', 'da', 'dos', 'das', 'no', 'na',
  'nos', 'nas', 'em', 'com', 'por', 'para', 'que', 'se', 'eu', 'ele',
  'ela', 'nós', 'você', 'mais', 'seu', 'sua', 'meu', 'minha',
])

// ── Cross-language synonym groups ──────────────────────────────────────
// Each group contains synonyms across languages for a single concept.
// Used to expand query/bio/niche terms so "汽车" matches "automotive",
// "carro" matches "car", etc. Keep entries lowercase.
const SYNONYM_GROUPS: string[][] = [
  // Automotive
  ['automotive', 'car', 'cars', 'auto', 'autos', 'automobile', 'vehicle', 'vehicles', 'driving',
   '汽车', '车', '驾驶', '轿车', '座驾', 'carro', 'carros', 'coche', 'coches', 'automóvil', 'vehículo', 'automóvel', 'veículo',
   '자동차', '차', '車', '自動車', 'クルマ'],
  // Fashion
  ['fashion', 'style', 'outfit', 'outfits', 'clothing', 'apparel', 'wear', 'ootd',
   '时尚', '穿搭', '服装', '服饰', '潮流', '衣服',
   'moda', 'ropa', 'estilo', 'roupa', 'vestuário',
   '패션', 'ファッション', 'スタイル'],
  // Beauty & cosmetics
  ['beauty', 'makeup', 'cosmetics', 'skincare', 'skin care', 'skin',
   '美妆', '化妆', '护肤', '美容', '彩妆',
   'belleza', 'maquillaje', 'cosméticos', 'beleza', 'maquiagem',
   '뷰티', '메이크업', '美容', 'メイク', 'コスメ'],
  // Food & cooking
  ['food', 'cooking', 'recipe', 'recipes', 'cuisine', 'chef', 'foodie', 'baking',
   '美食', '烹饪', '食谱', '料理', '烘焙', '吃货', '做饭',
   'comida', 'cocina', 'receta', 'recetas', 'culinária', 'receita', 'receitas', 'cozinha',
   '음식', '요리', '料理', 'グルメ', 'レシピ'],
  // Travel
  ['travel', 'traveling', 'travelling', 'trip', 'trips', 'tourism', 'tourist', 'adventure', 'explore',
   '旅行', '旅游', '出行', '游记', '旅途', '探险',
   'viaje', 'viajes', 'turismo', 'viagem', 'viagens',
   '여행', '旅行', 'トラベル'],
  // Fitness & sports
  ['fitness', 'gym', 'workout', 'exercise', 'training', 'sport', 'sports', 'athletic',
   '健身', '运动', '锻炼', '体育', '训练',
   'fitness', 'gimnasio', 'ejercicio', 'deporte', 'deportes', 'academia', 'exercício', 'esporte', 'esportes',
   '피트니스', '운동', 'フィットネス', 'トレーニング', 'スポーツ'],
  // Technology
  ['technology', 'tech', 'gadget', 'gadgets', 'software', 'hardware', 'digital', 'electronics',
   '科技', '技术', '数码', '电子', '智能',
   'tecnología', 'tecnologia', 'eletrônico', 'electrónico',
   '기술', 'テクノロジー', 'テック', 'ガジェット'],
  // Gaming
  ['gaming', 'game', 'games', 'gamer', 'esports', 'streaming', 'streamer', 'gameplay',
   '游戏', '电竞', '玩家', '直播',
   'juegos', 'juego', 'jogos', 'jogo',
   '게임', 'ゲーム', 'ゲーミング'],
  // Music
  ['music', 'musician', 'song', 'songs', 'singer', 'singing', 'artist',
   '音乐', '歌曲', '歌手', '唱歌',
   'música', 'canción', 'cantor', 'cantora',
   '음악', '音楽', 'ミュージック'],
  // Dance
  ['dance', 'dancing', 'dancer', 'choreography',
   '舞蹈', '跳舞', '编舞',
   'baile', 'danza', 'bailar', 'dança', 'dançar',
   '댄스', 'ダンス'],
  // Education
  ['education', 'educational', 'learning', 'teaching', 'tutorial', 'tutorials', 'study',
   '教育', '学习', '教学', '知识',
   'educación', 'educação', 'ensino', 'aprendizaje',
   '교육', '教育', 'エデュケーション'],
  // Entertainment & comedy
  ['entertainment', 'comedy', 'funny', 'humor', 'humour', 'laugh',
   '娱乐', '搞笑', '幽默', '喜剧', '段子',
   'entretenimiento', 'comedia', 'humor', 'entretenimento', 'comédia',
   '엔터테인먼트', 'エンタメ', 'コメディ'],
  // Health & wellness
  ['health', 'wellness', 'healthy', 'wellbeing', 'mental health', 'nutrition',
   '健康', '养生', '营养',
   'salud', 'bienestar', 'saúde', 'bem-estar',
   '건강', '健康', 'ヘルス', 'ウェルネス'],
  // Photography
  ['photography', 'photo', 'photos', 'photographer', 'camera',
   '摄影', '拍照', '照片', '摄像',
   'fotografía', 'fotografia', 'foto', 'fotos',
   '사진', '写真', 'フォトグラフィー'],
  // Art & design
  ['art', 'artist', 'design', 'designer', 'creative', 'illustration', 'drawing', 'painting',
   '艺术', '设计', '创意', '绘画', '画画', '插画',
   'arte', 'diseño', 'design', 'artista',
   '아트', '디자인', 'アート', 'デザイン'],
  // Lifestyle
  ['lifestyle', 'life', 'daily', 'vlog', 'vlogger', 'vlogging',
   '生活', '日常', '生活方式',
   'estilo de vida', 'vida', 'cotidiano',
   '라이프스타일', 'ライフスタイル'],
  // Pets & animals
  ['pets', 'pet', 'animals', 'animal', 'dog', 'dogs', 'cat', 'cats',
   '宠物', '动物', '猫', '狗',
   'mascotas', 'mascota', 'animales', 'animais', 'animal', 'pet',
   '반려동물', 'ペット', '動物'],
  // Parenting & family
  ['parenting', 'family', 'mom', 'dad', 'baby', 'kids', 'children', 'motherhood',
   '育儿', '亲子', '家庭', '宝宝', '妈妈', '爸爸',
   'familia', 'maternidad', 'paternidad', 'bebé', 'família', 'bebê',
   '육아', '가족', '子育て', '家族'],
  // Business & finance
  ['business', 'finance', 'investing', 'investment', 'money', 'entrepreneur', 'startup',
   '商业', '金融', '投资', '理财', '创业',
   'negocios', 'finanzas', 'inversión', 'negócios', 'finanças', 'investimento',
   '비즈니스', 'ビジネス', 'ファイナンス'],
  // Jewelry & accessories
  ['jewelry', 'jewellery', 'accessories', 'accessory', 'necklace', 'earring', 'earrings', 'bracelet', 'ring',
   '珠宝', '首饰', '饰品', '配饰', '耳环', '项链', '手链', '戒指',
   'joyería', 'joyas', 'accesorios', 'jóias', 'joalheria', 'acessórios',
   '주얼리', 'ジュエリー', 'アクセサリー'],
  // Home & interior
  ['home', 'interior', 'decor', 'decoration', 'furniture', 'house',
   '家居', '装修', '家装', '室内', '家具',
   'hogar', 'decoración', 'casa', 'decoração', 'lar',
   '인테리어', 'インテリア', 'ホーム'],
  // Outdoor & nature
  ['outdoor', 'outdoors', 'nature', 'hiking', 'camping', 'mountain',
   '户外', '自然', '徒步', '露营', '登山',
   'aire libre', 'naturaleza', 'senderismo', 'natureza', 'trilha',
   '아웃도어', 'アウトドア'],
]

// Build a lookup: term → set of all synonyms in its group.
// Computed once at module load.
const _synonymIndex = new Map<string, Set<string>>()
for (const group of SYNONYM_GROUPS) {
  const groupSet = new Set(group)
  for (const term of group) {
    // Merge if the term already belongs to another group
    const existing = _synonymIndex.get(term)
    if (existing) {
      group.forEach((t) => existing.add(t))
      // Point all new terms to the merged set
      group.forEach((t) => _synonymIndex.set(t, existing))
    } else {
      _synonymIndex.set(term, groupSet)
    }
  }
}

/**
 * Expand a single term into all its cross-language synonyms.
 * Returns the original term if no synonyms are found.
 * For CJK text, also checks substrings (e.g. "汽车相关" contains "汽车").
 */
function expandTerm(term: string): string[] {
  const lower = term.toLowerCase()
  // Direct lookup
  const direct = _synonymIndex.get(lower)
  if (direct) return Array.from(direct)

  // For CJK: check if any synonym key is a substring of the term, or vice versa.
  // This handles compound words like "汽车相关类达人" containing "汽车".
  const results = new Set<string>([lower])
  _synonymIndex.forEach((group, key) => {
    if (lower.includes(key) || key.includes(lower)) {
      group.forEach((s) => results.add(s))
    }
  })
  return Array.from(results)
}

/**
 * Tokenize text for matching. For CJK text, extract both the full text and
 * individual character bigrams since CJK doesn't use spaces.
 */
function tokenize(text: string): string[] {
  const lower = text.toLowerCase()
  // Split on whitespace and common punctuation
  const words = lower.split(/[\s,;.!?|·–—\/\\()\[\]{}'"]+/).filter((t) => t.length > 0)
  const tokens: string[] = []
  for (const w of words) {
    if (!STOP_WORDS.has(w) && w.length > 1) tokens.push(w)
    // Also include the word even if it's a single CJK character
    else if (w.length === 1 && /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(w)) tokens.push(w)
  }
  return tokens
}

/**
 * Check if termA matches termB, considering cross-language synonyms.
 * Returns a score 0-1: 1 for exact match, 0.8 for synonym match,
 * 0.5 for partial substring match.
 */
function crossLanguageMatch(termA: string, termB: string): number {
  const a = termA.toLowerCase()
  const b = termB.toLowerCase()

  // Exact or substring match
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.8

  // Synonym match: expand both and check intersection
  const synA = expandTerm(a)
  const synBArr = expandTerm(b)
  const synBSet = new Set(synBArr)
  for (const s of synA) {
    if (synBSet.has(s)) return 0.7
    // Also check substring against synonym list
    for (const sb of synBArr) {
      if (s.includes(sb) || sb.includes(s)) return 0.5
    }
  }

  return 0
}

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

  const terms = tokenize(query)

  if (terms.length === 0) {
    return { score: 0, bioScore: 0, nicheScore: 0 }
  }

  // Expand query terms with cross-language synonyms for matching
  const expandedTermSets = terms.map((t) => expandTerm(t))

  // Bio score: check for matches across languages
  let bioScore = 0
  if (bio && bio.trim().length > 0) {
    const bioLower = bio.toLowerCase()
    const bioTokens = tokenize(bio)
    let totalHits = 0

    for (const expanded of expandedTermSets) {
      let bestHit = 0
      for (const syn of expanded) {
        // Count occurrences in bio text
        let count = 0
        let idx = 0
        while ((idx = bioLower.indexOf(syn, idx)) !== -1) {
          count++
          idx += syn.length
        }
        if (count > 0) {
          bestHit = Math.max(bestHit, Math.min(count, 5))
        }
      }
      // Also check token-level matching for CJK
      if (bestHit === 0) {
        for (const bioToken of bioTokens) {
          for (const syn of expanded) {
            const m = crossLanguageMatch(syn, bioToken)
            if (m > 0) {
              bestHit = Math.max(bestHit, m * 2)
              break
            }
          }
          if (bestHit > 0) break
        }
      }
      totalHits += bestHit
    }

    const density = totalHits / expandedTermSets.length
    bioScore = Math.min(100, density * 40)
  }

  // Niche score: cross-language matching against niche tags
  let nicheScore = 0
  if (nicheTags.length > 0) {
    const tagsLower = nicheTags.map((t) => t.toLowerCase())
    let weightedHits = 0

    for (const expanded of expandedTermSets) {
      let matched = false
      for (let i = 0; i < tagsLower.length; i++) {
        const tag = tagsLower[i]
        // Check each synonym against the tag
        let bestMatch = 0
        for (const syn of expanded) {
          const m = crossLanguageMatch(syn, tag)
          if (m > bestMatch) bestMatch = m
        }
        if (bestMatch > 0) {
          const positionWeight = 1 - (i / (tagsLower.length * 2))
          weightedHits += positionWeight * bestMatch
          matched = true
          break
        }
      }
      // If no direct tag match, check if any tag's words match any synonym
      if (!matched) {
        for (let i = 0; i < tagsLower.length; i++) {
          const tagWords = tagsLower[i].split(/[\s&,]+/).filter(Boolean)
          for (const tw of tagWords) {
            for (const syn of expanded) {
              if (crossLanguageMatch(syn, tw) > 0) {
                const positionWeight = 1 - (i / (tagsLower.length * 2))
                weightedHits += positionWeight * 0.6
                matched = true
                break
              }
            }
            if (matched) break
          }
          if (matched) break
        }
      }
    }
    nicheScore = Math.min(100, (weightedHits / expandedTermSets.length) * 100)
  }

  const score = Math.round(bioScore * bioWeight + nicheScore * nicheWeight)

  return {
    score: Math.min(100, score),
    bioScore: Math.round(bioScore),
    nicheScore: Math.round(nicheScore),
  }
}
