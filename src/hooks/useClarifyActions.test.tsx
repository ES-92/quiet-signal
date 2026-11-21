import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getQuote, upsertQuotes } from '../db/database'
import { I18nProvider } from '../i18n/I18nProvider'
import { translations } from '../i18n/translations'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { makeQuote, resetFactories } from '../test/factories'
import type { Quote } from '../types/quote'
import { useClarifyActions } from './useClarifyActions'

const en = translations.en
const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>
const buildPatch = (status: Quote['status']) => ({ status, text: 'Patch' }) as Partial<Quote>

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [], loading: true })
  useToastStore.setState({ toast: null })
})

describe('useClarifyActions', () => {
  it('tut ohne obersten Eintrag nichts', async () => {
    // Arrange
    const onMessage = vi.fn()
    const { result } = renderHook(() => useClarifyActions(undefined, buildPatch, onMessage), { wrapper })

    // Act
    await act(async () => {
      await result.current.finishSignal()
      await result.current.saveDetails()
      await result.current.snoozeCurrent()
      await result.current.discardCurrent()
    })

    // Assert
    expect(onMessage).not.toHaveBeenCalled()
    expect(useToastStore.getState().toast).toBeNull()
  })

  it('speichert als Signal beziehungsweise im Eingang und meldet jeweils', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', status: 'inbox' })
    await upsertQuotes([quote])
    const onMessage = vi.fn()
    const { result } = renderHook(() => useClarifyActions(quote, buildPatch, onMessage), { wrapper })

    // Act
    await act(async () => result.current.saveDetails())
    const afterKeep = await getQuote('q')
    await act(async () => result.current.finishSignal())

    // Assert
    expect(afterKeep).toMatchObject({ status: 'inbox', text: 'Patch' })
    expect((await getQuote('q'))?.status).toBe('signal')
    expect(onMessage.mock.calls).toEqual([[en.keptInNoise], [en.movedToSignals]])
  })

  it('stellt zurück und zeigt einen Hinweis', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', status: 'inbox' })
    await upsertQuotes([quote])
    const { result } = renderHook(() => useClarifyActions(quote, buildPatch, vi.fn()), { wrapper })

    // Act
    await act(async () => result.current.snoozeCurrent())

    // Assert
    expect((await getQuote('q'))?.snoozedUntil).toBeTruthy()
    expect(useToastStore.getState().toast?.message).toBe(en.snoozedToast)
  })

  it('verwirft und bietet Rückgängig an, das den Eintrag wiederherstellt', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', status: 'inbox' })
    await upsertQuotes([quote])
    const { result } = renderHook(() => useClarifyActions(quote, buildPatch, vi.fn()), { wrapper })

    // Act
    await act(async () => result.current.discardCurrent())
    const toast = useToastStore.getState().toast
    const discarded = (await getQuote('q'))?.deletedAt
    await act(async () => toast?.onAction?.())

    // Assert
    expect(discarded).toBeTruthy()
    expect(toast).toMatchObject({ message: en.discardedToast, actionLabel: en.undo })
    expect((await getQuote('q'))?.deletedAt).toBeUndefined()
    // Undo reloads the store without being awaited; let that finish before the next test resets the database.
    await waitFor(() => expect(useQuoteStore.getState().quotes.some((item) => item.id === 'q')).toBe(true))
  })

  it('hängt den ersten Gedanken einmal an und leert ihn nach jedem Speichern', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', status: 'inbox' })
    await upsertQuotes([quote])
    const onSaved = vi.fn()
    const { result } = renderHook(() => useClarifyActions(quote, buildPatch, vi.fn(), { text: ' Erster ', onSaved }), {
      wrapper
    })

    // Act
    await act(async () => result.current.saveDetails())
    const afterFirst = (await getQuote('q'))?.thoughts

    // Assert
    expect(afterFirst?.map((thought) => thought.text)).toEqual(['Erster'])
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('speichert ohne ersten Gedanken keinen Gedanken und ruft onSaved nicht', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', status: 'inbox' })
    await upsertQuotes([quote])
    const onSaved = vi.fn()
    const { result } = renderHook(() => useClarifyActions(quote, buildPatch, vi.fn(), { text: '  ', onSaved }), {
      wrapper
    })

    // Act
    await act(async () => result.current.finishSignal())

    // Assert
    expect((await getQuote('q'))?.thoughts).toBeUndefined()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
