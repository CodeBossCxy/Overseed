import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), appendFile: vi.fn() }))
import { appendFile } from 'node:fs/promises'
import { creatorDbFetch } from '@/lib/creatordb-usage'
import { creatordbEnrich } from '@/lib/creatordb'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks() })

function records() {
  return vi.mocked(appendFile).mock.calls.map(call => JSON.parse(String(call[1])))
}

describe('CreatorDB vendor usage logging', () => {
  it('logs reported credits without exposing secrets and leaves the response readable', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      success: true, creditsUsed: 2, creditsAvailable: 98, data: { creatorList: [{ email: 'private@example.com' }] },
    })))
    const response = await creatorDbFetch('https://apiv3.creatordb.app/instagram/search', {
      method: 'POST', headers: { 'api-key': 'secret-key' }, body: '{"query":"private-query"}',
    }, { userId: 'tester' })
    expect((await response.json()).creditsUsed).toBe(2)
    const [start, completed] = records()
    expect(completed).toMatchObject({ requestId: start.requestId, creditsUsed: 2, creditsAvailable: 98, resultCount: 1, usageStatus: 'reported', userId: 'tester' })
    expect(JSON.stringify(records())).not.toMatch(/secret-key|private-query|private@example/)
  })

  it('logs CreatorDB trace IDs and current quota field aliases', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      success: true, quotaUsed: 1, remainingQuota: 42, traceId: 'trace-123', data: { creatorList: [] },
    })))
    await creatorDbFetch('https://apiv3.creatordb.app/instagram/search', {})
    expect(records()[1]).toMatchObject({ creditsUsed: 1, creditsAvailable: 42, traceId: 'trace-123' })
  })

  it('records HTTP failures without inventing zero credit usage', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })))
    await creatorDbFetch('https://apiv3.creatordb.app/tiktok/search', {})
    expect(records()[1]).toMatchObject({ httpStatus: 503, success: false, creditsUsed: null, usageStatus: 'not_reported' })
  })

  it('logs a network failure and rethrows it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')))
    await expect(creatorDbFetch('https://apiv3.creatordb.app/youtube/audience', {})).rejects.toThrow('network failure')
    expect(records()[1]).toMatchObject({ event: 'request_failed', creditsUsed: null, usageStatus: 'unknown' })
  })

  it('logs all three enrichment calls with user attribution', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubEnv('CREATORDB_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({ success: true, creditsUsed: 1, data: {} })))
    await creatordbEnrich('instagram', 'example', { logUserId: 'tester' })
    const completed = records().filter(r => r.event === 'request_completed')
    expect(completed.map(r => r.endpoint).sort()).toEqual(['/instagram/contact', '/instagram/performance', '/instagram/profile'])
    expect(completed.every(r => r.userId === 'tester')).toBe(true)
  })
})
