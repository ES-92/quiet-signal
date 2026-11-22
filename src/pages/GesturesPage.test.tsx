import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { translations } from '../i18n/translations'
import { renderWithProviders } from '../test/render'
import { GesturesPage } from './GesturesPage'

const en = translations.en

function section(name: string) {
  return screen.getByRole('heading', { name }).closest('section') as HTMLElement
}

describe('GesturesPage', () => {
  it('listet für Heute die Belegung Öfter, Seltener, Gedanke und Ruhen lassen', () => {
    // Arrange / Act
    renderWithProviders(<GesturesPage />)

    // Assert
    const today = within(section(en.gesturesTodaySection))
    expect(today.getByText(en.gestureMoreOften).previousElementSibling).toHaveTextContent('→')
    expect(today.getByText(en.gestureLessOften).previousElementSibling).toHaveTextContent('←')
    expect(today.getByText(en.gestureThought).previousElementSibling).toHaveTextContent('↑')
    expect(today.getByText(en.gestureRest).previousElementSibling).toHaveTextContent('↓')
  })

  it('erwähnt für Heute kein Später und keinen Snooze', () => {
    // Arrange / Act
    renderWithProviders(<GesturesPage />)

    // Assert
    const today = within(section(en.gesturesTodaySection))
    expect(today.queryByText(en.later)).not.toBeInTheDocument()
    expect(section(en.gesturesTodaySection).textContent).not.toMatch(/snooze/i)
  })

  it('beschreibt die Klären-Gesten mit ↓ als Stille, nicht als Verwerfen', () => {
    // Arrange / Act
    renderWithProviders(<GesturesPage />)

    // Assert
    const clarify = within(section(en.gesturesClarifySection))
    expect(clarify.getByText(en.finishSignal)).toBeInTheDocument()
    expect(clarify.getByText(en.later)).toBeInTheDocument()
    expect(clarify.getByText(en.details)).toBeInTheDocument()
    expect(clarify.getByText(en.clarifyRest).previousElementSibling).toHaveTextContent('↓')
    expect(section(en.gesturesClarifySection).textContent).not.toMatch(/discard|trash/i)
  })

  it('nennt das Long-Press-Menü unter den weiteren Gesten', () => {
    // Arrange / Act
    renderWithProviders(<GesturesPage />)

    // Assert
    expect(screen.getByText(en.gestureLongPress)).toBeInTheDocument()
  })
})
