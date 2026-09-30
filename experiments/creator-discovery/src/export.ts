import { createWriteStream } from 'fs'
import { format } from 'fast-csv'
import { getDb } from './db.js'

export interface ExportOptions {
  runId?: number
  minScore?: number
  platform?: string
  type?: string
  urlType?: string
  status?: string
  limit?: number
  outputPath?: string
  output?: string
}

export async function exportToCsv(opts: ExportOptions): Promise<number> {
  const db = getDb()
  const outputPath = opts.output ?? opts.outputPath
  if (!outputPath) throw new Error('outputPath or output is required')

  const conditions: string[] = []
  const values: unknown[] = []

  if (opts.runId !== undefined) {
    conditions.push('first_run_id = ?')
    values.push(opts.runId)
  }
  if (opts.minScore !== undefined) {
    conditions.push('discovery_score >= ?')
    values.push(opts.minScore)
  }
  if (opts.platform !== undefined) {
    conditions.push('platform = ?')
    values.push(opts.platform)
  }
  const urlTypeFilter = opts.type ?? opts.urlType
  if (urlTypeFilter !== undefined) {
    conditions.push('url_type = ?')
    values.push(urlTypeFilter)
  }
  if (opts.status !== undefined) {
    conditions.push('status = ?')
    values.push(opts.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limitClause = opts.limit !== undefined ? `LIMIT ${opts.limit}` : ''

  const rows = db
    .prepare(
      `SELECT id, url, normalized_url, domain, url_type, platform, extracted_handle,
              title, description, discovery_score, status, times_discovered, first_discovered_at
       FROM discovery_candidates ${where} ORDER BY discovery_score DESC ${limitClause}`
    )
    .all(...values) as Record<string, unknown>[]

  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(outputPath)
    const csvStream = format({ headers: true })

    csvStream.pipe(ws)

    ws.on('finish', resolve)
    ws.on('error', reject)
    csvStream.on('error', reject)

    for (const row of rows) {
      csvStream.write(row)
    }

    csvStream.end()
  })

  return rows.length
}
