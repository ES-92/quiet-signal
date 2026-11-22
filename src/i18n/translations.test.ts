import { describe, expect, it } from 'vitest'
import { defaultLanguage, languages, translations } from './translations'

describe('Übersetzungen', () => {
  const englishKeys = Object.keys(translations.en).sort()

  it.each(languages.map((language) => language.code))(
    'Sprache %s hat dieselbe Schlüsselmenge wie Englisch',
    (code) => {
      // Arrange
      const expected = englishKeys

      // Act
      const actual = Object.keys(translations[code]).sort()

      // Assert
      expect(actual).toEqual(expected)
    }
  )

  it.each(languages.map((language) => language.code))(
    'Sprache %s enthält keinen leeren Wert',
    (code) => {
      // Arrange
      const entries = Object.entries(translations[code])

      // Act
      const empty = entries.filter(([, value]) => value.trim() === '').map(([key]) => key)

      // Assert
      expect(empty).toEqual([])
    }
  )

  it('enthält die Verschlüsselungs-Fehlertexte in allen Sprachen', () => {
    // Arrange
    const keys = ['encryptionEnableFailed', 'encryptionDisableFailed'] as const

    // Act
    const missing = languages.flatMap(({ code }) =>
      keys.filter((key) => !(key in translations[code])).map((key) => `${code}.${key}`)
    )

    // Assert
    expect(missing).toEqual([])
  })

  it('hat die Kurzlabels der Heute-Aktionsleiste in allen Sprachen', () => {
    // Arrange
    const keys = ['actionShortMore', 'actionShortThought', 'actionShortLess', 'actionShortRest'] as const

    // Act
    const labels = Object.fromEntries(
      languages.map(({ code }) => [code, keys.map((key) => (translations[code] as Record<string, string>)[key]).join(' · ')])
    )

    // Assert
    expect(labels).toEqual({
      de: 'Öfter · Gedanke · Seltener · Ruhen',
      en: 'More · Thought · Less · Rest',
      es: 'Más · Idea · Menos · Reposo',
      fr: 'Plus · Pensée · Moins · Repos'
    })
  })

  it('hat eine Standardsprache, die in der Sprachliste vorkommt', () => {
    // Arrange
    const codes = languages.map((language) => language.code)

    // Act
    const included = codes.includes(defaultLanguage)

    // Assert
    expect(included).toBe(true)
  })
})
