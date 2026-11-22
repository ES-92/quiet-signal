import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../i18n/translations'
import { renderWithProviders } from '../test/render'
import { AudioRecorder } from './AudioRecorder'

const en = translations.en

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  state: 'inactive' | 'recording' = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  start = vi.fn(() => {
    this.state = 'recording'
  })
  stop = vi.fn(() => {
    this.state = 'inactive'
    this.onstop?.()
  })
  constructor(public stream: MediaStream) {
    FakeMediaRecorder.instances.push(this)
  }
}

function fakeStream() {
  const track = { stop: vi.fn() }
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream }
}

let getUserMedia: ReturnType<typeof vi.fn>

beforeEach(() => {
  FakeMediaRecorder.instances = []
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  getUserMedia = vi.fn()
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AudioRecorder', () => {
  it('stoppt Aufnahme und Mikrofon, wenn die Komponente während der Aufnahme verschwindet', async () => {
    // Arrange
    const { track, stream } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    const onChange = vi.fn()
    const { unmount } = renderWithProviders(<AudioRecorder onChange={onChange} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.startRecording) }))
    })
    const recorder = FakeMediaRecorder.instances[0]
    expect(recorder.state).toBe('recording')

    // Act
    unmount()

    // Assert
    expect(recorder.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('gibt ein Mikrofon frei, das erst nach dem Schließen bereitsteht', async () => {
    // Arrange
    const { track, stream } = fakeStream()
    let resolve: (value: MediaStream) => void = () => undefined
    getUserMedia.mockReturnValue(new Promise<MediaStream>((done) => (resolve = done)))
    const { unmount } = renderWithProviders(<AudioRecorder onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.startRecording) }))

    // Act
    unmount()
    await act(async () => resolve(stream))

    // Assert
    expect(track.stop).toHaveBeenCalled()
    expect(FakeMediaRecorder.instances).toHaveLength(0)
  })

  it('stoppt beim normalen Beenden alle Spuren', async () => {
    // Arrange
    const { track, stream } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    renderWithProviders(<AudioRecorder onChange={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.startRecording) }))
    })

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.stopRecording) }))
    })

    // Assert
    expect(track.stop).toHaveBeenCalled()
  })

  it('fordert bei doppeltem Tippen nur ein Mikrofon an', async () => {
    // Arrange
    const { track, stream } = fakeStream()
    let resolve: (value: MediaStream) => void = () => undefined
    getUserMedia.mockReturnValue(new Promise<MediaStream>((done) => (resolve = done)))
    renderWithProviders(<AudioRecorder onChange={vi.fn()} />)
    const start = screen.getByRole('button', { name: new RegExp(en.startRecording) })

    // Act
    fireEvent.click(start)
    fireEvent.click(start)
    await act(async () => resolve(stream))

    // Assert
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(FakeMediaRecorder.instances).toHaveLength(1)
    expect(track.stop).not.toHaveBeenCalled()
  })
})
