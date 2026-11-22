import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, type I18nContextValue } from './useI18n'
import { localeFor, pluralKey } from './plural'
import { defaultLanguage, languages, translations, type LanguageCode } from './translations'

const storageKey = 'quiet-signal-language'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => detectInitialLanguage())

  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem(storageKey, language)
  }, [language])

  const value = useMemo<I18nContextValue>(
    () => {
      const t: I18nContextValue['t'] = (key, values) =>
        interpolate(translations[language][key] ?? translations.en[key], values)
      return {
        language,
        locale: localeFor(language),
        setLanguage: setLanguageState,
        t,
        tCount: (key, count, values) => t(pluralKey(language, key, count), { count, ...values })
      }
    },
    [language]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
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
