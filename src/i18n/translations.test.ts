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

  it('nennt die Seite Klären und den Drawer Menü in allen Sprachen, das Rauschen bleibt als Status', () => {
    // Arrange
    const pick = (code: (typeof languages)[number]['code']) => {
      const table = translations[code] as Record<string, string>
      return [table.clarifyPageTitle, table.hiddenTools, table.noiseInbox]
    }

    // Act
    const names = Object.fromEntries(languages.map(({ code }) => [code, pick(code)]))

    // Assert
    expect(names).toEqual({
      de: ['Klären', 'Menü', 'Rauschen'],
      en: ['Clarify', 'Menu', 'Noise'],
      es: ['Aclarar', 'Menú', 'Ruido'],
      fr: ['Clarifier', 'Menu', 'Bruit']
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

describe('Klären-Beschriftungen', () => {
  it('nennt die ↑-Aktion in allen Sprachen Details und nicht wie die Seite', () => {
    // Arrange
    const pick = (code: (typeof languages)[number]['code']) => (translations[code] as Record<string, string>).detailsAction

    // Act
    const labels = Object.fromEntries(languages.map(({ code }) => [code, pick(code)]))

    // Assert
    expect(labels).toEqual({ de: 'Details', en: 'Details', es: 'Detalles', fr: 'Détails' })
  })
})
