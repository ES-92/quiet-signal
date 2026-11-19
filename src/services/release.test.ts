import { beforeEach, describe, expect, it } from 'vitest'
import {
  APP_VERSION,
  ensureVersionInitialized,
  lastSeenVersion,
  markVersionSeen,
  notesSince,
  releaseNotes,
  shouldShowWhatsNew
} from './release'

const versionKey = 'quiet-signal-last-seen-version'

beforeEach(() => {
  localStorage.clear()
})

describe('notesSince', () => {
  it('liefert ohne gesehene Version keine Hinweise', () => {
    // Arrange / Act
    const notes = notesSince(null)

    // Assert
    expect(notes).toEqual([])
  })

  it('enthält 0.2.0 für eine ältere gesehene Version', () => {
    // Arrange / Act
    const notes = notesSince('0.1.0')

    // Assert
    expect(notes.map((note) => note.version)).toContain('0.2.0')
  })

  it('enthält nichts für die aktuelle Version', () => {
    // Arrange / Act
    const notes = notesSince(APP_VERSION)

    // Assert
    expect(notes).toEqual([])
  })

  it('vergleicht Versionen numerisch statt als Text', () => {
    // Arrange
    const seen = '0.10.0'

    // Act
    const notes = notesSince(seen)

    // Assert
    expect(notes.map((note) => note.version)).not.toContain('0.2.0')
  })

  it('liefert nur Hinweise, die in releaseNotes definiert sind', () => {
    // Arrange / Act
    const notes = notesSince('0.0.1')

    // Assert
    expect(notes).toEqual(releaseNotes)
  })
})

describe('ensureVersionInitialized / lastSeenVersion', () => {
  it('speichert beim ersten Start die aktuelle Version', () => {
    // Arrange / Act
    ensureVersionInitialized()

    // Assert
    expect(lastSeenVersion()).toBe(APP_VERSION)
  })

  it('überschreibt eine vorhandene Version nicht', () => {
    // Arrange
    localStorage.setItem(versionKey, '0.1.0')

    // Act
    ensureVersionInitialized()

    // Assert
    expect(lastSeenVersion()).toBe('0.1.0')
  })
})

describe('shouldShowWhatsNew', () => {
  it('ist false ohne gespeicherte Version', () => {
    // Arrange / Act / Assert
    expect(shouldShowWhatsNew()).toBe(false)
  })

  it('ist true bei älterer gespeicherter Version', () => {
    // Arrange
    localStorage.setItem(versionKey, '0.1.0')

    // Act / Assert
    expect(shouldShowWhatsNew()).toBe(true)
  })

  it('ist false bei aktueller Version und nach markVersionSeen', () => {
    // Arrange
    localStorage.setItem(versionKey, '0.1.0')

    // Act
    markVersionSeen()

    // Assert
    expect(lastSeenVersion()).toBe(APP_VERSION)
    expect(shouldShowWhatsNew()).toBe(false)
  })

  it('ist false bei neuerer gespeicherter Version', () => {
    // Arrange
    localStorage.setItem(versionKey, '99.0.0')

    // Act / Assert
    expect(shouldShowWhatsNew()).toBe(false)
  })
})
