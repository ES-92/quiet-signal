import { describe, expect, it } from 'vitest'
import { toLocalDateTime } from './draftFields'

describe('toLocalDateTime', () => {
  it('zeigt ein gültiges Datum in Ortszeit (Europe/Berlin)', () =>
    expect(toLocalDateTime('2026-11-21T14:30:00.000Z')).toBe('2026-11-21T15:30'))
  it.each(['', 'foo', '+275760-09-13T00:00:00Z', '-271821-04-20T00:00:00Z', '+100000-01-01T00:00:00Z'])(
    'wirft nie und liefert für %j einen leeren Wert',
    (value) => {
      expect(() => toLocalDateTime(value)).not.toThrow()
      expect(toLocalDateTime(value)).toBe('')
    }
  )
})
