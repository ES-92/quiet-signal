import { Check, ChevronDown, Coffee, Copy, CreditCard, DatabaseBackup, ExternalLink, FileText, HeartHandshake, Moon, RotateCcw, ShieldCheck, Sparkles, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ConfirmSheet } from '../components/ConfirmSheet'
import { decryptAllQuotesAndDisable, encryptAllQuotes } from '../db/database'
import { useI18n } from '../i18n/I18nProvider'
import { languages, type LanguageCode } from '../i18n/translations'
import { backupAgeDays, backupState, downloadBackup, getLastBackupAt } from '../services/backup'
import { openOnboarding } from '../services/onboarding'
import {
  disableReminder,
  enableReminder,
  isNotificationSupported,
  notificationPermission,
  refreshReminderConfig,
  requestNotificationPermission,
  sendTestReminder
} from '../services/reminder'
import { sampleSeed } from '../services/sampleData'
import { copyShortcutUrl, shortcutUrl } from '../services/shortcuts'
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
import { useSettingsStore, type AppTheme, type DailyMode } from '../store/useSettingsStore'
import { quoteStatus } from '../types/quote'

export function SettingsPage() {
  const { language, setLanguage, t } = useI18n()
  const { quotes, loadQuotes, importQuotes, clearAll: clearQuotes } = useQuoteStore()
  const { books, loadBooks, importBooks, clearAll: clearBooks } = useBookStore()
  const { dailyCount, dailyMode, theme, reminderEnabled, reminderTime, setDailyCount, setDailyMode, setTheme, setReminderEnabled, setReminderTime } =
    useSettingsStore()
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [securityMessage, setSecurityMessage] = useState('')
  const [securityBusy, setSecurityBusy] = useState(false)
  const [securityVersion, setSecurityVersion] = useState(0)
  const [reminderMessage, setReminderMessage] = useState('')
  const [backupVersion, setBackupVersion] = useState(0)
  const [backupMessage, setBackupMessage] = useState('')
  const [shortcutMessage, setShortcutMessage] = useState('')
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadBooks, loadQuotes])

  // Keep the cached reminder text in sync when the UI language changes.
  useEffect(() => {
    if (reminderEnabled) {
      void refreshReminderConfig({ time: reminderTime, title: t('reminderTitle'), body: t('reminderBody') })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  useEffect(() => {
    function refresh() {
      setSecurityVersion((value) => value + 1)
    }
    window.addEventListener('quiet-signal-security-changed', refresh)
    return () => window.removeEventListener('quiet-signal-security-changed', refresh)
  }, [])

  async function handleClearAll() {
    setClearConfirmOpen(true)
  }

  async function confirmClearAll() {
    await Promise.all([clearQuotes(), clearBooks()])
    setClearConfirmOpen(false)
  }

  async function handleLoadSamples() {
    const seed = sampleSeed()
    await importBooks(seed.books)
    await importQuotes(seed.quotes)
  }

  function handleBackup() {
    const timestamp = downloadBackup(quotes, books)
    setBackupVersion((value) => value + 1)
    setBackupMessage(t('backupCreated', { date: formatDateTime(timestamp) }))
  }

  async function handleCopyShortcut(mode: 'text' | 'photo' | 'audio') {
    try {
      await copyShortcutUrl(mode)
      setShortcutMessage(t('shortcutCopied'))
    } catch {
      setShortcutMessage(shortcutUrl(mode))
    }
  }

  async function handleToggleReminder(checked: boolean) {
    if (!isNotificationSupported()) {
      setReminderMessage(t('reminderUnsupported'))
      return
    }
    if (checked) {
      const result = await enableReminder({ time: reminderTime, title: t('reminderTitle'), body: t('reminderBody') })
      if (!result.ok) {
        setReminderMessage(t('reminderDenied'))
        return
      }
      setReminderEnabled(true)
      setReminderMessage(result.background ? t('reminderActive') : `${t('reminderActive')} ${t('reminderBackgroundNote')}`)
    } else {
      await disableReminder()
      setReminderEnabled(false)
      setReminderMessage('')
    }
  }

  async function handleReminderTime(time: string) {
    setReminderTime(time)
    if (reminderEnabled) {
      await refreshReminderConfig({ time, title: t('reminderTitle'), body: t('reminderBody') })
    }
  }

  async function handleTestReminder() {
    if (!isNotificationSupported()) {
      setReminderMessage(t('reminderUnsupported'))
      return
    }
    const permission = notificationPermission() === 'granted' ? 'granted' : await requestNotificationPermission()
    if (permission !== 'granted') {
      setReminderMessage(t('reminderDenied'))
      return
    }
    await sendTestReminder(t('reminderTitle'), t('reminderBody'))
    setReminderMessage(t('reminderTestSent'))
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
      await loadBooks()
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
      await loadBooks()
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
  void backupVersion
  const lastBackupAt = getLastBackupAt()
  const backupAge = backupAgeDays(lastBackupAt)
  const currentBackupState = backupState(quotes.length + books.length, lastBackupAt)
  const noiseCount = quotes.filter((quote) => quoteStatus(quote) === 'inbox').length
  const signalCount = quotes.length - noiseCount
  const protectionStatus =
    pinEnabled && encryptionEnabled
      ? t('dataProtectionStrong')
      : pinEnabled
        ? t('dataProtectionPinOnly')
        : encryptionEnabled
          ? t('dataProtectionVaultOnly')
          : t('dataProtectionOpen')

  return (
    <div className="grid gap-6 pt-3 sm:gap-8 sm:pt-10">
      <section className="min-w-0">
        <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('localApp')}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{t('settings')}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-graphite">{t('settingsIntro')}</p>
      </section>

      <LocalStatusRibbon
        signalCount={signalCount}
        noiseCount={noiseCount}
        bookCount={books.length}
        backupStateValue={currentBackupState}
        protectionStatus={protectionStatus}
      />

      <section className="grid gap-0 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        <Panel title={t('language')} defaultOpen>
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
        <Panel title={t('appearance')} defaultOpen>
          <p className="text-sm leading-6 text-graphite">{t('appearanceHelp')}</p>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </Panel>
        <Panel title={t('library')}>
          <p className="text-sm text-graphite">{t('storedLocally', { count: quotes.length })}</p>
        </Panel>
        <Panel title={t('privacyTrust')} defaultOpen>
          <p className="text-sm leading-6 text-graphite">{t('privacyTrustBody')}</p>
          <div className="mt-4 grid gap-2">
            <TrustPoint icon={<ShieldCheck size={16} />} title={t('privacyLocalTitle')} body={t('privacyLocalBody')} />
            <TrustPoint icon={<FileText size={16} />} title={t('privacyNoTrackingTitle')} body={t('privacyNoTrackingBody')} />
            <TrustPoint icon={<DatabaseBackup size={16} />} title={t('privacyPortableTitle')} body={t('privacyPortableBody')} />
          </div>
        </Panel>
        <Panel title={t('onboardingSettings')}>
          <p className="text-sm leading-6 text-graphite">{t('onboardingSettingsHelp')}</p>
          <button className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={openOnboarding}>
            <RotateCcw size={16} /> {t('restartOnboarding')}
          </button>
        </Panel>
        <Panel title={t('backupSafety')} defaultOpen>
          <div className="flex items-start gap-3">
            <span className={['mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border', currentBackupState === 'fresh' ? 'border-moss text-moss' : currentBackupState === 'empty' ? 'border-line text-graphite' : 'border-clay text-clay'].join(' ')}>
              {currentBackupState === 'fresh' ? <Check size={17} /> : <DatabaseBackup size={17} />}
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-6 text-graphite">
                {currentBackupState === 'empty'
                  ? t('backupEmpty')
                  : lastBackupAt
                    ? t('backupStatus', { age: backupAge ?? 0 })
                    : t('backupMissing')}
              </p>
              <button className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md bg-ink px-3 py-2 text-sm text-paper" onClick={handleBackup}>
                <DatabaseBackup size={16} /> {t('backupNow')}
              </button>
              {backupMessage && <p className="mt-3 text-sm leading-6 text-moss">{backupMessage}</p>}
            </div>
          </div>
        </Panel>
        <Panel title={t('releaseReadiness')}>
          <p className="text-sm leading-6 text-graphite">{t('releaseReadinessBody')}</p>
          <div className="mt-4 grid gap-2">
            <ReleaseFact label={t('releaseVersionLabel')} value={t('releaseVersionValue')} />
            <ReleaseFact label={t('releaseStorageLabel')} value={t('releaseStorageValue')} />
            <ReleaseFact label={t('releaseBackupLabel')} value={t('releaseBackupValue')} />
          </div>
          <p className="mt-4 rounded-md border border-line bg-paper/70 px-3 py-2 text-sm leading-6 text-graphite">
            {t('releaseManualCheck')}
          </p>
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
        <Panel title={t('reminders')}>
          <p className="text-sm leading-6 text-graphite">{t('remindersHelp')}</p>
          <label className="mt-4 flex items-center gap-3 text-sm text-graphite">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(event) => void handleToggleReminder(event.target.checked)}
            />
            {t('enableReminder')}
          </label>
          <label className="mt-4 grid gap-2 text-sm text-graphite">
            <span>{t('reminderTimeLabel')}</span>
            <input
              type="time"
              value={reminderTime}
              onChange={(event) => void handleReminderTime(event.target.value)}
              disabled={!reminderEnabled}
              className="w-fit rounded-md border border-line bg-paper px-3 py-2 disabled:opacity-50"
            />
          </label>
          <button
            className="mt-4 rounded-md border border-line px-3 py-2 text-sm text-graphite"
            onClick={() => void handleTestReminder()}
          >
            {t('testReminder')}
          </button>
          {reminderMessage && <p className="mt-3 text-sm leading-6 text-moss">{reminderMessage}</p>}
        </Panel>
        <Panel title={t('shortcuts')}>
          <p className="text-sm leading-6 text-graphite">{t('shortcutsHelp')}</p>
          <div className="mt-4 grid gap-2">
            <ShortcutButton label={t('shortcutText')} onClick={() => void handleCopyShortcut('text')} />
            <ShortcutButton label={t('shortcutPhoto')} onClick={() => void handleCopyShortcut('photo')} />
            <ShortcutButton label={t('shortcutAudio')} onClick={() => void handleCopyShortcut('audio')} />
          </div>
          {shortcutMessage && <p className="mt-3 break-words text-sm leading-6 text-moss">{shortcutMessage}</p>}
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
        <Panel title={t('supportProject')}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-paper text-clay">
              <HeartHandshake size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-6 text-graphite">{t('supportProjectBody')}</p>
              <div className="mt-4 grid gap-2">
                <SupportLink href="https://ko-fi.com/esc92" label={t('supportProjectAction')} provider="Ko-fi" variant="primary" />
                <SupportLink href="https://paypal.me/ErikSchroeder92" label={t('supportProjectAction')} provider="PayPal" variant="secondary" />
              </div>
            </div>
          </div>
        </Panel>
        <Panel title={t('dangerZone')}>
          <button className="mt-4 rounded-md border border-clay px-4 py-2 text-sm text-clay" onClick={() => void handleClearAll()}>
            {t('deleteAllLocalData')}
          </button>
        </Panel>
      </section>
      <ConfirmSheet
        open={clearConfirmOpen}
        title={t('deleteAllLocalData')}
        description={t('deleteConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={confirmClearAll}
      />
    </div>
  )
}

function LocalStatusRibbon({
  signalCount,
  noiseCount,
  bookCount,
  backupStateValue,
  protectionStatus
}: {
  signalCount: number
  noiseCount: number
  bookCount: number
  backupStateValue: ReturnType<typeof backupState>
  protectionStatus: string
}) {
  const { t } = useI18n()
  const backupText = {
    empty: t('dataBackupEmpty'),
    fresh: t('dataBackupFresh'),
    due: t('dataBackupDue'),
    stale: t('dataBackupStale')
  }[backupStateValue]

  return (
    <section className="classical-panel overflow-hidden rounded-md">
      <div className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[1.2fr_2fr] md:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-graphite">{t('dataHealth')}</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-graphite">{t('dataHealthBody')}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatusMetric icon={<Sparkles size={16} />} label={t('dataSignalsLabel')} value={t('dataSignalsValue', { signals: signalCount, noise: noiseCount })} />
          <StatusMetric icon={<FileText size={16} />} label={t('dataBooksLabel')} value={t('dataBooksValue', { count: bookCount })} />
          <StatusMetric icon={<DatabaseBackup size={16} />} label={t('dataBackupLabel')} value={backupText} tone={backupStateValue === 'fresh' || backupStateValue === 'empty' ? 'calm' : 'warn'} />
          <StatusMetric icon={<ShieldCheck size={16} />} label={t('dataProtectionLabel')} value={protectionStatus} />
        </div>
      </div>
    </section>
  )
}

function StatusMetric({
  icon,
  label,
  value,
  tone = 'calm'
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'calm' | 'warn'
}) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-paper/60 p-3">
      <div className="flex items-center gap-2 text-[0.66rem] uppercase tracking-[0.15em] text-graphite">
        <span className={tone === 'warn' ? 'text-clay' : 'text-moss'}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 truncate text-sm text-ink">{value}</p>
    </div>
  )
}

function TrustPoint({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-line bg-paper/60 p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-clay">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-1 text-sm leading-6 text-graphite">{body}</p>
      </div>
    </div>
  )
}

function ReleaseFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-2 text-sm">
      <span className="text-graphite">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  )
}

