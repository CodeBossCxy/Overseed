import Database from 'better-sqlite3'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const DB_PATH = resolve(__dirname, '..', 'data', 'discovery.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS discovery_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      niche TEXT NOT NULL,
      country TEXT,
      platforms TEXT NOT NULL,
      cities TEXT,
      target_candidates INTEGER NOT NULL,
      queries_generated INTEGER DEFAULT 0,
      queries_executed INTEGER DEFAULT 0,
      api_requests INTEGER DEFAULT 0,
      search_results INTEGER DEFAULT 0,
      unique_urls INTEGER DEFAULT 0,
      candidates_found INTEGER DEFAULT 0,
      duplicates_removed INTEGER DEFAULT 0,
      estimated_cost_usd REAL DEFAULT 0,
      status TEXT DEFAULT 'running',
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS discovery_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      normalized_url TEXT NOT NULL UNIQUE,
      domain TEXT NOT NULL,
      url_type TEXT NOT NULL,
      platform TEXT,
      extracted_handle TEXT,
      title TEXT,
      description TEXT,
      discovery_score REAL DEFAULT 0,
      status TEXT DEFAULT 'discovered',
      times_discovered INTEGER DEFAULT 1,
      crawl_eligible INTEGER DEFAULT 1,
      first_discovered_at TEXT DEFAULT (datetime('now')),
      last_discovered_at TEXT DEFAULT (datetime('now')),
      first_run_id INTEGER REFERENCES discovery_runs(id),
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS discovery_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL REFERENCES discovery_candidates(id) ON DELETE CASCADE,
      run_id INTEGER NOT NULL REFERENCES discovery_runs(id),
      query TEXT NOT NULL,
      provider TEXT NOT NULL,
      search_rank INTEGER,
      result_title TEXT,
      result_description TEXT,
      discovered_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS executed_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_normalized TEXT NOT NULL,
      query_original TEXT NOT NULL,
      provider TEXT NOT NULL,
      page INTEGER DEFAULT 0,
      result_count INTEGER DEFAULT 0,
      new_candidates INTEGER DEFAULT 0,
      duplicate_count INTEGER DEFAULT 0,
      executed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(query_normalized, page)
    );

    CREATE INDEX IF NOT EXISTS idx_candidates_normalized ON discovery_candidates(normalized_url);
    CREATE INDEX IF NOT EXISTS idx_candidates_status ON discovery_candidates(status);
    CREATE INDEX IF NOT EXISTS idx_candidates_platform ON discovery_candidates(platform);
    CREATE INDEX IF NOT EXISTS idx_candidates_score ON discovery_candidates(discovery_score DESC);
    CREATE INDEX IF NOT EXISTS idx_sources_candidate ON discovery_sources(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_sources_run ON discovery_sources(run_id);
  `)
}

// -- Run management --

export interface RunInput {
  niche: string
  country?: string
  platforms: string[]
  cities?: string[]
  targetCandidates: number
}

export function createRun(input: RunInput): number {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO discovery_runs (niche, country, platforms, cities, target_candidates)
    VALUES (?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    input.niche,
    input.country ?? null,
    JSON.stringify(input.platforms),
    input.cities ? JSON.stringify(input.cities) : null,
    input.targetCandidates
  )
  return result.lastInsertRowid as number
}

export function updateRunStats(
  runId: number,
  stats: Partial<{
    queriesGenerated: number
    queriesExecuted: number
    apiRequests: number
    searchResults: number
    uniqueUrls: number
    candidatesFound: number
    duplicatesRemoved: number
    estimatedCostUsd: number
  }>
): void {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []

  const colMap: Record<string, string> = {
    queriesGenerated: 'queries_generated',
    queriesExecuted: 'queries_executed',
    apiRequests: 'api_requests',
    searchResults: 'search_results',
    uniqueUrls: 'unique_urls',
    candidatesFound: 'candidates_found',
    duplicatesRemoved: 'duplicates_removed',
    estimatedCostUsd: 'estimated_cost_usd',
  }

  for (const [key, col] of Object.entries(colMap)) {
    if (key in stats) {
      fields.push(`${col} = ?`)
      values.push((stats as Record<string, unknown>)[key])
    }
  }

  if (fields.length === 0) return

  values.push(runId)
  db.prepare(`UPDATE discovery_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function completeRun(
  runId: number,
  stats: Partial<{
    queriesGenerated: number
    queriesExecuted: number
    apiRequests: number
    searchResults: number
    uniqueUrls: number
    candidatesFound: number
    duplicatesRemoved: number
    estimatedCostUsd: number
  }>
): void {
  updateRunStats(runId, stats)
  getDb()
    .prepare(`UPDATE discovery_runs SET status = 'completed', completed_at = datetime('now') WHERE id = ?`)
    .run(runId)
}

export function failRun(runId: number, error: string): void {
  getDb()
    .prepare(`UPDATE discovery_runs SET status = 'failed', completed_at = datetime('now'), error = ? WHERE id = ?`)
    .run(error, runId)
}

export function getRun(runId: number): any {
  return getDb().prepare(`SELECT * FROM discovery_runs WHERE id = ?`).get(runId) ?? null
}

export function listRuns(): any[] {
  return getDb().prepare(`SELECT * FROM discovery_runs ORDER BY id DESC`).all()
}

// -- Candidate management --

export interface CandidateInput {
  url: string
  normalizedUrl: string
  domain: string
  urlType: string
  platform: string | null
  extractedHandle: string | null
  title: string | null
  description: string | null
  discoveryScore: number
  crawlEligible: boolean
  runId: number
}

export function upsertCandidate(input: CandidateInput): { id: number; isNew: boolean } {
  const db = getDb()

  const insert = db.prepare(`
    INSERT OR IGNORE INTO discovery_candidates
      (url, normalized_url, domain, url_type, platform, extracted_handle, title, description,
       discovery_score, crawl_eligible, first_run_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = insert.run(
    input.url,
    input.normalizedUrl,
    input.domain,
    input.urlType,
    input.platform,
    input.extractedHandle,
    input.title,
    input.description,
    input.discoveryScore,
    input.crawlEligible ? 1 : 0,
    input.runId
  )

  const isNew = result.changes === 1

  if (!isNew) {
    db.prepare(`
      UPDATE discovery_candidates
      SET times_discovered = times_discovered + 1,
          last_discovered_at = datetime('now')
      WHERE normalized_url = ?
    `).run(input.normalizedUrl)
  }

  const row = db
    .prepare(`SELECT id FROM discovery_candidates WHERE normalized_url = ?`)
    .get(input.normalizedUrl) as { id: number }

  return { id: row.id, isNew }
}

export function addSource(
  candidateId: number,
  source: {
    runId: number
    query: string
    provider: string
    searchRank: number | null
    resultTitle: string | null
    resultDescription: string | null
  }
): void {
  getDb()
    .prepare(`
      INSERT INTO discovery_sources
        (candidate_id, run_id, query, provider, search_rank, result_title, result_description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      candidateId,
      source.runId,
      source.query,
      source.provider,
      source.searchRank ?? null,
      source.resultTitle ?? null,
      source.resultDescription ?? null
    )
}

export function updateCandidateScore(candidateId: number, score: number): void {
  getDb()
    .prepare(`UPDATE discovery_candidates SET discovery_score = ? WHERE id = ?`)
    .run(score, candidateId)
}

export function getCandidateByNormalizedUrl(normalizedUrl: string): any | null {
  return (
    getDb()
      .prepare(`SELECT * FROM discovery_candidates WHERE normalized_url = ?`)
      .get(normalizedUrl) ?? null
  )
}

export function getCandidatesForRun(
  runId: number,
  opts?: { limit?: number; offset?: number; minScore?: number }
): any[] {
  const db = getDb()
  const conditions: string[] = [`first_run_id = ?`]
  const values: unknown[] = [runId]

  if (opts?.minScore !== undefined) {
    conditions.push(`discovery_score >= ?`)
    values.push(opts.minScore)
  }

  const where = conditions.join(' AND ')
  const limit = opts?.limit !== undefined ? `LIMIT ${opts.limit}` : ''
  const offset = opts?.offset !== undefined ? `OFFSET ${opts.offset}` : ''

  return db
    .prepare(
      `SELECT * FROM discovery_candidates WHERE ${where} ORDER BY discovery_score DESC ${limit} ${offset}`
    )
    .all(...values)
}

export function countCandidatesForRun(runId: number): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as cnt FROM discovery_candidates WHERE first_run_id = ?`)
    .get(runId) as { cnt: number }
  return row.cnt
}

// -- Query cache (track pages fetched per query, skip exhausted ones) --

/** Get the next page to fetch for this query. Returns null if the query is exhausted. */
export function getNextQueryPage(query: string): number | null {
  const norm = query.toLowerCase().trim()
  const db = getDb()

  // Find the highest page fetched for this query
  const row = db.prepare(`
    SELECT page, new_candidates, duplicate_count
    FROM executed_queries
    WHERE query_normalized = ?
    ORDER BY page DESC
    LIMIT 1
  `).get(norm) as { page: number; new_candidates: number; duplicate_count: number } | undefined

  if (!row) return 0 // never executed → start at page 0

  // If the last page produced mostly duplicates (< 20% new), this query is exhausted
  const total = row.new_candidates + row.duplicate_count
  if (total > 0 && row.new_candidates / total < 0.2) return null

  return row.page + 1
}

export function markQueryPageExecuted(
  query: string,
  provider: string,
  page: number,
  resultCount: number,
  newCandidates: number,
  duplicateCount: number,
): void {
  getDb()
    .prepare(`
      INSERT OR REPLACE INTO executed_queries
        (query_normalized, query_original, provider, page, result_count, new_candidates, duplicate_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(query.toLowerCase().trim(), query, provider, page, resultCount, newCandidates, duplicateCount)
}

export function countExecutedQueries(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(DISTINCT query_normalized) as cnt FROM executed_queries`)
    .get() as { cnt: number }
  return row.cnt
}

export function countTotalCandidates(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as cnt FROM discovery_candidates`)
    .get() as { cnt: number }
  return row.cnt
}

export function getRunStats(runId: number): {
  total: number
  byPlatform: Record<string, number>
  byType: Record<string, number>
  byStatus: Record<string, number>
  avgScore: number
} {
  const db = getDb()

  const totalRow = db
    .prepare(`SELECT COUNT(*) as cnt, AVG(discovery_score) as avg_score FROM discovery_candidates WHERE first_run_id = ?`)
    .get(runId) as { cnt: number; avg_score: number | null }

  const platformRows = db
    .prepare(
      `SELECT COALESCE(platform, 'unknown') as key, COUNT(*) as cnt FROM discovery_candidates WHERE first_run_id = ? GROUP BY platform`
    )
    .all(runId) as { key: string; cnt: number }[]

  const typeRows = db
    .prepare(
      `SELECT url_type as key, COUNT(*) as cnt FROM discovery_candidates WHERE first_run_id = ? GROUP BY url_type`
    )
    .all(runId) as { key: string; cnt: number }[]

  const statusRows = db
    .prepare(
      `SELECT status as key, COUNT(*) as cnt FROM discovery_candidates WHERE first_run_id = ? GROUP BY status`
    )
    .all(runId) as { key: string; cnt: number }[]

  const toRecord = (rows: { key: string; cnt: number }[]): Record<string, number> =>
    Object.fromEntries(rows.map(r => [r.key, r.cnt]))

  return {
    total: totalRow.cnt,
    byPlatform: toRecord(platformRows),
    byType: toRecord(typeRows),
    byStatus: toRecord(statusRows),
    avgScore: totalRow.avg_score ?? 0,
  }
}
