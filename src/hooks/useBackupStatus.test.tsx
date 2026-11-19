import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { getLastBackupAt } from '../services/backup'
import { makeQuote } from '../test/factories'
import { useBackupStatus } from './useBackupStatus'

const download = vi.hoisted(() => vi.fn())
vi.mock('../services/importExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/importExport')>()),
  downloadText: download
}))

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

describe('useBackupStatus', () => {
  it('meldet "leer" ohne Einträge', () => {
    // Arrange / Act
    const { result } = renderHook(() => useBackupStatus([], []), { wrapper })

    // Assert
    expect(result.current.state).toBe('empty')
    expect(result.current.lastBackupAt).toBeUndefined()
  })

  it('wird nach dem Backup frisch und hält Zeitpunkt und Meldung fest', () => {
    // Arrange
    const { result } = renderHook(() => useBackupStatus([makeQuote()], []), { wrapper })
    expect(result.current.state).toBe('stale')

    // Act
    act(() => result.current.createBackup())

    // Assert
    expect(download).toHaveBeenCalledTimes(1)
    expect(result.current.state).toBe('fresh')
    expect(result.current.lastBackupAt).toBe(getLastBackupAt())
    expect(result.current.age).toBe(0)
    expect(result.current.message).toMatch(/^Backup created:/)
  })
})
