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
        signal: AbortSignal.timeout(8000),
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

    // Split by paragraphs/sentences to stay under limit, then translate in parallel
    const paragraphs = text.split(/\n+/)
    const allChunks: { index: number; text: string; isBlank: boolean }[] = []

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i]
      if (!paragraph.trim()) {
        allChunks.push({ index: i, text: paragraph, isBlank: true })
        continue
      }
      if (paragraph.length <= MAX_CHUNK) {
        allChunks.push({ index: i, text: paragraph, isBlank: false })
      } else {
        const sentences = paragraph.match(/[^.!?]+[.!?]*/g) || [paragraph]
        let chunk = ''
        for (const sentence of sentences) {
          if ((chunk + sentence).length > MAX_CHUNK && chunk) {
            allChunks.push({ index: i, text: chunk, isBlank: false })
            chunk = sentence
          } else {
            chunk += sentence
          }
        }
        if (chunk) allChunks.push({ index: i, text: chunk, isBlank: false })
      }
    }

    // Translate all non-blank chunks in parallel
    const results = await Promise.all(
      allChunks.map(async (c) =>
        c.isBlank ? c.text : translateChunk(c.text, source, target)
      )
    )

    // Reassemble by paragraph index
    const byParagraph = new Map<number, string[]>()
    allChunks.forEach((c, i) => {
      if (!byParagraph.has(c.index)) byParagraph.set(c.index, [])
      byParagraph.get(c.index)!.push(results[i])
    })
    return Array.from(byParagraph.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, parts]) => parts.join(''))
      .join('\n')
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
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
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
/**
 * Fix common markdown corruption from machine translation services.
 *
 * Google Translate specifically:
 * - Splits "##" into "# #" (inserts space between hash marks)
 * - Splits "**bold**" into "* *bold* *" (spaces inside star pairs)
 * - Converts "- " list markers into "·" or "•"
 * - HTML-encodes special characters
 */
function repairMarkdown(translated: string): string {
  let t = translated

  // Google Translate splits "##" → "# #", "###" → "# # #" etc.
  // Reassemble consecutive "# " sequences at line start into proper heading markers
  t = t.replace(/^(#\s)+#(?=\s|\S)/gm, (match) => {
    const level = (match.match(/#/g) || []).length
    return '#'.repeat(level)
  })

  // "#Title" → "# Title" (missing space after heading markers)
  t = t.replace(/^(#{1,6})([^ #\n])/gm, '$1 $2')

  // Google Translate splits "**" → "* *" — reassemble bold markers
  // "* *text* *" → "**text**"
  t = t.replace(/\*\s\*/g, '**')

  // "· item" or "• item" → "- item" (wrong bullet markers)
  t = t.replace(/^(\s*)[·•]\s*/gm, '$1- ')

  // Google Translate may HTML-encode: &quot; &#39; &amp; &lt; &gt;
  t = t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

  // Clean up stray spaces *inside* bold markers only:
  // "**  text**" → "**text**" (leading space after opening **)
  // "text  **" → "text**" (trailing space before closing **)
  // But do NOT remove space BEFORE opening ** (e.g. "- **text**" must keep the "- ")
  t = t.replace(/(\*\*)\s+/g, '$1')  // remove space after opening **
  t = t.replace(/\s+(\*\*)/g, '$1')  // remove space before closing **
  // Restore necessary space after list markers: "-**" → "- **"
  t = t.replace(/^(\s*-)\*\*/gm, '$1 **')

  return t
}

export async function translateText(
  text: string,
  targetLang: SupportedLanguage,
  sourceLang: SupportedLanguage = 'en'
): Promise<string> {
  if (!text || targetLang === sourceLang) return text
  const translated = await googleTranslate(text, targetLang, sourceLang)
  return repairMarkdown(translated)
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

  // Check which fields need auto-translation (missing or suspiciously truncated)
  const missingFields: string[] = []
  for (const field of fields) {
    const original = (entity as Record<string, unknown>)[field]
    if (!original) continue
    const cached = translationMap.get(field)
    if (!cached) {
      missingFields.push(field)
    } else if (typeof original === 'string' && cached.length < original.length * 0.3 && original.length > 100) {
      // Cached translation is less than 30% of original length — likely truncated/corrupt
      missingFields.push(field)
      translationMap.delete(field)
      // Delete the corrupt cached entry
      prisma.translation.deleteMany({
        where: { entityType, entityId: entity.id, fieldName: field, languageCode: targetLanguage },
      }).catch(() => {})
    }
  }

  // Auto-translate missing fields in parallel
  if (missingFields.length > 0) {
    await Promise.all(missingFields.map(async (field) => {
      const originalText = (entity as Record<string, unknown>)[field]
      if (typeof originalText === 'string' && originalText.trim()) {
        // Detect actual content language to avoid translating text that's already
        // in the target language (e.g. Chinese content with originalLanguage='en')
        const cjkCount = (originalText.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
        const cjkRatio = cjkCount / originalText.length
        const actualLang = cjkRatio > 0.15 ? 'zh' : cjkRatio < 0.05 && /[a-zA-Z]/.test(originalText) ? 'en' : null
        if (actualLang && actualLang === targetLanguage) {
          return // Content is already in the target language
        }
        const sourceLang = actualLang || originalLang
        try {
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
        } catch {
          // Translation failed for this field — keep original
        }
      }
    }))
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
