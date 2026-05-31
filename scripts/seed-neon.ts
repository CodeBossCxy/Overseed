import { PrismaClient } from '@prisma/client'

const localDb = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres@localhost:5432/overseeddb' } },
})

const neonDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.NEON_DATABASE_URL!,
    },
  },
})
                            
async function safeInsert(label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e: any) {
    if (e.code === 'P2002') {
      // duplicate — skip silently
    } else {
      console.error(`  Error on ${label}:`, e.message)
    }
  }
}

async function main() {
  console.log('Fetching local data...\n')

  // 1. Users
  const users = await localDb.user.findMany()
  console.log(`Users: ${users.length}`)
  for (const u of users) {
    await safeInsert(u.email, () => neonDb.user.create({ data: u }))
  }
  console.log('  Done')

  // 2. Brand profiles
  const brands = await localDb.brandProfile.findMany()
  console.log(`Brand profiles: ${brands.length}`)
  for (const b of brands) {
    await safeInsert(b.id, () => neonDb.brandProfile.create({ data: b }))
  }
  console.log('  Done')

  // 3. Influencer profiles
  const influencers = await localDb.influencerProfile.findMany()
  console.log(`Influencer profiles: ${influencers.length}`)
  for (const i of influencers) {
    await safeInsert(i.id, () => neonDb.influencerProfile.create({ data: i }))
  }
  console.log('  Done')

  // 4. Categories
  const categories = await localDb.category.findMany()
  console.log(`Categories: ${categories.length}`)
  for (const c of categories) {
    await safeInsert(String(c.id), () => neonDb.category.create({ data: c }))
  }
  console.log('  Done')

  // 5. Platforms
  const platforms = await localDb.platform.findMany()
  console.log(`Platforms: ${platforms.length}`)
  for (const p of platforms) {
    await safeInsert(String(p.id), () => neonDb.platform.create({ data: p }))
  }
  console.log('  Done')

  // 6. Influencer social accounts
  const socialAccounts = await localDb.influencerSocialAccount.findMany()
  console.log(`Social accounts: ${socialAccounts.length}`)
  for (const s of socialAccounts) {
    await safeInsert(s.id, () => neonDb.influencerSocialAccount.create({ data: s }))
  }
  console.log('  Done')

  // 7. Campaigns
  const campaigns = await localDb.campaign.findMany()
  console.log(`Campaigns: ${campaigns.length}`)
  for (const c of campaigns) {
    await safeInsert(c.id, () => neonDb.campaign.create({ data: c }))
  }
  console.log('  Done')

  // 8. Campaign platforms
  const campaignPlatforms = await localDb.campaignPlatform.findMany()
  console.log(`Campaign platforms: ${campaignPlatforms.length}`)
  for (const cp of campaignPlatforms) {
    await safeInsert(`${cp.campaignId}-${cp.platformId}`, () =>
      neonDb.campaignPlatform.create({ data: cp })
    )
  }
  console.log('  Done')

  // 9. Campaign categories
  const campaignCategories = await localDb.campaignCategory.findMany()
  console.log(`Campaign categories: ${campaignCategories.length}`)
  for (const cc of campaignCategories) {
    await safeInsert(`${cc.campaignId}-${cc.categoryId}`, () =>
      neonDb.campaignCategory.create({ data: cc })
    )
  }
  console.log('  Done')

  // 10. Campaign follower requirements
  const followerReqs = await localDb.campaignFollowerRequirement.findMany()
  console.log(`Follower requirements: ${followerReqs.length}`)
  for (const fr of followerReqs) {
    await safeInsert(fr.id, () =>
      neonDb.campaignFollowerRequirement.create({ data: fr })
    )
  }
  console.log('  Done')

  // 11. Applications
  const applications = await localDb.application.findMany()
  console.log(`Applications: ${applications.length}`)
  for (const a of applications) {
    await safeInsert(a.id, () => neonDb.application.create({ data: a }))
  }
  console.log('  Done')

  console.log('\nAll data synced to Neon!')
}

main()
  .catch(console.error)
  .finally(async () => {
    await localDb.$disconnect()
    await neonDb.$disconnect()
  })
