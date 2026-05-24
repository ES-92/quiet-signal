import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { defaultLanguage, languages, translations, type LanguageCode, type TranslationKey } from './translations'

interface I18nContextValue {
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)
const storageKey = 'commonplace-language'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => detectInitialLanguage())

  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem(storageKey, language)
  }, [language])

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      t: (key, values) => interpolate(translations[language][key] ?? translations.en[key], values)
    }),
    [language]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }
  return context
}

function detectInitialLanguage(): LanguageCode {
  const stored = localStorage.getItem(storageKey)
  if (isLanguageCode(stored)) return stored

  const browserLanguage = navigator.language.slice(0, 2).toLowerCase()
  if (isLanguageCode(browserLanguage)) return browserLanguage

  return defaultLanguage
}

function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && languages.some((language) => language.code === value)
}

function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) return template
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`{${key}}`, 'g'), String(value)),
    template
  )
}
