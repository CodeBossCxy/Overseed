import 'dotenv/config'
import { buildSearchRequest } from '@/lib/creatordb-search-request'
import type { CreatorDbPlatform } from '@/lib/creatordb-filter-fields'

const BASE = 'https://apiv3.creatordb.app'
const platforms: CreatorDbPlatform[] = ['instagram', 'tiktok', 'youtube']

async function main() {
  if (process.env.CREATORDB_LIVE_TEST !== '1') {
    throw new Error('Set CREATORDB_LIVE_TEST=1 to run this paid live probe')
  }
  const apiKey = process.env.CREATORDB_API_KEY
  if (!apiKey) throw new Error('CREATORDB_API_KEY is required')

  for (const platform of platforms) {
    const body = buildSearchRequest(platform, 'A', {
      // A multi-value `in` remains one filter entry. Replace these IDs when
      // calibrating against the account's current niche taxonomy.
      values: { niches: ['id_beauty_Beauty', 'id_skincare_Beauty'] },
      extraFilters: [
        { field: 'platformScore', op: '>', value: 0 },
        { field: 'shortMedianViews', op: '>', value: 0 },
      ],
    }, { pageSize: 1 })
    const response = await fetch(`${BASE}/${platform}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await response.json()
    const creditsUsed = data.creditsUsed ?? data.quotaUsed ?? data.quotaUsedTotal ?? null
    console.log(JSON.stringify({
      platform,
      httpStatus: response.status,
      success: data.success === true,
      errorCode: data.errorCode || null,
      errorDescription: data.errorDescription || null,
      traceId: data.traceId || null,
      creditsUsed,
      filterCount: body.filters.length,
      resultCount: Array.isArray(data.data?.creatorList) ? data.data.creatorList.length : 0,
    }))
    if (!response.ok || data.success !== true || creditsUsed !== 1) process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
