// One-off: build the discovery browse showcase (top 10 tri-platform Instagram
// creators) against the PROD database so every brand shares the same
// permanently cached result, then mirror the row into the local dev DB.
//
// Costs ~0.1 Influencers Club credits ONCE; reruns are free (cache hit).
//
//   npx tsx scripts/fetch-discovery-showcase.ts
//
// Note: with local/placeholder AWS creds the re-hosted avatars are written to
// public/uploads/discovery-avatars/ — commit those files so production can
// serve them.

import 'dotenv/config'

const SHOWCASE_KEY = 'showcase:instagram:v1'

async function main() {
  const neonUrl = process.env.NEON_DATABASE_URL
  const localUrl = process.env.DATABASE_URL
  if (!neonUrl) throw new Error('NEON_DATABASE_URL missing from .env')
  if (!process.env.INFLUENCERS_CLUB_API_KEY) {
    throw new Error('INFLUENCERS_CLUB_API_KEY missing from .env')
  }

  // Point the app's prisma singleton at prod BEFORE anything imports it.
  process.env.DATABASE_URL = neonUrl
  const { clubShowcase } = await import('@/lib/influencers-club')

  const result = await clubShowcase()
  console.log(result.cached ? 'Showcase served from prod cache (0 credits).' : 'Showcase fetched live (~0.1 club credits).')
  console.log(`Creators (${result.results.length}):`)
  for (const r of result.results as any[]) {
    console.log(`  @${r.handle}  ${r.follower_count?.toLocaleString?.() ?? '?'} followers  avatar=${r.avatar_url ?? 'none'}`)
  }
  if (result.credits_left != null) console.log(`Club credits left: ${result.credits_left}`)
  if (result.results.length === 0) throw new Error('Empty showcase — nothing persisted, not mirroring.')

  // Mirror the persisted prod row into the local dev DB (free).
  if (localUrl && localUrl !== neonUrl) {
    const { PrismaClient } = await import('@prisma/client')
    const prod = new PrismaClient({ datasources: { db: { url: neonUrl } } })
    const local = new PrismaClient({ datasources: { db: { url: localUrl } } })
    try {
      const row = await prod.clubSearchCache.findUnique({ where: { key: SHOWCASE_KEY } })
      if (!row) throw new Error('Prod showcase row missing after fetch')
      await local.clubSearchCache.upsert({
        where: { key: SHOWCASE_KEY },
        create: { key: row.key, request: row.request ?? undefined, data: row.data as any, fetchedAt: row.fetchedAt },
        update: { request: row.request ?? undefined, data: row.data as any, fetchedAt: row.fetchedAt },
      })
      console.log('Mirrored showcase row into local dev DB.')
    } finally {
      await Promise.all([prod.$disconnect(), local.$disconnect()])
    }
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  }
)
