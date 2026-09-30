import 'dotenv/config'
import { generateQueries, type QueryGeneratorInput } from './query-generator.js'
import { createSearchProvider, type SearchProvider } from './search-provider.js'
import { normalizeUrl } from './normalizer.js'
import { classifyUrl } from './classifier.js'
import { filterUrl } from './filter.js'
import { scoreCandidate } from './scorer.js'
import {
  createRun,
  upsertCandidate,
  addSource,
  updateCandidateScore,
  completeRun,
  failRun,
  countCandidatesForRun,
  countTotalCandidates,
  getNextQueryPage,
  markQueryPageExecuted,
  type RunInput,
} from './db.js'
import { UsageTracker, type UsageStats } from './tracker.js'

export interface PipelineInput {
  niche: string
  country?: string
  cities?: string[]
  platforms: string[]
  targetCandidates?: number
  maxQueries?: number
  resultsPerQuery?: number
  delayMs?: number
  provider?: string
  searchProvider?: SearchProvider
}

export interface PipelineResult {
  runId: number
  stats: UsageStats
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function discoverCreators(input: PipelineInput): Promise<number> {
  const targetCandidates = input.targetCandidates ?? 1000
  const maxQueries = input.maxQueries ?? 500
  const resultsPerQuery = input.resultsPerQuery ?? 10
  const requestDelayMs = input.delayMs ?? 500

  const provider =
    input.searchProvider ??
    createSearchProvider({ provider: input.provider })
  const tracker = new UsageTracker()

  const runInput: RunInput = {
    niche: input.niche,
    country: input.country,
    platforms: input.platforms,
    cities: input.cities,
    targetCandidates,
  }

  const runId = createRun(runInput)

  try {
    const queryInput: QueryGeneratorInput = {
      niches: [input.niche],
      platforms: input.platforms,
      country: input.country,
      cities: input.cities,
      maxQueries,
    }

    const queries = generateQueries(queryInput)
    tracker.addQueriesGenerated(queries.length)

    // Build work list: for each query, determine the next page to fetch.
    // Exhausted queries (last page was mostly duplicates) are skipped.
    const workItems: { query: string; page: number; weight: number }[] = []
    let exhaustedCount = 0
    for (const q of queries) {
      const nextPage = getNextQueryPage(q.query)
      if (nextPage === null) {
        exhaustedCount++
        continue
      }
      workItems.push({ query: q.query, page: nextPage, weight: q.weight })
    }

    // Sort: page 0 (fresh) first, then by weight desc within same page
    workItems.sort((a, b) => a.page - b.page || b.weight - a.weight)

    if (exhaustedCount > 0) {
      console.log(`${exhaustedCount} queries exhausted (mostly duplicates), ${workItems.length} actionable`)
    }

    let executed = 0
    for (const { query, page } of workItems) {
      let response
      try {
        response = await provider.search(query, resultsPerQuery, page)
      } catch (err) {
        console.error(`\nSearch failed for "${query}" page ${page}: ${(err as Error).message}`)
        continue
      }

      tracker.addQueryExecuted()
      tracker.addApiRequest(response.creditsCost)
      tracker.addSearchResults(response.results.length)

      let pageNew = 0
      let pageDup = 0

      for (const result of response.results) {
        const { normalized, domain } = normalizeUrl(result.url)
        const classification = classifyUrl(normalized, result.title, result.description)
        const filterResult = filterUrl(normalized, classification.urlType, result.title, result.description)

        if (!filterResult.keep) continue

        const scoring = scoreCandidate({
          url: result.url,
          normalizedUrl: normalized,
          domain,
          urlType: classification.urlType,
          platform: classification.platform,
          extractedHandle: classification.extractedHandle,
          title: result.title,
          description: result.description,
          searchRank: result.rank + page * resultsPerQuery,
          timesDiscovered: 1,
        })

        const { id: candidateId, isNew } = upsertCandidate({
          url: result.url,
          normalizedUrl: normalized,
          domain,
          urlType: classification.urlType,
          platform: classification.platform,
          extractedHandle: classification.extractedHandle,
          title: result.title,
          description: result.description,
          discoveryScore: scoring.score,
          crawlEligible: true,
          runId,
        })

        if (isNew) {
          tracker.addUniqueUrl()
          tracker.addCandidate()
          pageNew++
        } else {
          tracker.addDuplicate()
          updateCandidateScore(candidateId, scoring.score)
          pageDup++
        }

        addSource(candidateId, {
          runId,
          query,
          provider: provider.name,
          searchRank: result.rank,
          resultTitle: result.title,
          resultDescription: result.description,
        })
      }

      // Record this page's yield so future runs know whether to go deeper
      markQueryPageExecuted(query, provider.name, page, response.results.length, pageNew, pageDup)
      executed++

      if (executed % 10 === 0 || executed === workItems.length) {
        const total = countTotalCandidates()
        const thisRun = countCandidatesForRun(runId)
        process.stdout.write(
          `\r[query ${executed}/${workItems.length}] ${thisRun} new this run, ${total} total (page ${page})`
        )
      }

      const thisRunCount = countCandidatesForRun(runId)
      if (thisRunCount >= targetCandidates) {
        const total = countTotalCandidates()
        process.stdout.write(
          `\r[query ${executed}/${workItems.length}] ${thisRunCount} new this run, ${total} total — target reached\n`
        )
        break
      }

      if (executed < workItems.length) {
        await sleep(requestDelayMs)
      }
    }

    process.stdout.write('\n')

    const stats = tracker.getStats()
    completeRun(runId, stats)
    tracker.printSummary()

    return runId
  } catch (err) {
    failRun(runId, (err as Error).message)
    throw err
  }
}
