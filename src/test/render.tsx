import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n/I18nProvider'

interface RenderOptions {
  route?: string
}

// Renders a component inside the providers the app shell normally supplies (i18n + router).
// The language comes from localStorage / navigator.language, which resolves to English in jsdom.
// `rerender` keeps the providers, so state in the tree survives a re-render with new props.
export function renderWithProviders(ui: ReactElement, { route = '/' }: RenderOptions = {}) {
  const wrap = (children: ReactElement) => (
    <MemoryRouter initialEntries={[route]}>
      <I18nProvider>{children}</I18nProvider>
    </MemoryRouter>
  )
  const result = render(wrap(ui))
  return { ...result, rerender: (next: ReactElement) => result.rerender(wrap(next)) }
}
