import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { I18nProvider } from './i18n/I18nProvider'
import { SecurityProvider } from './security/SecurityProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <SecurityProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SecurityProvider>
    </I18nProvider>
  </React.StrictMode>
)
