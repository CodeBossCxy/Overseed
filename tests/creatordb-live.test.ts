import { describe, expect, it } from 'vitest'
import { buildSearchRequest } from '@/lib/creatordb-search-request'

const live = process.env.CREATORDB_LIVE_TEST === '1' && Boolean(process.env.CREATORDB_API_KEY)

describe.skipIf(!live)('CreatorDB live preset integration', () => {
  it.each(['instagram', 'tiktok', 'youtube'] as const)('runs Preset A on %s for one vendor credit', async (platform) => {
    const body = buildSearchRequest(platform, 'A', {
      values: { niches: ['id_beauty_Beauty'] },
    }, { pageSize: 1 })
    const response = await fetch(`https://apiv3.creatordb.app/${platform}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': process.env.CREATORDB_API_KEY! },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await response.json()
    expect(response.ok, data.errorDescription).toBe(true)
    expect(data.success, data.errorDescription).toBe(true)
    expect(data.creditsUsed ?? data.quotaUsed ?? data.quotaUsedTotal).toBe(1)
  })
})
