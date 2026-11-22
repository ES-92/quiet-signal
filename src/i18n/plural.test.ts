import { describe, expect, it } from 'vitest'
import { pluralKey } from './plural'
import { translations } from './translations'

describe('pluralKey', () => {
  it.each(['de', 'en', 'es', 'fr'] as const)('wählt die Einzahl für 1 in %s', (language) => {
    expect(pluralKey(language, 'importedQuotes', 1)).toBe('importedQuotes_one')
  })

  it.each(['de', 'en', 'es', 'fr'] as const)('wählt die Mehrzahl für 5 in %s', (language) => {
    expect(pluralKey(language, 'importedQuotes', 5)).toBe('importedQuotes')
  })

  it('behandelt 0 sprachabhängig: Mehrzahl in de/en/es, Einzahl in fr', () => {
    expect(pluralKey('de', 'dataBooksValue', 0)).toBe('dataBooksValue')
    expect(pluralKey('en', 'dataBooksValue', 0)).toBe('dataBooksValue')
    expect(pluralKey('es', 'dataBooksValue', 0)).toBe('dataBooksValue')
    expect(pluralKey('fr', 'dataBooksValue', 0)).toBe('dataBooksValue_one')
  })

  it('fällt auf den Basisschlüssel zurück, wenn es keine _one-Variante gibt', () => {
    expect(pluralKey('de', 'today', 1)).toBe('today')
  })

  it('liefert für jede Sprache alle _one-Varianten des Englischen', () => {
    const oneKeys = Object.keys(translations.en).filter((key) => key.endsWith('_one'))
    expect(oneKeys.length).toBeGreaterThan(0)
    for (const language of ['de', 'es', 'fr'] as const) {
      expect(Object.keys(translations[language]).filter((key) => key.endsWith('_one'))).toEqual(oneKeys)
    }
  })
})
