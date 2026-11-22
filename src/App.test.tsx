import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { db } from './db/database'
import { I18nProvider } from './i18n/I18nProvider'
import { translations } from './i18n/translations'
import { onboardingKey } from './services/onboarding'

const en = translations.en

function renderApp(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </MemoryRouter>
  )
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.setItem(onboardingKey, 'true')
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

describe('App routes', () => {
  it('leitet /add auf Heute um und öffnet das Capture-Sheet im Textmodus', async () => {
    // Arrange / Act
    renderApp('/add')

    // Assert
    expect(await screen.findByRole('button', { name: en.text })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.queryByText(en.addQuote)).not.toBeInTheDocument())
  })
})
