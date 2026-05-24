import { useEffect, useState } from 'react'
import { decryptAllQuotesAndDisable, encryptAllQuotes } from '../db/database'
import { useI18n } from '../i18n/I18nProvider'
import { languages, type LanguageCode } from '../i18n/translations'
import { sampleSeed } from '../services/sampleData'
import {
  clearPinLock,
  enableEncryption,
  hasPinLock,
  isEncryptionEnabled,
  isEncryptionUnlocked,
  lockAppNow,
  lockEncryption,
  setPinLock,
  unlockEncryption
} from '../services/security'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useSettingsStore, type DailyMode } from '../store/useSettingsStore'

export function SettingsPage() {
  const { language, setLanguage, t } = useI18n()
  const { quotes, loadQuotes, importQuotes, clearAll } = useQuoteStore()
  const { importBooks } = useBookStore()
  const { dailyCount, dailyMode, setDailyCount, setDailyMode } = useSettingsStore()
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [securityMessage, setSecurityMessage] = useState('')
  const [securityBusy, setSecurityBusy] = useState(false)
  const [securityVersion, setSecurityVersion] = useState(0)

  useEffect(() => {
    void loadQuotes()
  }, [loadQuotes])

  useEffect(() => {
    function refresh() {
      setSecurityVersion((value) => value + 1)
    }
    window.addEventListener('commonplace-security-changed', refresh)
    return () => window.removeEventListener('commonplace-security-changed', refresh)
  }, [])

  async function handleClearAll() {
    if (window.confirm(t('deleteConfirm'))) {
      await clearAll()
    }
  }

  async function handleLoadSamples() {
    const seed = sampleSeed()
    await importBooks(seed.books)
    await importQuotes(seed.quotes)
  }

  async function handleSetPin() {
    if (pin.length < 4) {
      setSecurityMessage(t('pinTooShort'))
      return
    }
    await setPinLock(pin)
    setPin('')
    setSecurityMessage(t('pinEnabled'))
    setSecurityVersion((value) => value + 1)
  }

  function handleClearPin() {
    clearPinLock()
    setSecurityMessage(t('pinDisabled'))
    setSecurityVersion((value) => value + 1)
  }

  async function handleEnableEncryption() {
    if (password.length < 8) {
      setSecurityMessage(t('passwordTooShort'))
      return
    }
    setSecurityBusy(true)
    try {
      await enableEncryption(password)
      await encryptAllQuotes()
      await loadQuotes()
      setPassword('')
      setSecurityMessage(t('encryptionEnabled'))
      setSecurityVersion((value) => value + 1)
    } finally {
      setSecurityBusy(false)
    }
  }

  async function handleDisableEncryption() {
    setSecurityBusy(true)
    try {
      if (!isEncryptionUnlocked()) {
        if (!(await unlockEncryption(password))) {
          setSecurityMessage(t('wrongPassword'))
          return
        }
      }
      await decryptAllQuotesAndDisable()
      await loadQuotes()
      setPassword('')
      setSecurityMessage(t('encryptionDisabled'))
      setSecurityVersion((value) => value + 1)
    } finally {
      setSecurityBusy(false)
    }
  }

  const pinEnabled = hasPinLock()
  const encryptionEnabled = isEncryptionEnabled()
  const encryptionUnlocked = isEncryptionUnlocked()
  void securityVersion

  return (
    <div className="grid gap-6 pt-3 sm:gap-8 sm:pt-10">
      <section className="min-w-0">
        <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('localApp')}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{t('settings')}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-graphite">{t('settingsIntro')}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title={t('language')}>
          <p className="text-sm leading-6 text-graphite">{t('languageHelp')}</p>
          <select
            className="mt-4 w-full rounded-md border border-line bg-paper px-3 py-2"
            value={language}
            onChange={(event) => setLanguage(event.target.value as LanguageCode)}
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </Panel>
        <Panel title={t('library')}>
          <p className="text-sm text-graphite">{t('storedLocally', { count: quotes.length })}</p>
        </Panel>
        <Panel title={t('dailyReview')}>
          <p className="text-sm leading-6 text-graphite">{t('dailyReviewHelp')}</p>
          <label className="mt-4 grid gap-2 text-sm text-graphite">
            <span>{t('highlightsPerDay')}</span>
            <select
              className="rounded-md border border-line bg-paper px-3 py-2"
              value={dailyCount}
              onChange={(event) => setDailyCount(Number(event.target.value))}
            >
              {[3, 5, 10, 15].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 grid gap-2 text-sm text-graphite">
            <span>{t('selectionStyle')}</span>
            <select
              className="rounded-md border border-line bg-paper px-3 py-2"
              value={dailyMode}
              onChange={(event) => setDailyMode(event.target.value as DailyMode)}
            >
              <option value="balanced">{t('balancedSelection')}</option>
              <option value="random">{t('randomSelection')}</option>
            </select>
          </label>
        </Panel>
        <Panel title={t('security')}>
          <p className="text-sm leading-6 text-graphite">{t('securityHelp')}</p>
          <div className="mt-4 grid gap-2">
            <input
              className="rounded-md border border-line bg-paper px-3 py-2"
              inputMode="numeric"
              type="password"
              placeholder={t('pinPlaceholder')}
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button className="rounded-md bg-ink px-3 py-2 text-sm text-paper" onClick={() => void handleSetPin()}>
                {pinEnabled ? t('changePin') : t('enablePin')}
              </button>
              {pinEnabled && (
                <>
                  <button className="rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={() => lockAppNow()}>
                    {t('lockNow')}
                  </button>
                  <button className="rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={handleClearPin}>
                    {t('disablePin')}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-2 border-t border-line pt-4">
            <input
              className="rounded-md border border-line bg-paper px-3 py-2"
              type="password"
              placeholder={t('encryptionPassword')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              {!encryptionEnabled ? (
                <button disabled={securityBusy} className="rounded-md bg-ink px-3 py-2 text-sm text-paper disabled:opacity-50" onClick={() => void handleEnableEncryption()}>
                  {t('enableEncryption')}
                </button>
              ) : (
                <>
                  <button className="rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={() => lockEncryption()}>
                    {t(encryptionUnlocked ? 'lockVault' : 'vaultLocked')}
                  </button>
                  <button disabled={securityBusy} className="rounded-md border border-clay px-3 py-2 text-sm text-clay disabled:opacity-50" onClick={() => void handleDisableEncryption()}>
                    {t('disableEncryption')}
                  </button>
                </>
              )}
            </div>
          </div>
          {securityMessage && <p className="mt-3 text-sm text-moss">{securityMessage}</p>}
        </Panel>
        <Panel title={t('sampleData')}>
          <button className="mt-4 rounded-md bg-ink px-4 py-2 text-sm text-paper" onClick={() => void handleLoadSamples()}>
            {t('loadSamples')}
          </button>
        </Panel>
        <Panel title={t('dangerZone')}>
          <button className="mt-4 rounded-md border border-clay px-4 py-2 text-sm text-clay" onClick={() => void handleClearAll()}>
            {t('deleteAllLocalData')}
          </button>
        </Panel>
      </section>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-white/30 p-4 sm:p-5">
      <h2 className="font-serif text-2xl leading-tight sm:text-3xl">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  )
}
