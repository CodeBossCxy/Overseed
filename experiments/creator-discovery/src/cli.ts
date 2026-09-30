import { Command } from 'commander'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function loadEnv(): void {
  dotenv.config({ path: resolve(__dirname, '..', '.env.discovery') })
}

const program = new Command()

program
  .name('cli')
  .description('Creator discovery CLI')

// -- discover --

program
  .command('discover')
  .description('Discover creators for a niche')
  .requiredOption('--niche <niche>', 'Niche to discover (e.g. beauty, fitness)')
  .option('--country <code>', 'Country code (e.g. US, UK, CA)')
  .option('--city <city...>', 'Cities to target (repeatable)')
  .option('--platform <platform...>', 'Platforms (repeatable)', ['instagram', 'tiktok', 'youtube'])
  .option('--target <n>', 'Target number of candidates', '1000')
  .option('--max-queries <n>', 'Maximum queries to generate', '500')
  .option('--results-per-query <n>', 'Results per search query', '10')
  .option('--delay <ms>', 'Delay between API requests in ms', '500')
  .option('--provider <name>', 'Search provider: serper | mock (default: auto)')
  .action(async (opts) => {
    loadEnv()
    try {
      const { discoverCreators } = await import('./pipeline.js')
      const runId = await discoverCreators({
        niche: opts.niche,
        country: opts.country,
        cities: opts.city,
        platforms: opts.platform,
        targetCandidates: parseInt(opts.target, 10),
        maxQueries: parseInt(opts.maxQueries, 10),
        resultsPerQuery: parseInt(opts.resultsPerQuery, 10),
        delayMs: parseInt(opts.delay, 10),
        provider: opts.provider,
      })
      console.log(`Discovery complete! Run ID: ${runId}`)
      console.log(`Export results: npm run export -- --run-id ${runId} --output data/results.csv`)
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

// -- export --

program
  .command('export')
  .description('Export discovery candidates to CSV')
  .option('--run-id <id>', 'Export candidates from a specific run')
  .option('--min-score <n>', 'Minimum discovery score', '0')
  .option('--platform <platform>', 'Filter by platform')
  .option('--type <type>', 'Filter by URL type')
  .option('--limit <n>', 'Max rows to export')
  .option('--output <path>', 'Output CSV path', 'data/export.csv')
  .action(async (opts) => {
    loadEnv()
    try {
      const { exportToCsv } = await import('./export.js')
      const count = await exportToCsv({
        runId: opts.runId ? parseInt(opts.runId, 10) : undefined,
        minScore: parseFloat(opts.minScore),
        platform: opts.platform,
        type: opts.type,
        limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        output: opts.output,
      })
      console.log(`Exported ${count} candidates to ${opts.output}`)
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

// -- stats --

program
  .command('stats')
  .description('Show discovery run statistics')
  .option('--run-id <id>', 'Show stats for a specific run (or list all runs)')
  .action(async (opts) => {
    loadEnv()
    try {
      const { getRun, getRunStats, listRuns } = await import('./db.js')

      if (opts.runId) {
        const runId = parseInt(opts.runId, 10)
        const run = getRun(runId)
        if (!run) {
          console.error(`Run #${runId} not found`)
          process.exit(1)
        }

        const platforms: string[] = JSON.parse(run.platforms ?? '[]')
        const stats = getRunStats(runId)

        const queriesExecuted: number = run.queries_executed ?? 0
        const queriesGenerated: number = run.queries_generated ?? 0
        const searchResults: number = run.search_results ?? 0
        const candidatesFound: number = run.candidates_found ?? 0
        const duplicatesRemoved: number = run.duplicates_removed ?? 0
        const estimatedCost: number = run.estimated_cost_usd ?? 0

        console.log(`Run #${run.id} — ${run.niche}${run.country ? ' / ' + run.country : ''} / ${platforms.join(',')}`)
        console.log(`Status: ${run.status}`)
        console.log(`Started: ${run.started_at ?? 'N/A'}`)
        console.log(`Completed: ${run.completed_at ?? 'N/A'}`)
        console.log()
        console.log(`Queries: ${queriesExecuted} executed / ${queriesGenerated} generated`)
        console.log(`Results: ${searchResults} search results → ${candidatesFound} candidates (${duplicatesRemoved} dupes removed)`)
        console.log(`Cost: $${estimatedCost.toFixed(2)}`)
        console.log()

        console.log('By platform:')
        for (const [platform, count] of Object.entries(stats.byPlatform)) {
          console.log(`  ${platform}: ${count}`)
        }
        console.log()

        console.log('By type:')
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`  ${type}: ${count}`)
        }
        console.log()

        console.log('Score distribution:')
        const buckets: Record<string, number> = {
          '80-100': 0,
          '60-79': 0,
          '40-59': 0,
          '20-39': 0,
          '0-19': 0,
        }
        // Re-query for score distribution from db
        const { getDb } = await import('./db.js')
        const db = getDb()
        const scoreRows = db
          .prepare(
            `SELECT
              SUM(CASE WHEN discovery_score >= 80 THEN 1 ELSE 0 END) as s80,
              SUM(CASE WHEN discovery_score >= 60 AND discovery_score < 80 THEN 1 ELSE 0 END) as s60,
              SUM(CASE WHEN discovery_score >= 40 AND discovery_score < 60 THEN 1 ELSE 0 END) as s40,
              SUM(CASE WHEN discovery_score >= 20 AND discovery_score < 40 THEN 1 ELSE 0 END) as s20,
              SUM(CASE WHEN discovery_score < 20 THEN 1 ELSE 0 END) as s0
            FROM discovery_candidates WHERE first_run_id = ?`
          )
          .get(runId) as { s80: number; s60: number; s40: number; s20: number; s0: number }

        buckets['80-100'] = scoreRows.s80 ?? 0
        buckets['60-79'] = scoreRows.s60 ?? 0
        buckets['40-59'] = scoreRows.s40 ?? 0
        buckets['20-39'] = scoreRows.s20 ?? 0
        buckets['0-19'] = scoreRows.s0 ?? 0

        const maxLen = Math.max(...Object.values(buckets).map(n => String(n).length))
        for (const [label, count] of Object.entries(buckets)) {
          console.log(`  ${label}: ${String(count).padStart(maxLen)}`)
        }
      } else {
        const runs = listRuns()
        if (runs.length === 0) {
          console.log('No discovery runs found.')
          return
        }
        console.log(`${'ID'.padEnd(6)} ${'Niche'.padEnd(16)} ${'Country'.padEnd(8)} ${'Status'.padEnd(12)} ${'Candidates'.padEnd(12)} Started`)
        console.log('-'.repeat(72))
        for (const run of runs) {
          const id = String(run.id).padEnd(6)
          const niche = (run.niche ?? '').padEnd(16)
          const country = (run.country ?? '-').padEnd(8)
          const status = (run.status ?? '').padEnd(12)
          const candidates = String(run.candidates_found ?? 0).padEnd(12)
          const started = run.started_at ?? 'N/A'
          console.log(`${id} ${niche} ${country} ${status} ${candidates} ${started}`)
        }
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

program.parse()