function Panel({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      className="group min-w-0 border-t border-line py-5 md:rounded-md md:border md:bg-white/30 md:p-5 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <h2 className="font-serif text-2xl leading-tight sm:text-[1.7rem]">{title}</h2>
        <ChevronDown className="shrink-0 text-graphite transition duration-200 group-open:rotate-180" size={18} />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

function ThemeToggle({ theme, onChange }: { theme: AppTheme; onChange: (theme: AppTheme) => void }) {
  const { t } = useI18n()
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      className="mt-4 flex min-h-[50px] w-full items-center justify-between rounded-md border border-line bg-paper/80 p-1 text-sm text-ink transition hover:border-ink/45"
      aria-pressed={dark}
      onClick={() => onChange(dark ? 'light' : 'dark')}
    >
      <span
        className={[
          'flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded px-3 transition',
          !dark ? 'bg-ink text-paper shadow-[0_8px_18px_rgba(31,30,28,0.14)]' : 'text-graphite'
        ].join(' ')}
      >
        <Sun size={16} />
        {t('lightMode')}
      </span>
      <span
        className={[
          'flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded px-3 transition',
          dark ? 'bg-ink text-paper shadow-[0_8px_18px_rgba(31,30,28,0.14)]' : 'text-graphite'
        ].join(' ')}
      >
        <Moon size={16} />
        {t('darkMode')}
      </span>
    </button>
  )
}

function ShortcutButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-[44px] items-center justify-between gap-3 rounded-md border border-line bg-paper/70 px-3 py-2 text-left text-sm text-graphite transition hover:border-ink/45 hover:text-ink"
      onClick={onClick}
    >
      <span className="truncate">{label}</span>
      <Copy size={15} />
    </button>
  )
}

