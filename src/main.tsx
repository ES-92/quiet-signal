import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { I18nProvider } from './i18n/I18nProvider'
import { SecurityProvider } from './security/SecurityProvider'
import { startAppUpdate } from './services/appUpdate'
import './index.css'

startAppUpdate()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fullScreen>
      <I18nProvider>
        <ErrorBoundary fullScreen>
          <SecurityProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </SecurityProvider>
        </ErrorBoundary>
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
