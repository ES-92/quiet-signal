import { describe, expect, it } from 'vitest'
import { translations } from './translations'

const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.*', '!/src/i18n/locales/*', '!/src/test/**'], {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

describe('Übersetzungsschlüssel', () => {
  it('enthält keine Schlüssel, die der Code nirgends verwendet', () => {
    // Arrange
    const code = Object.values(sources).join('\n')
    // Keys picked at runtime, e.g. t(`entryStatus_${status}`) or pluralisation via tCount.
    const keys = Object.keys(translations.en).map((key) => key.replace(/_one$/, ''))

    // Act
    const unused = [...new Set(keys)].filter((key) => {
      if (key.startsWith('entryStatus_')) return !code.includes('entryStatus_')
      return !new RegExp(`['"\`]${key}['"\`]`).test(code)
    })

    // Assert
    expect(unused).toEqual([])
  })
})
