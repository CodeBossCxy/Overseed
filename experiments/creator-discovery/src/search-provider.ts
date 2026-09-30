export interface SearchResult {
  url: string
  title: string | null
  description: string | null
  rank: number // position in results (1-based)
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
  provider: string
  totalResults: number | null
  creditsCost: number // estimated cost of this request
}

export interface SearchProvider {
  name: string
  search(query: string, limit?: number, page?: number): Promise<SearchResponse>
}

export class SerperProvider implements SearchProvider {
  name = 'serper'
  private apiKey: string
  private costPerQuery = 0.001 // $0.001 per search

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async search(query: string, limit = 10, page = 0): Promise<SearchResponse> {
    // Serper uses 'page' param (1-based) for pagination
    const body: Record<string, unknown> = { q: query, num: limit }
    if (page > 0) body.page = page + 1 // Serper pages are 1-based

    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Serper API error ${res.status}: ${text}`)
    }

    const data = await res.json()
    const organic = Array.isArray(data.organic) ? data.organic : []

    return {
      results: organic.map((r: any, i: number) => ({
        url: r.link,
        title: r.title || null,
        description: r.snippet || null,
        rank: r.position || i + 1,
      })),
      query,
      provider: this.name,
      totalResults: data.searchInformation?.totalResults ?? null,
      creditsCost: this.costPerQuery,
    }
  }
}

export class MockProvider implements SearchProvider {
  name = 'mock'

  async search(query: string, limit = 10, page = 0): Promise<SearchResponse> {
    const results: SearchResult[] = []
    const q = query.toLowerCase()

    const platform = q.includes('instagram') || q.includes('instagram.com') ? 'instagram'
      : q.includes('tiktok') || q.includes('tiktok.com') ? 'tiktok'
      : q.includes('youtube') || q.includes('youtube.com') ? 'youtube'
      : null

    const handles = generateFakeHandles(query)
    for (let i = 0; i < Math.min(limit, handles.length); i++) {
      const handle = handles[i]
      const isProfile = i < limit * 0.6 // 60% profiles, 40% noise

      if (isProfile && platform) {
        const domain = platform === 'instagram' ? 'instagram.com'
          : platform === 'tiktok' ? 'tiktok.com'
          : 'youtube.com'
        const prefix = platform === 'tiktok' ? '/@' : platform === 'youtube' ? '/@' : '/'
        results.push({
          url: `https://www.${domain}${prefix}${handle}`,
          title: `${handle} - ${platform} profile`,
          description: `${handle} is a beauty creator sharing content about skincare and makeup`,
          rank: i + 1,
        })
      } else {
        const noiseUrls = [
          `https://www.example.com/top-beauty-influencers`,
          `https://blog.example.com/best-${handle}-creators`,
          `https://linktr.ee/${handle}`,
          `https://www.${handle}.com`,
          `https://www.instagram.com/explore/tags/beauty/`,
        ]
        results.push({
          url: noiseUrls[i % noiseUrls.length],
          title: `Best beauty creators ${i}`,
          description: 'A list of top creators in the beauty space',
          rank: i + 1,
        })
      }
    }

    return {
      results,
      query,
      provider: this.name,
      totalResults: results.length * 100,
      creditsCost: 0,
    }
  }
}

function generateFakeHandles(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const handles: string[] = []
  const prefixes = ['beauty', 'glam', 'skin', 'makeup', 'style', 'fit', 'glow', 'chic']
  const suffixes = ['queen', 'guru', 'life', 'daily', 'official', 'xo', 'co', 'hub']

  for (let i = 0; i < 15; i++) {
    const p = prefixes[i % prefixes.length]
    const s = suffixes[i % suffixes.length]
    const w = words[i % words.length] || 'creator'
    handles.push(`${p}${w}${s}${i}`)
  }
  return handles
}

export function createSearchProvider(config?: { provider?: string; serperApiKey?: string }): SearchProvider {
  const providerName = config?.provider || process.env.SEARCH_PROVIDER || 'auto'
  const apiKey = config?.serperApiKey || process.env.SERPER_API_KEY

  if (providerName === 'mock') return new MockProvider()
  if (providerName === 'serper' || (providerName === 'auto' && apiKey)) {
    if (!apiKey) throw new Error('SERPER_API_KEY is required for Serper provider')
    return new SerperProvider(apiKey)
  }

  console.warn('No search API key configured — using mock provider')
  return new MockProvider()
}
