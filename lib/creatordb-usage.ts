import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

// Vendor credits, not the user's Overseed wallet. Never log API keys,
// request bodies, creator contacts, or full provider responses.
async function writeUsage(entry: Record<string, unknown>) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), provider: 'creatordb', ...entry })
  console.info(`[CreatorDB usage] ${line}`)
  // Hosted deployments use their persistent platform log collector. Local
  // testing additionally gets a file that survives dev-server restarts.
  const file = process.env.CREATORDB_USAGE_LOG_PATH ||
    (process.env.NODE_ENV !== 'production' ? join(process.cwd(), 'logs', 'creatordb-usage.jsonl') : null)
  if (!file) return
  try {
    await mkdir(dirname(file), { recursive: true })
    await appendFile(file, `${line}\n`, { mode: 0o600 })
  } catch {
    console.error('[CreatorDB usage] File write failed; usage entry is available in server logs.')
  }
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function extractPlatform(endpoint: string): string | null {
  const match = endpoint.match(/\/(instagram|youtube|tiktok)\//)
  return match ? match[1] : null
}

function safeParseBody(body: BodyInit | null | undefined): any {
  if (!body || typeof body !== 'string') return null
  try { return JSON.parse(body) } catch { return null }
}

export async function creatorDbFetch(
  url: string,
  init: RequestInit,
  context: { userId?: string } = {},
): Promise<Response> {
  const started = Date.now()
  const requestId = randomUUID()
  const endpoint = new URL(url).pathname
  const requestFingerprint = createHash('sha256').update(endpoint + String(init.body || '')).digest('hex')
  const common = { requestId, endpoint, requestFingerprint, userId: context.userId ?? null }
  await writeUsage({ ...common, event: 'request_started' })
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    await writeUsage({ ...common, event: 'request_failed', durationMs: Date.now() - started,
      httpStatus: null, creditsUsed: null, creditsAvailable: null, usageStatus: 'unknown',
      errorType: error instanceof Error ? error.name : 'UnknownError' })
    throw error
  }
  const data = await response.clone().json().catch(() => null)
  // Preserve only numeric credit metadata actually supplied by the vendor.
  // Do not guess a tariff or infer per-call costs from concurrent balances.
  const reportedCreditFields = Object.fromEntries(
    Object.entries(data && typeof data === 'object' ? data : {})
      .filter(([key, value]) => /credit/i.test(key) && numeric(value) !== null),
  )
  const creditsUsed = numeric(data?.creditsUsed)
    ?? numeric(data?.quotaUsed)
    ?? numeric(data?.quotaUsedTotal)
  await writeUsage({ ...common, event: 'request_completed', durationMs: Date.now() - started,
    httpStatus: response.status, success: response.ok && data?.success === true,
    creditsUsed, creditsAvailable: numeric(data?.creditsAvailable) ?? numeric(data?.remainingQuota),
    traceId: typeof data?.traceId === 'string' ? data.traceId : null,
    usageStatus: creditsUsed === null ? 'not_reported' : 'reported', reportedCreditFields,
    resultCount: Array.isArray(data?.data?.creatorList) ? data.data.creatorList.length : null,
  })
  // Write to DB for persistent depletion tracking
  try {
    const { prisma } = await import('@/lib/prisma')
    const creditsAfter = numeric(data?.creditsAvailable) ?? numeric(data?.remainingQuota) ?? null
    const creditsBefore = creditsAfter !== null && creditsUsed !== null ? creditsAfter + creditsUsed : null
    await prisma.creatorDbCreditLog.create({
      data: {
        userId: context.userId ?? null,
        endpoint,
        platform: extractPlatform(endpoint),
        searchFilters: safeParseBody(init.body),
        creditsUsedThis: creditsUsed,
        creditsBefore,
        creditsAfter,
        traceId: typeof data?.traceId === 'string' ? data.traceId : null,
        success: response.ok && data?.success === true,
        resultCount: Array.isArray(data?.data?.creatorList) ? data.data.creatorList.length : null,
        durationMs: Date.now() - started,
      },
    })
  } catch (dbErr) {
    console.error('[CreatorDB usage] DB write failed:', dbErr)
  }
  return response
}
