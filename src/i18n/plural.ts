import { translations, type LanguageCode, type TranslationKey } from './translations'

const localeByLanguage: Record<LanguageCode, string> = {
  de: 'de-DE',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR'
}

export function localeFor(language: LanguageCode) {
  return localeByLanguage[language]
}

// Picks `${key}_one` for the 'one' plural category of the language, otherwise the base key.
export function pluralKey(language: LanguageCode, key: TranslationKey, count: number): TranslationKey {
  const oneKey = `${key}_one`
  if (new Intl.PluralRules(language).select(count) === 'one' && oneKey in translations[language]) {
    return oneKey as TranslationKey
  }
  return key
}
