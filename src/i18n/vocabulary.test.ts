import { describe, expect, it } from 'vitest'
import { languages, translations, type LanguageCode } from './translations'

type Table = Record<string, string>

// Words that belonged to older versions of the product and must not come back in user-facing text.
// Import-specific wording (Kindle/Readwise highlights) and file formats are allowed where the file matters.
const banned: Record<LanguageCode, RegExp> = {
  de: /review|daily|swipe-?stapel|lesestapel|book intelligence|zitat|gefällt|\blikes?\b|highlight|täglicher stapel|json|\bArt\b|\bOrt\b/i,
  en: /review stack|highlights?\b|\blikes?\b|daily (stack|review|deck|reading)|swipe stack|book intelligence|\bquotes?\b|json/i,
  es: /pila de revisión|destacados|me gusta|pila diaria|repaso diario|mazo|lectura diaria|book intelligence|\bcitas?\b|json|\bDaily\b/i,
  fr: /pile de révision|extraits?|j[’']aime|pile quotidienne|révision quotidienne|citations?|book intelligence|json|\bDaily\b/i
}

const allowed: Record<string, RegExp> = {
  // The file format matters here.
  importExportIntro: /json/i,
  importHelp: /json/i,
  // These literally mean an imported Readwise highlight.
  readwiseCsvHelp: /highlights?|destacados|extraits?/i,
  readwiseNothing: /highlights?|destacados|extraits?/i,
  release030Kindle: /highlights?/i,
  noBooksBody: /highlights?/i,
  kindleHelp: /highlights?/i,
  kindleNothing: /highlights?/i,
  // The verb "gefällt" (enjoy), not the removed Gefällt-mir button.
  supportProjectBody: /gefällt/i
}

describe('Wortschatz', () => {
  it.each(languages.map((language) => language.code))('Sprache %s enthält kein veraltetes Vokabular', (code) => {
    // Arrange
    const table = translations[code] as Table

    // Act
    const offenders = Object.entries(table)
      .filter(([key, value]) => {
        const hit = value.replace(/\{\w+\}/g, '').match(banned[code])
        if (!hit) return false
        const exception = allowed[key]
        return !(exception && exception.test(hit[0]))
      })
      .map(([key, value]) => `${key}: ${value}`)

    // Assert
    expect(offenders).toEqual([])
  })

  it('nennt in allen Sprachen keine Likes mehr in der Oberfläche', () => {
    // Arrange
    const keys = Object.keys(translations.en).filter((key) => /^likes/i.test(key))

    // Act / Assert
    expect(keys).toEqual([])
  })
})

describe('Bücher-Einleitung', () => {
  it.each(languages.map((language) => language.code))(
    'Sprache %s verspricht nicht, dass Bücher die Wiederkehr steuern',
    (code) => {
      // Arrange
      const intro = (translations[code] as Table).booksIntro

      // Act
      const promisesRecurrence = /öfter|wiederkehr|return|more often|vuelv|volver|reviennent|revenir|plus souvent|con más frecuencia/i.test(intro)

      // Assert
      expect(promisesRecurrence).toBe(false)
    }
  )

  it('beschreibt, was Bücher heute tun: Einträge gruppieren, umbenennen, zusammenführen', () => {
    // Arrange / Act
    const intro = translations.de.booksIntro

    // Assert
    expect(intro).toMatch(/gruppier/i)
    expect(intro).toMatch(/umbenenn/i)
    expect(intro).toMatch(/zusammen/i)
  })
})

describe('Versionshinweise', () => {
  it.each(['en', 'es', 'fr'] as const)('lässt in %s kein deutsches Rückblick in den Notizen stehen', (code) => {
    // Arrange
    const notes = Object.entries(translations[code] as Table).filter(([key]) => key.startsWith('release'))

    // Act
    const offenders = notes.filter(([, value]) => /Rückblick/.test(value)).map(([key]) => key)

    // Assert
    expect(offenders).toEqual([])
  })

  it.each(['en', 'es', 'fr'] as const)('nennt in %s die Rückblick-Seite in den Notizen so wie in der Navigation', (code) => {
    // Arrange
    const table = translations[code] as Table

    // Act
    const note = table.release040Thoughts

    // Assert
    expect(note).toContain(table.reflections)
  })

  it.each(languages.map((language) => language.code))('Sprache %s nennt in den Hinweisen keine entfernten Likes', (code) => {
    // Arrange
    const notes = Object.entries(translations[code] as Table).filter(([key]) => key.startsWith('release'))

    // Act
    const offenders = notes.filter(([, value]) => /like|gusta|j[’']aime/i.test(value)).map(([key]) => key)

    // Assert
    expect(offenders).toEqual([])
  })
})