function SupportLink({
  href,
  label,
  provider,
  variant
}: {
  href: string
  label: string
  provider: string
  variant: 'primary' | 'secondary'
}) {
  const Icon = variant === 'primary' ? Coffee : CreditCard
  const primary = variant === 'primary'

  if (!primary) {
    return (
      <a
        className="inline-flex min-h-[46px] w-full items-center justify-between gap-3 rounded-md border border-line bg-paper/70 px-3 py-2 text-sm text-graphite transition duration-200 hover:border-ink/50 hover:bg-white/45 hover:text-ink"
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={`${label} via ${provider}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CreditCard className="shrink-0 text-clay" size={15} />
          <span className="truncate">{label}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded border border-current px-2 py-1 text-[11px] uppercase tracking-[0.14em]">
          {provider}
          <ExternalLink size={13} />
        </span>
      </a>
    )
  }

  return (
    <a
      className="group inline-flex min-h-[58px] w-full items-center gap-3 rounded-md border border-ink bg-ink px-3.5 py-3 text-left text-sm text-paper shadow-[0_16px_34px_rgba(31,30,28,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#171615] hover:shadow-[0_20px_42px_rgba(31,30,28,0.2)]"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} via ${provider}`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-paper/20 bg-paper/10 text-paper"
      >
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        <span className="mt-0.5 block text-[11px] uppercase tracking-[0.16em] text-paper/60">{provider}</span>
      </span>
      <ExternalLink className="text-paper/60 transition group-hover:text-paper" size={15} />
    </a>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}
