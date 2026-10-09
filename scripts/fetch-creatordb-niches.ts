// Fetch CreatorDB niche taxonomy for all three platforms and save mapping
// files to data/creatordb-niches/{youtube,instagram,tiktok}.json.
//
// Each call costs 1 API credit. Run once and commit the output. Re-runnable:
// the old file is preserved if a fetch fails or returns success: false.
//
//   npx tsx scripts/fetch-creatordb-niches.ts
//

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'

const API_KEY = process.env.CREATORDB_API_KEY
if (!API_KEY) throw new Error('CREATORDB_API_KEY missing from .env')

const BASE_URL = 'https://apiv3.creatordb.app'
const PLATFORMS = ['youtube', 'instagram', 'tiktok'] as const
const OUT_DIR = path.join(process.cwd(), 'data', 'creatordb-niches')

interface NicheEntry {
  id: string
  name: string
  category: string
  channelCount: number
}

type NicheMap = Record<string, NicheEntry[]>

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
}

async function fetchNiches(platform: string): Promise<NicheEntry[] | null> {
  const url = `${BASE_URL}/${platform}/niches`
  console.log(`Fetching ${url} ...`)

  const res = await fetch(url, {
    headers: { 'api-key': API_KEY!, 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    console.error(`  HTTP ${res.status} for ${platform}`)
    return null
  }

  const body = await res.json()
  if (!body.success) {
    console.error(`  API returned success: false for ${platform}`)
    return null
  }

  const data: NicheEntry[] = (body.data ?? []).map((entry: any) => ({
    id: entry.id,
    name: entry.name,
    category: entry.category ?? 'All',
    channelCount: entry.channelCount ?? 0,
  }))

  console.log(`  ${data.length} niches for ${platform}`)
  return data
}

function buildMap(entries: NicheEntry[]): NicheMap {
  const map: NicheMap = {}
  for (const entry of entries) {
    const key = normalizeKey(entry.name)
    if (!key) continue
    if (!map[key]) map[key] = []
    map[key].push(entry)
  }
  // Sort each key's entries by channelCount descending
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => b.channelCount - a.channelCount)
  }
  return map
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const platform of PLATFORMS) {
    const outFile = path.join(OUT_DIR, `${platform}.json`)
    const entries = await fetchNiches(platform)
    if (!entries) {
      console.log(`  Keeping old file for ${platform} (if any)`)
      continue
    }
    const map = buildMap(entries)
    const keyCount = Object.keys(map).length
    fs.writeFileSync(outFile, JSON.stringify(map, null, 2) + '\n')
    console.log(`  Wrote ${outFile} (${keyCount} unique names, ${entries.length} total entries)`)
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
