import { describe, expect, it } from 'vitest'
import { csvEscape, parseCsv } from './csv'

describe('parseCsv', () => {
  it('zerlegt einfache Zeilen und Spalten', () => {
    // Arrange
    const input = 'a,b\n1,2'

    // Act
    const rows = parseCsv(input)

    // Assert
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
  })

  it('behält Komma und Zeilenumbruch in Feldern mit Anführungszeichen', () => {
    const input = '"x, y","z\n2"'

    const rows = parseCsv(input)

    expect(rows).toEqual([['x, y', 'z\n2']])
  })

  it('löst doppelte Anführungszeichen zu einem Anführungszeichen auf', () => {
    const input = '"sagte ""hallo"""'

    const rows = parseCsv(input)

    expect(rows).toEqual([['sagte "hallo"']])
  })
})

describe('csvEscape', () => {
  it('setzt Werte mit Komma in Anführungszeichen', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
  })

  it('lässt Werte ohne Sonderzeichen unverändert', () => {
    expect(csvEscape('ohne')).toBe('ohne')
  })

  it('ergibt beim Roundtrip mit parseCsv wieder die Ausgangswerte', () => {
    // Arrange
    const row = ['a"b', 'c,d', 'e\nf']

    // Act
    const parsed = parseCsv(row.map(csvEscape).join(','))

    // Assert
    expect(parsed[0]).toEqual(row)
  })

  it('ergibt beim Roundtrip mit \\r und \\r\\n in Feldern wieder die Ausgangswerte', () => {
    // Arrange
    const row = ['a\rb', 'a\r\nb']

    // Act
    const escaped = row.map(csvEscape)
    const parsed = parseCsv(escaped.join(','))

    // Assert
    expect(escaped[0]).toBe('"a\rb"')
    expect(parsed).toEqual([row])
  })
})
