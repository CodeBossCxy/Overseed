import { nav } from './locales/nav'
import { auth } from './locales/auth'
import { workspace } from './locales/workspace'
import { campaigns } from './locales/campaigns'
import { brand } from './locales/brand'
import { creator } from './locales/creator'
import { ai } from './locales/ai'
import { messages } from './locales/messages'
import { settings } from './locales/settings'
import { pricing } from './locales/pricing'
import { content } from './locales/content'
import { misc } from './locales/misc'

export type Locale = 'en' | 'zh'

export const translations = {
  en: { ...nav.en, ...auth.en, ...workspace.en, ...campaigns.en, ...brand.en, ...creator.en, ...ai.en, ...messages.en, ...settings.en, ...pricing.en, ...content.en, ...misc.en },
  zh: { ...nav.zh, ...auth.zh, ...workspace.zh, ...campaigns.zh, ...brand.zh, ...creator.zh, ...ai.zh, ...messages.zh, ...settings.zh, ...pricing.zh, ...content.zh, ...misc.zh },
} as const

export type TranslationKey = keyof typeof translations.en

type DeepShape<T> = {
  readonly [K in keyof T]: T[K] extends readonly (infer U)[]
    ? readonly (U extends object ? DeepShape<U> : string)[]
    : T[K] extends object
      ? DeepShape<T[K]>
      : string
}
const _assertLocaleShapes: Record<Locale, DeepShape<typeof translations.en>> = translations
void _assertLocaleShapes
