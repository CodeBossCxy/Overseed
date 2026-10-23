/**
 * Translation Service
 *
 * Provides automatic translation for database content.
 * Uses Google Translate API or falls back to simple dictionary-based translation.
 */

import { prisma } from './prisma'
import {
  SupportedLanguage,
  TRANSLATABLE_FIELDS,
  TranslatableEntity,
  addTranslation
} from './db/translations'

// ===========================================
// TRANSLATION API
// ===========================================

/**
 * Translate text using Google Cloud Translation API
 * Set GOOGLE_TRANSLATE_API_KEY in your .env file
 */
async function googleTranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'en'
): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY

  if (!apiKey) {
    // Fall back to simple translation if no API key
    return freeTranslate(text, targetLang, sourceLang)
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text',
        }),
      }
    )

    const data = await response.json()

    if (data.data?.translations?.[0]?.translatedText) {
      return data.data.translations[0].translatedText
    }

    return text
  } catch (error) {
    console.error('Google Translate error:', error)
    return freeTranslate(text, targetLang, sourceLang)
  }
}

/**
 * Free translation using MyMemory API
 * No API key required (up to 5000 chars/day anonymous, more with email)
 */
async function freeTranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'en'
): Promise<string> {
  if (!text || targetLang === sourceLang) return text

  // MyMemory uses language codes like "en|zh" (simplified Chinese)
  const langMap: Record<string, string> = { zh: 'zh-CN' }
  const target = langMap[targetLang] || targetLang
  const source = langMap[sourceLang] || sourceLang

  try {
    // Split long text into chunks (MyMemory has 500 char limit per request)
    const MAX_CHUNK = 500
    if (text.length <= MAX_CHUNK) {
      return await translateChunk(text, source, target)
    }

    // Split by paragraphs/sentences to stay under limit
    const paragraphs = text.split(/\n+/)
    const translatedParts: string[] = []

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        translatedParts.push(paragraph)
        continue
      }
      if (paragraph.length <= MAX_CHUNK) {
        translatedParts.push(await translateChunk(paragraph, source, target))
      } else {
        // Split by sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]*/g) || [paragraph]
        let chunk = ''
        const chunks: string[] = []
        for (const sentence of sentences) {
          if ((chunk + sentence).length > MAX_CHUNK && chunk) {
            chunks.push(chunk)
            chunk = sentence
          } else {
            chunk += sentence
          }
        }
        if (chunk) chunks.push(chunk)

        const translated = await Promise.all(
          chunks.map((c) => translateChunk(c, source, target))
        )
        translatedParts.push(translated.join(''))
      }
    }

    return translatedParts.join('\n')
  } catch (error) {
    console.error('Free translate error:', error)
    return text // Return original text on failure instead of garbled mix
  }
}

