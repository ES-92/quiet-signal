import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from './I18nProvider'
import { useI18n } from './useI18n'
import { translations } from './translations'

function Probe() {
  const { language, setLanguage, t } = useI18n()
  return (
    <div>
      <p data-testid="language">{language}</p>
      <p data-testid="text">{t('today')}</p>
      <p data-testid="interpolated">{t('onboardingStep', { current: 2, total: 4 })}</p>
      <button onClick={() => setLanguage('de')}>de</button>
    </div>
  )
}

describe('I18nProvider', () => {
  it('nutzt die gespeicherte Sprache, wenn vorhanden', () => {
    // Arrange
    localStorage.setItem('quiet-signal-language', 'fr')

    // Act
    render(<I18nProvider><Probe /></I18nProvider>)

    // Assert
    expect(screen.getByTestId('language')).toHaveTextContent('fr')
    expect(screen.getByTestId('text')).toHaveTextContent(translations.fr.today)
  })

  it('fällt auf die Browsersprache zurück und schreibt Sprache und lang-Attribut', () => {
    // Arrange (jsdom: navigator.language = en-US)

    // Act
    render(<I18nProvider><Probe /></I18nProvider>)

    // Assert
    expect(screen.getByTestId('language')).toHaveTextContent('en')
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('quiet-signal-language')).toBe('en')
  })

  it('wechselt die Sprache und persistiert sie', () => {
    // Arrange
    render(<I18nProvider><Probe /></I18nProvider>)

    // Act
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'de' }))
    })

    // Assert
    expect(screen.getByTestId('text')).toHaveTextContent(translations.de.today)
    expect(document.documentElement.lang).toBe('de')
    expect(localStorage.getItem('quiet-signal-language')).toBe('de')
  })

  it('ersetzt Platzhalter in Übersetzungen', () => {
    // Arrange / Act
    render(<I18nProvider><Probe /></I18nProvider>)

    // Assert
    expect(screen.getByTestId('interpolated')).toHaveTextContent(
      translations.en.onboardingStep.replace('{current}', '2').replace('{total}', '4')
    )
  })

  it('wirft, wenn useI18n außerhalb des Providers genutzt wird', () => {
    // Arrange
    const spy = () => render(<Probe />)

    // Act / Assert
    expect(spy).toThrow('useI18n must be used inside I18nProvider')
  })
})

describe('tCount', () => {
  function CountProbe({ count }: { count: number }) {
    const { tCount } = useI18n()
    return <p data-testid="count">{tCount('countOfQuotes', count, { shown: count, total: count })}</p>
  }

  it('nutzt die Einzahl bei 1 und die Mehrzahl sonst', () => {
    // Arrange
    localStorage.setItem('quiet-signal-language', 'de')

    // Act
    const { rerender } = render(<I18nProvider><CountProbe count={1} /></I18nProvider>)

    // Assert
    expect(screen.getByTestId('count')).toHaveTextContent('1 von 1 Eintrag')
    rerender(<I18nProvider><CountProbe count={2} /></I18nProvider>)
    expect(screen.getByTestId('count')).toHaveTextContent('2 von 2 Einträgen')
  })
})
