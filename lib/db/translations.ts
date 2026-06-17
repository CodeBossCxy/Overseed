/**
 * Multilingual Database Helper Functions
 *
 * This module provides utilities for working with translatable content.
 * See docs/DATABASE_MULTILINGUAL.md for full documentation.
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// ===========================================
// CONFIGURATION
// ===========================================

export const SUPPORTED_LANGUAGES = ['en', 'zh'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

/**
 * Define which fields are translatable for each entity type.
 * Update this when adding new translatable fields.
 */
export const TRANSLATABLE_FIELDS = {
  Campaign: ['title', 'description', 'contentGuidelines', 'giftDescription'],
  InfluencerProfile: ['bio'],
  BrandProfile: ['description'],
  Application: ['pitchMessage'],
} as const

export type TranslatableEntity = keyof typeof TRANSLATABLE_FIELDS

// ===========================================
// TYPES
// ===========================================

export interface TranslationMeta {
  originalLanguage: string
  requestedLanguage: string
  translatedFields: string[]
  autoTranslatedFields: string[]
}

export interface WithTranslationMeta {
  _meta?: TranslationMeta
}

export interface AddTranslationParams {
  entityType: TranslatableEntity
  entityId: string
  fieldName: string
  languageCode: SupportedLanguage
  content: string
  isAutoTranslated?: boolean
}

export interface GetTranslationsParams {
  entityType: TranslatableEntity
  entityId: string
  languageCode: SupportedLanguage
  fields?: string[]
}

export interface GetManyTranslationsParams {
  entityType: TranslatableEntity
  entityIds: string[]
  languageCode: SupportedLanguage
  fields?: string[]
}

// ===========================================
// CORE FUNCTIONS
// ===========================================

/**
 * Add or update a translation for a specific field
 */
export async function addTranslation({
  entityType,
  entityId,
  fieldName,
  languageCode,
  content,
  isAutoTranslated = false,
}: AddTranslationParams) {
  return prisma.translation.upsert({
    where: {
      entityType_entityId_fieldName_languageCode: {
        entityType,
        entityId,
        fieldName,
        languageCode,
      },
    },
    update: {
      content,
      isAutoTranslated,
      updatedAt: new Date(),
    },
    create: {
      entityType,
      entityId,
      fieldName,
      languageCode,
      content,
      isAutoTranslated,
    },
  })
}

/**
 * Add multiple translations at once
 */
export async function addTranslations(
  translations: AddTranslationParams[]
): Promise<void> {
  await prisma.$transaction(
    translations.map((t) =>
      prisma.translation.upsert({
        where: {
          entityType_entityId_fieldName_languageCode: {
            entityType: t.entityType,
            entityId: t.entityId,
            fieldName: t.fieldName,
            languageCode: t.languageCode,
          },
        },
        update: {
          content: t.content,
          isAutoTranslated: t.isAutoTranslated ?? false,
          updatedAt: new Date(),
        },
        create: {
          entityType: t.entityType,
          entityId: t.entityId,
          fieldName: t.fieldName,
          languageCode: t.languageCode,
          content: t.content,
          isAutoTranslated: t.isAutoTranslated ?? false,
        },
      })
    )
  )
}

/**
 * Get translations for a single entity
 */
export async function getTranslations({
  entityType,
  entityId,
  languageCode,
  fields,
}: GetTranslationsParams) {
  const where: Prisma.TranslationWhereInput = {
    entityType,
    entityId,
    languageCode,
  }

  if (fields && fields.length > 0) {
    where.fieldName = { in: fields }
  }

  return prisma.translation.findMany({ where })
}

/**
 * Get translations for multiple entities (batch loading)
 */
export async function getManyTranslations({
  entityType,
  entityIds,
  languageCode,
  fields,
}: GetManyTranslationsParams) {
  if (entityIds.length === 0) return []

  const where: Prisma.TranslationWhereInput = {
    entityType,
    entityId: { in: entityIds },
    languageCode,
  }

  if (fields && fields.length > 0) {
    where.fieldName = { in: fields }
  }

  return prisma.translation.findMany({ where })
}

/**
 * Delete all translations for an entity
 */
export async function deleteTranslations(
  entityType: TranslatableEntity,
  entityId: string
) {
  return prisma.translation.deleteMany({
    where: { entityType, entityId },
  })
}

// ===========================================
// HIGH-LEVEL HELPERS
// ===========================================

/**
 * Apply translations to an entity object.
 * Falls back to original content if translation is missing.
 */
export function applyTranslations<T extends Record<string, unknown>>(
  entity: T & { originalLanguage?: string },
  translations: Array<{
    fieldName: string
    content: string
    isAutoTranslated: boolean
  }>,
  requestedLanguage: SupportedLanguage,
  translatableFields: readonly string[]
): T & WithTranslationMeta {
  const originalLanguage = entity.originalLanguage || DEFAULT_LANGUAGE

  // If requesting original language, no translation needed
  if (requestedLanguage === originalLanguage) {
    return {
      ...entity,
      _meta: {
        originalLanguage,
        requestedLanguage,
        translatedFields: [],
        autoTranslatedFields: [],
      },
    }
  }

  // Build translation map
  const translationMap = new Map(
    translations.map((t) => [t.fieldName, t])
  )

  // Apply translations
  const translatedFields: string[] = []
  const autoTranslatedFields: string[] = []
  const result = { ...entity }

  for (const field of translatableFields) {
    const translation = translationMap.get(field)
    if (translation && field in result) {
      ;(result as Record<string, unknown>)[field] = translation.content
      translatedFields.push(field)
      if (translation.isAutoTranslated) {
        autoTranslatedFields.push(field)
      }
    }
  }

  return {
    ...result,
    _meta: {
      originalLanguage,
      requestedLanguage,
      translatedFields,
      autoTranslatedFields,
    },
  }
}

