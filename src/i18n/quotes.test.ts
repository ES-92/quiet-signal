import { describe, expect, it } from 'vitest'
import { quoted } from './quotes'

describe('quoted', () => {
  it.each([
    ['de', '„Text“'],
    ['en', '“Text”'],
    ['es', '«Text»'],
    ['fr', '« Text »']
  ] as const)('setzt Zitate mit Autor in %s in typografische Anführungszeichen', (language, expected) => {
    // Arrange / Act
    const result = quoted('Text', 'Seneca', language)

    // Assert
    expect(result).toBe(expected)
  })

  it('zeigt eigene Notizen ohne Autor ohne Anführungszeichen', () => {
    // Arrange / Act / Assert
    expect(quoted('Text', undefined, 'de')).toBe('Text')
    expect(quoted('Text', '  ', 'de')).toBe('Text')
  })
})
