import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { FormEvent } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, listQuotes } from '../db/database'
import { I18nProvider } from '../i18n/I18nProvider'
import { translations } from '../i18n/translations'
import { useQuoteStore } from '../store/useQuoteStore'
import { useQuickCapture } from './useQuickCapture'

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>
const submitEvent = { preventDefault: vi.fn() } as unknown as FormEvent

beforeEach(async () => {
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [] })
})

describe('useQuickCapture', () => {
  it('kann erst speichern, wenn Text, Foto oder Sprachnotiz vorliegt', () => {
    // Arrange
    const { result } = renderHook(() => useQuickCapture(vi.fn()), { wrapper })
    expect(result.current.canSave).toBe(false)

    // Act
    act(() => result.current.setText('   '))
    const blank = result.current.canSave
    act(() => result.current.setImage({ dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png' }))

    // Assert
    expect(blank).toBe(false)
    expect(result.current.canSave).toBe(true)
  })

  it('speichert nichts und meldet nichts, solange nichts erfasst ist', async () => {
    // Arrange
    const onSaved = vi.fn()
    const { result } = renderHook(() => useQuickCapture(onSaved), { wrapper })

    // Act
    await act(async () => result.current.submit(submitEvent))

    // Assert
    expect(onSaved).not.toHaveBeenCalled()
    expect(await listQuotes()).toHaveLength(0)
  })

  it('legt den Eintrag mit Medien im Eingang an, meldet und leert alles', async () => {
    // Arrange
    const onSaved = vi.fn()
    const { result } = renderHook(() => useQuickCapture(onSaved), { wrapper })
    act(() => {
      result.current.setText(' Gedanke ')
      result.current.setTags('x, y')
      result.current.setSignalStrength('strong')
      result.current.setAudio({ dataUrl: 'data:audio/webm;base64,AAAA', mimeType: 'audio/webm', durationMs: 1200 })
    })

    // Act
    await act(async () => result.current.submit(submitEvent))

    // Assert
    const [saved] = await listQuotes()
    expect(saved).toMatchObject({
      text: 'Gedanke',
      tags: ['x', 'y'],
      status: 'inbox',
      signalStrength: 'strong',
      audioMimeType: 'audio/webm',
      audioDurationMs: 1200
    })
    expect(onSaved).toHaveBeenCalledWith(translations.en.noiseSaved)
    expect(result.current).toMatchObject({
      text: '',
      tags: '',
      audioDataUrl: undefined,
      signalStrength: 'quiet',
      canSave: false
    })
  })
})
