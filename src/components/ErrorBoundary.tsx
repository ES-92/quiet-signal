import { Component, useContext, type ErrorInfo, type ReactNode } from 'react'
import { I18nContext } from '../i18n/useI18n'
import { defaultLanguage, translations, type LanguageCode } from '../i18n/translations'
import { reloadOnceForChunkError } from '../services/chunkReload'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Fills the whole screen (root boundary) instead of the page area. */
  fullScreen?: boolean
}

interface ErrorBoundaryState {
  error: unknown
}

// Catches render errors so one broken row or a missing chunk never leaves a white screen. Entries live in
// IndexedDB, so the calm fallback only needs to offer a reload.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error ?? new Error('Unknown error') }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (reloadOnceForChunkError(error)) return
    console.error('Quiet Signal: render error', error, info.componentStack)
  }

  render() {
    if (this.state.error) return <ErrorFallback fullScreen={this.props.fullScreen} />
    return this.props.children
  }
}

function ErrorFallback({ fullScreen }: { fullScreen?: boolean }) {
  // The root boundary may sit outside I18nProvider (or the provider itself failed), so fall back to the stored language.
  const context = useContext(I18nContext)
  const t = context?.t ?? ((key: keyof typeof translations.en) => translations[fallbackLanguage()][key])

  return (
    <div
      className={[
        'flex w-full items-center justify-center px-4 text-ink',
        fullScreen ? 'min-h-[100dvh] bg-paper' : 'min-h-[40dvh]'
      ].join(' ')}
    >
      <section role="alert" className="classical-panel max-w-md rounded-md px-6 py-10 text-center">
        <h2 className="font-serif text-2xl">{t('errorBoundaryTitle')}</h2>
        <p className="mt-3 text-sm leading-6 text-graphite">{t('errorBoundaryBody')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="quiet-touch mt-5 rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper"
        >
          {t('errorBoundaryAction')}
        </button>
      </section>
    </div>
  )
}

function fallbackLanguage(): LanguageCode {
  const candidates = [safeStoredLanguage(), navigator.language?.slice(0, 2).toLowerCase()]
  return (candidates.find((code) => code && code in translations) as LanguageCode | undefined) ?? defaultLanguage
}

function safeStoredLanguage() {
  try {
    return localStorage.getItem('quiet-signal-language')
  } catch {
    return null
  }
}
