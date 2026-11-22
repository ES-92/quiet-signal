import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useClarifyDraft } from '../hooks/useClarifyDraft'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { db, getBook, getQuote, updateQuote, upsertBooks, upsertQuotes } from './database'

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
})

describe('deprecated stored fields', () => {
  const stored = { signalStrength: 'strong', entryType: 'idea', locationName: 'Eilenriede' } as const

  it('stay unchanged after an updateQuote updater patch', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'd-1', ...stored })])
    await upsertBooks([makeBook({ id: 'b-1', weight: 'often' })])

    // Act
    await updateQuote('d-1', (current) => ({ likes: current.likes + 1 }))

    // Assert
    expect(await getQuote('d-1')).toMatchObject({ likes: 1, ...stored })
    expect((await getBook('b-1'))?.weight).toBe('often')
  })

  it('stay unchanged after the clarify save patch', async () => {
    // Arrange
    const row = makeQuote({ id: 'd-2', status: 'inbox', ...stored })
    await upsertQuotes([row])
    const { result } = renderHook(() => useClarifyDraft(row, []))

    // Act
    await updateQuote('d-2', result.current.buildPatch('signal'))

    // Assert
    expect(await getQuote('d-2')).toMatchObject({ status: 'signal', ...stored })
  })
})
