export const NICHES: Record<string, string[]> = {
  beauty: ['skincare', 'makeup', 'cosmetics', 'hair care', 'nail art'],
  fashion: ['streetwear', 'sustainable fashion', 'luxury fashion', 'plus size fashion', 'vintage fashion'],
  fitness: ['yoga', 'crossfit', 'bodybuilding', 'running', 'pilates', 'home workout'],
  food: ['cooking', 'baking', 'vegan', 'meal prep', 'food review', 'restaurant'],
  travel: ['budget travel', 'luxury travel', 'solo travel', 'adventure travel', 'travel vlog'],
  lifestyle: ['minimalism', 'productivity', 'self care', 'daily vlog', 'motivation'],
  gaming: ['mobile gaming', 'PC gaming', 'esports', 'game review', 'streaming'],
  technology: ['tech review', 'coding', 'AI', 'gadgets', 'software'],
  parenting: ['mom life', 'dad life', 'baby care', 'family vlog', 'kids activities'],
  home: ['home decor', 'DIY', 'interior design', 'organization', 'gardening'],
  wellness: ['meditation', 'mental health', 'nutrition', 'holistic health', 'supplements'],
  pets: ['dogs', 'cats', 'pet care', 'pet training', 'exotic pets'],
  education: ['study tips', 'online courses', 'tutoring', 'language learning'],
  finance: ['investing', 'personal finance', 'crypto', 'real estate', 'budgeting'],
}

export const CREATOR_TERMS = [
  'creator', 'influencer', 'content creator', 'blogger', 'UGC creator',
]

export const CONTACT_TERMS = [
  'business inquiries', 'contact', 'media kit', 'collabs', 'collaboration', 'partnerships', 'brand deals',
]

// YouTube excluded — use the free YouTube Data API for channel discovery instead
export const PLATFORM_DOMAINS: Record<string, string> = {
  instagram: 'instagram.com',
  tiktok: 'tiktok.com',
}

export const US_CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'San Francisco',
  'Miami', 'Seattle', 'Denver', 'Atlanta', 'Dallas', 'Boston', 'Nashville',
  'Austin', 'San Diego', 'Portland', 'Las Vegas',
]

export const COUNTRY_CITIES: Record<string, string[]> = {
  US: US_CITIES,
  UK: ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Bristol', 'Leeds'],
  CA: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa'],
  AU: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],
}

interface QueryTemplate {
  id: string
  pattern: string
  weight: number
  requiresCity?: boolean
  requiresCountry?: boolean
}

const TEMPLATES: QueryTemplate[] = [
  { id: 'site-niche-creator',         pattern: 'site:{platform_domain} {niche} {creator_term}',                 weight: 100 },
  { id: 'niche-creator-platform',     pattern: '{niche} {creator_term} {platform}',                             weight: 90  },
  { id: 'niche-creator-contact',      pattern: '"{niche} {creator_term}" "{contact_term}"',                     weight: 85  },
  { id: 'subniche-creator-platform',  pattern: '{sub_niche} {creator_term} {platform}',                         weight: 80  },
  { id: 'country-niche-creator',      pattern: '{country} {niche} {creator_term} {platform}',                   weight: 75, requiresCountry: true },
  { id: 'site-subniche-creator',      pattern: 'site:{platform_domain} {sub_niche} {creator_term}',             weight: 70  },
  { id: 'city-niche-creator',         pattern: '{city} {niche} {creator_term} {platform}',                      weight: 65, requiresCity: true },
  { id: 'exact-niche-creator-city',   pattern: '"{niche}" "{creator_term}" "{city}"',                           weight: 60, requiresCity: true },
  { id: 'niche-creator-platform-country', pattern: '{niche} {creator_term} {platform} {country}',              weight: 55, requiresCountry: true },
  { id: 'subniche-creator-contact',   pattern: '"{sub_niche} {creator_term}" "{contact_term}"',                 weight: 50  },
]

export interface QueryGeneratorInput {
  niches: string[]
  platforms: string[]
  country?: string
  cities?: string[]
  creatorTerms?: string[]
  contactTerms?: string[]
  maxQueries?: number
  includeSubNiches?: boolean
}

export interface GeneratedQuery {
  query: string
  templateId: string
  weight: number
  niche: string
  platform: string | null
}

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

function dedupeKey(s: string): string {
  return normalize(s).toLowerCase()
}

export function generateQueries(input: QueryGeneratorInput): GeneratedQuery[] {
  const {
    niches,
    platforms: rawPlatforms,
    country,
    cities,
    creatorTerms = CREATOR_TERMS,
    contactTerms = CONTACT_TERMS,
    maxQueries = 500,
    includeSubNiches = true,
  } = input

  // Filter out youtube — use the free YouTube Data API instead of paid Serper queries
  const platforms = rawPlatforms.filter((p) => p !== 'youtube')

  const effectiveContactTerms = contactTerms.slice(0, 3)

  const resolvedCities: string[] = (() => {
    if (cities && cities.length > 0) return cities.slice(0, 5)
    if (country && COUNTRY_CITIES[country]) return COUNTRY_CITIES[country].slice(0, 5)
    return US_CITIES.slice(0, 5)
  })()

  const seen = new Set<string>()
  const results: GeneratedQuery[] = []

  for (const template of TEMPLATES) {
    if (template.requiresCity && resolvedCities.length === 0) continue
    if (template.requiresCountry && !country) continue

    const usesSubNiche = template.pattern.includes('{sub_niche}')
    const usesCity = template.pattern.includes('{city}')
    const usesContact = template.pattern.includes('{contact_term}')
    const usesPlatformDomain = template.pattern.includes('{platform_domain}')
    const usesPlatform = template.pattern.includes('{platform}') && !usesPlatformDomain

    for (const nicheName of niches) {
      const subNiches = (includeSubNiches && NICHES[nicheName])
        ? NICHES[nicheName].slice(0, 3)
        : []

      const subNicheList = usesSubNiche ? subNiches : [null]
      if (usesSubNiche && subNicheList.length === 0) continue

      const cityList = usesCity ? resolvedCities : [null]
      const contactList = usesContact ? effectiveContactTerms : [null]

      const platformList = (usesPlatformDomain || usesPlatform)
        ? platforms
        : [null]

      for (const platform of platformList) {
        const platformDomain = platform ? (PLATFORM_DOMAINS[platform] ?? null) : null
        if (usesPlatformDomain && !platformDomain) continue

        for (const creatorTerm of creatorTerms) {
          for (const subNiche of subNicheList) {
            for (const city of cityList) {
              for (const contact of contactList) {
                let q = template.pattern
                  .replace('{niche}', nicheName)
                  .replace('{creator_term}', creatorTerm)
                  .replace('{platform}', platform ?? '')
                  .replace('{platform_domain}', platformDomain ?? '')
                  .replace('{country}', country ?? '')
                  .replace('{sub_niche}', subNiche ?? '')
                  .replace('{city}', city ?? '')
                  .replace('{contact_term}', contact ?? '')

                q = normalize(q)

                const key = dedupeKey(q)
                if (seen.has(key)) continue
                seen.add(key)

                results.push({
                  query: q,
                  templateId: template.id,
                  weight: template.weight,
                  niche: nicheName,
                  platform: platform ?? null,
                })
              }
            }
          }
        }
      }
    }
  }

  results.sort((a, b) => b.weight - a.weight)

  return results.slice(0, maxQueries)
}