async function translateChunk(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`
  const response = await fetch(url)
  const data = await response.json()

  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText
  }

  return text
}

// ===========================================
// MAIN TRANSLATION FUNCTION
// ===========================================

/**
 * Translate text to target language
 */
export async function translateText(
  text: string,
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = 'en'
): Promise<string> {
  if (!text || targetLang === sourceLang) return text
  return googleTranslate(text, targetLang, sourceLang)
}

/**
 * Translate multiple texts at once
 */
export async function translateTexts(
  texts: string[],
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = 'en'
): Promise<string[]> {
  if (targetLang === sourceLang) return texts

  return Promise.all(
    texts.map((text) => translateText(text, targetLang, sourceLang))
  )
}

// ===========================================
// AUTO-TRANSLATE AND STORE
// ===========================================

/**
 * Auto-translate an entity's fields and store in database
 */
export async function autoTranslateEntity(
  entityType: TranslatableEntity,
  entityId: string,
  originalData: Record<string, unknown>,
  originalLanguage: SupportedLanguage,
  targetLanguage: SupportedLanguage
): Promise<void> {
  if (originalLanguage === targetLanguage) return

  const fields = TRANSLATABLE_FIELDS[entityType]

  for (const field of fields) {
    const originalText = originalData[field]
    if (typeof originalText === 'string' && originalText.trim()) {
      // Check if translation already exists
      const existing = await prisma.translation.findUnique({
        where: {
          entityType_entityId_fieldName_languageCode: {
            entityType,
            entityId,
            fieldName: field,
            languageCode: targetLanguage,
          },
        },
      })

      if (!existing) {
        const translatedText = await translateText(
          originalText,
          targetLanguage,
          originalLanguage
        )

        await addTranslation({
          entityType,
          entityId,
          fieldName: field,
          languageCode: targetLanguage,
          content: translatedText,
          isAutoTranslated: true,
        })
      }
    }
  }
}

/**
 * Auto-translate multiple entities
 */
export async function autoTranslateEntities(
  entityType: TranslatableEntity,
  entities: Array<{ id: string; originalLanguage?: string } & Record<string, unknown>>,
  targetLanguage: SupportedLanguage
): Promise<void> {
  for (const entity of entities) {
    const originalLang = (entity.originalLanguage || 'en') as SupportedLanguage
    await autoTranslateEntity(
      entityType,
      entity.id,
      entity,
      originalLang,
      targetLanguage
    )
  }
}

// ===========================================
// GET TRANSLATED CONTENT
// ===========================================

/**
 * Get entity with translations, auto-translating if needed
 */
export async function getTranslatedEntity<T extends { id: string; originalLanguage?: string }>(
  entityType: TranslatableEntity,
  entity: T,
  targetLanguage: SupportedLanguage
): Promise<T> {
  const originalLang = (entity.originalLanguage || 'en') as SupportedLanguage

  if (originalLang === targetLanguage) {
    return entity
  }

  const fields = TRANSLATABLE_FIELDS[entityType]

  // Get existing translations
  const translations = await prisma.translation.findMany({
    where: {
      entityType,
      entityId: entity.id,
      languageCode: targetLanguage,
      fieldName: { in: [...fields] },
    },
  })

  const translationMap = new Map(
    translations.map((t) => [t.fieldName, t.content])
  )

  // Check which fields need auto-translation
  const missingFields: string[] = []
  for (const field of fields) {
    if (!translationMap.has(field) && (entity as Record<string, unknown>)[field]) {
      missingFields.push(field)
    }
  }

  // Auto-translate missing fields
  if (missingFields.length > 0) {
    for (const field of missingFields) {
      const originalText = (entity as Record<string, unknown>)[field]
      if (typeof originalText === 'string' && originalText.trim()) {
        // Detect actual content language to avoid translating text that's already
        // in the target language (e.g. Chinese content with originalLanguage='en')
        const cjkCount = (originalText.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
        const cjkRatio = cjkCount / originalText.length
        const actualLang = cjkRatio > 0.15 ? 'zh' : cjkRatio < 0.05 && /[a-zA-Z]/.test(originalText) ? 'en' : null
        if (actualLang && actualLang === targetLanguage) {
          // Content is already in the target language — skip translation
          continue
        }
        const sourceLang = actualLang || originalLang
        const translatedText = await translateText(
          originalText,
          targetLanguage,
          sourceLang
        )

        await addTranslation({
          entityType,
          entityId: entity.id,
          fieldName: field,
          languageCode: targetLanguage,
          content: translatedText,
          isAutoTranslated: true,
        })

        translationMap.set(field, translatedText)
      }
    }
  }

  // Apply translations to entity
  const result = { ...entity }
  for (const [field, content] of translationMap) {
    if (field in result) {
      (result as Record<string, unknown>)[field] = content
    }
  }

  return result
}

/**
 * Get multiple entities with translations
 */
export async function getTranslatedEntities<T extends { id: string; originalLanguage?: string }>(
  entityType: TranslatableEntity,
  entities: T[],
  targetLanguage: SupportedLanguage
): Promise<T[]> {
  if (entities.length === 0) return []

  // Batch get all existing translations
  const entityIds = entities.map((e) => e.id)
  const fields = TRANSLATABLE_FIELDS[entityType]

  const allTranslations = await prisma.translation.findMany({
    where: {
      entityType,
      entityId: { in: entityIds },
      languageCode: targetLanguage,
      fieldName: { in: [...fields] },
    },
  })

  // Group translations by entity ID
  const translationsByEntity = new Map<string, Map<string, string>>()
  for (const t of allTranslations) {
    if (!translationsByEntity.has(t.entityId)) {
      translationsByEntity.set(t.entityId, new Map())
    }
    translationsByEntity.get(t.entityId)!.set(t.fieldName, t.content)
  }

  // Process each entity
  const results: T[] = []

  for (const entity of entities) {
    const originalLang = (entity.originalLanguage || 'en') as SupportedLanguage

    if (originalLang === targetLanguage) {
      results.push(entity)
      continue
    }

    const entityTranslations = translationsByEntity.get(entity.id) || new Map()

    // Check for missing translations and auto-translate
    for (const field of fields) {
      const originalText = (entity as Record<string, unknown>)[field]
      if (
        typeof originalText === 'string' &&
        originalText.trim() &&
        !entityTranslations.has(field)
      ) {
        const translatedText = await translateText(
          originalText,
          targetLanguage,
          originalLang
        )

        await addTranslation({
          entityType,
          entityId: entity.id,
          fieldName: field,
          languageCode: targetLanguage,
          content: translatedText,
          isAutoTranslated: true,
        })

        entityTranslations.set(field, translatedText)
      }
    }

    // Apply translations
    const result = { ...entity }
    for (const [field, content] of entityTranslations) {
      if (field in result) {
        (result as Record<string, unknown>)[field] = content
      }
    }

    results.push(result)
  }

  return results
}