/**
 * Apply translations to multiple entities (batch)
 */
export function applyManyTranslations<T extends Record<string, unknown> & { id: string }>(
  entities: Array<T & { originalLanguage?: string }>,
  allTranslations: Array<{
    entityId: string
    fieldName: string
    content: string
    isAutoTranslated: boolean
  }>,
  requestedLanguage: SupportedLanguage,
  translatableFields: readonly string[]
): Array<T & WithTranslationMeta> {
  // Group translations by entityId
  const translationsByEntity = new Map<
    string,
    Array<{ fieldName: string; content: string; isAutoTranslated: boolean }>
  >()

  for (const t of allTranslations) {
    const existing = translationsByEntity.get(t.entityId) || []
    existing.push({
      fieldName: t.fieldName,
      content: t.content,
      isAutoTranslated: t.isAutoTranslated,
    })
    translationsByEntity.set(t.entityId, existing)
  }

  // Apply to each entity
  return entities.map((entity) => {
    const translations = translationsByEntity.get(entity.id) || []
    return applyTranslations(
      entity,
      translations,
      requestedLanguage,
      translatableFields
    )
  })
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Check if a language is supported
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)
}

/**
 * Get language from Accept-Language header or default
 */
export function getLanguageFromHeader(
  acceptLanguage?: string | null
): SupportedLanguage {
  if (!acceptLanguage) return DEFAULT_LANGUAGE

  // Parse Accept-Language header (e.g., "en-US,en;q=0.9,zh;q=0.8")
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, qValue] = lang.trim().split(';q=')
      return {
        code: code.split('-')[0].toLowerCase(), // en-US -> en
        q: qValue ? parseFloat(qValue) : 1,
      }
    })
    .sort((a, b) => b.q - a.q)

  for (const { code } of languages) {
    if (isSupportedLanguage(code)) {
      return code
    }
  }

  return DEFAULT_LANGUAGE
}

/**
 * Get the list of translatable fields for an entity type
 */
export function getTranslatableFields(
  entityType: TranslatableEntity
): readonly string[] {
  return TRANSLATABLE_FIELDS[entityType]
}

// ===========================================
// CAMPAIGN-SPECIFIC HELPERS
// ===========================================

/**
 * Create a campaign with translations
 */
export async function createCampaignWithTranslations(
  data: Prisma.CampaignCreateInput & { originalLanguage: SupportedLanguage },
  translations?: Array<{
    languageCode: SupportedLanguage
    title?: string
    description?: string
    contentGuidelines?: string
  }>
) {
  const campaign = await prisma.campaign.create({ data })

  if (translations && translations.length > 0) {
    const translationRecords: AddTranslationParams[] = []

    for (const t of translations) {
      if (t.title) {
        translationRecords.push({
          entityType: 'Campaign',
          entityId: campaign.id,
          fieldName: 'title',
          languageCode: t.languageCode,
          content: t.title,
        })
      }
      if (t.description) {
        translationRecords.push({
          entityType: 'Campaign',
          entityId: campaign.id,
          fieldName: 'description',
          languageCode: t.languageCode,
          content: t.description,
        })
      }
      if (t.contentGuidelines) {
        translationRecords.push({
          entityType: 'Campaign',
          entityId: campaign.id,
          fieldName: 'contentGuidelines',
          languageCode: t.languageCode,
          content: t.contentGuidelines,
        })
      }
    }

    if (translationRecords.length > 0) {
      await addTranslations(translationRecords)
    }
  }

  return campaign
}

/**
 * Get a campaign with translations applied
 */
export async function getCampaignWithTranslation(
  campaignId: string,
  language: SupportedLanguage
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      brand: {
        select: { id: true, companyName: true, logoUrl: true, isVerified: true },
      },
      categories: { include: { category: true } },
      platforms: { include: { platform: true } },
      _count: { select: { applications: true } },
    },
  })

  if (!campaign) return null

  const translations = await getTranslations({
    entityType: 'Campaign',
    entityId: campaign.id,
    languageCode: language,
    fields: [...TRANSLATABLE_FIELDS.Campaign],
  })

  return applyTranslations(
    campaign,
    translations,
    language,
    TRANSLATABLE_FIELDS.Campaign
  )
}

/**
 * Get multiple campaigns with translations applied
 */
export async function getCampaignsWithTranslation(
  where: Prisma.CampaignWhereInput,
  language: SupportedLanguage,
  options?: {
    take?: number
    orderBy?: Prisma.CampaignOrderByWithRelationInput
    include?: Prisma.CampaignInclude
  }
) {
  const campaigns = await prisma.campaign.findMany({
    where,
    take: options?.take,
    orderBy: options?.orderBy,
    include: options?.include,
  })

  if (campaigns.length === 0) return []

  const translations = await getManyTranslations({
    entityType: 'Campaign',
    entityIds: campaigns.map((c) => c.id),
    languageCode: language,
    fields: [...TRANSLATABLE_FIELDS.Campaign],
  })

  return applyManyTranslations(
    campaigns,
    translations,
    language,
    TRANSLATABLE_FIELDS.Campaign
  )
}
