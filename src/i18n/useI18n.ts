import { createContext, useContext } from 'react'
import type { LanguageCode, TranslationKey } from './translations'

export interface I18nContextValue {
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
  tCount: (key: TranslationKey, count: number, values?: Record<string, string | number>) => string
  locale: string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }
  return context
}
