export interface UsageStats {
  queriesGenerated: number
  queriesExecuted: number
  apiRequests: number
  searchResults: number
  uniqueUrls: number
  candidatesFound: number
  duplicatesRemoved: number
  estimatedCostUsd: number
}

export class UsageTracker {
  private stats: UsageStats = {
    queriesGenerated: 0,
    queriesExecuted: 0,
    apiRequests: 0,
    searchResults: 0,
    uniqueUrls: 0,
    candidatesFound: 0,
    duplicatesRemoved: 0,
    estimatedCostUsd: 0,
  }

  addQueriesGenerated(n: number): void {
    this.stats.queriesGenerated += n
  }

  addQueryExecuted(): void {
    this.stats.queriesExecuted += 1
  }

  addApiRequest(cost: number): void {
    this.stats.apiRequests += 1
    this.stats.estimatedCostUsd += cost
  }

  addSearchResults(n: number): void {
    this.stats.searchResults += n
  }

  addUniqueUrl(): void {
    this.stats.uniqueUrls += 1
  }

  addCandidate(): void {
    this.stats.candidatesFound += 1
  }

  addDuplicate(): void {
    this.stats.duplicatesRemoved += 1
  }

  getStats(): UsageStats {
    return { ...this.stats }
  }

  printSummary(): void {
    const s = this.stats
    const fmt = (n: number): string => n.toLocaleString('en-US')
    const cost = `$${s.estimatedCostUsd.toFixed(2)}`

    console.log('═══════════════════════════════════════')
    console.log('  Discovery Run Summary')
    console.log('═══════════════════════════════════════')
    console.log(`  Queries generated:  ${fmt(s.queriesGenerated).padStart(7)}`)
    console.log(`  Queries executed:   ${fmt(s.queriesExecuted).padStart(7)}`)
    console.log(`  API requests:       ${fmt(s.apiRequests).padStart(7)}`)
    console.log(`  Search results:     ${fmt(s.searchResults).padStart(7)}`)
    console.log(`  Unique URLs:        ${fmt(s.uniqueUrls).padStart(7)}`)
    console.log(`  Creator candidates: ${fmt(s.candidatesFound).padStart(7)}`)
    console.log(`  Duplicates removed: ${fmt(s.duplicatesRemoved).padStart(7)}`)
    console.log(`  Estimated cost:     ${cost.padStart(7)}`)
    console.log('═══════════════════════════════════════')
  }
}
