import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { db } from './db/database'
import { I18nProvider } from './i18n/I18nProvider'
import { onboardingKey } from './services/onboarding'

vi.mock('./pages/TodayPage', () => ({ TodayPage: () => <p>today-page</p> }))

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.setItem(onboardingKey, 'true')
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

describe('App routing', () => {
  it('sends an unknown route to Today instead of a blank page', async () => {
    // Arrange / Act
    render(
      <MemoryRouter initialEntries={['/does-not-exist']}>
        <I18nProvider>
          <App />
        </I18nProvider>
      </MemoryRouter>
    )

    // Assert
    expect(await screen.findByText('today-page')).toBeInTheDocument()
  })
})
