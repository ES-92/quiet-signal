import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { translations } from '../i18n/translations'
import { GestureCoach } from './GestureCoach'

const en = translations.en

function renderCoach(deck: 'today' | 'inbox') {
  return render(
    <I18nProvider>
      <GestureCoach deck={deck} onDismiss={vi.fn()} />
    </I18nProvider>
  )
}

describe('GestureCoach', () => {
  it('names the long-press on Today instead of a capture gesture or a desktop shortcut', () => {
    // Arrange / Act
    renderCoach('today')

    // Assert
    expect(screen.getByText(en.coachFooter)).toBeInTheDocument()
    expect(en.coachFooter).not.toMatch(/⌘|↓/)
  })

  it('shows no long-press line on Clarify, where cards have no long-press', () => {
    // Arrange / Act
    renderCoach('inbox')

    // Assert
    expect(screen.queryByText(en.coachFooter)).not.toBeInTheDocument()
  })
})
