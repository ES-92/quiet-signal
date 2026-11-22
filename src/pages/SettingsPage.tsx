import { useEffect, useState } from 'react'

import { ConfirmSheet } from '../components/ConfirmSheet'
import { AppearanceSection } from '../components/settings/AppearanceSection'
import { BackupSection } from '../components/settings/BackupSection'
import { DailyReviewSection } from '../components/settings/DailyReviewSection'
import { DangerZoneSection } from '../components/settings/DangerZoneSection'
import { LanguageSection } from '../components/settings/LanguageSection'
import { LibrarySection } from '../components/settings/LibrarySection'
import { OnboardingSection } from '../components/settings/OnboardingSection'
import { ReminderSection } from '../components/settings/ReminderSection'
import { SecuritySection, securityPanelId } from '../components/settings/SecuritySection'
import { SettingsNotices } from '../components/settings/SettingsNotices'
import { ShortcutsSection } from '../components/settings/ShortcutsSection'
import { SupportSection } from '../components/settings/SupportSection'
import { useBackupStatus } from '../hooks/useBackupStatus'
import { useClearAllData } from '../hooks/useClearAllData'
import { useSecurityStatus } from '../hooks/useSecurityStatus'
import { useI18n } from '../i18n/useI18n'
import { APP_VERSION } from '../services/release'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'

const protectionDismissedKey = 'quiet-signal-protection-notice-dismissed'

function readProtectionDismissed() {
  try {
    return localStorage.getItem(protectionDismissedKey) === 'true'
  } catch {
    return false
  }
}

export function SettingsPage() {
  const { t } = useI18n()
  const { quotes, loadQuotes } = useQuoteStore()
  const { books, loadBooks } = useBookStore()
  const { pinEnabled, encryptionEnabled } = useSecurityStatus()
  const backup = useBackupStatus(quotes, books)
  const clearAll = useClearAllData()

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadBooks, loadQuotes])

  const [securityOpen, setSecurityOpen] = useState(false)
  const [protectionDismissed, setProtectionDismissed] = useState(readProtectionDismissed)

  function dismissProtectionNotice() {
    try {
      localStorage.setItem(protectionDismissedKey, 'true')
    } catch {
      // Storage unavailable: the notice is hidden for this visit only.
    }
    setProtectionDismissed(true)
  }

  function openSecurity() {
    setSecurityOpen(true)
    const summary = document.getElementById(securityPanelId)?.querySelector('summary')
    summary?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    summary?.focus()
  }

  return (
    <div className="grid gap-6 pt-3 sm:gap-8 sm:pt-10">
      <section className="min-w-0">
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{t('settings')}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-graphite">{t('settingsIntro')}</p>
      </section>

      <SettingsNotices
        backupState={backup.state}
        backupAge={backup.lastBackupAt ? backup.age : undefined}
        protectionOff={!pinEnabled && !encryptionEnabled && quotes.length + books.length > 0 && !protectionDismissed}
        onBackup={backup.createBackup}
        onOpenSecurity={openSecurity}
        onDismissProtection={dismissProtectionNotice}
      />

      <section className="grid gap-0 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        <LanguageSection />
        <AppearanceSection />
        <LibrarySection entryCount={quotes.length} />
        <OnboardingSection />
        <BackupSection
          state={backup.state}
          lastBackupAt={backup.lastBackupAt}
          age={backup.age}
          message={backup.message}
          onBackup={backup.createBackup}
        />
        <DailyReviewSection />
        <ReminderSection />
        <ShortcutsSection />
        <SecuritySection open={securityOpen} onOpenChange={setSecurityOpen} />
        <SupportSection />
        <DangerZoneSection onDeleteAll={clearAll.request} />
      </section>
      <p className="text-center text-xs text-graphite">{t('versionLine', { version: APP_VERSION })}</p>
      <ConfirmSheet
        open={clearAll.confirmOpen}
        title={t('deleteAllLocalData')}
        description={t('deleteConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onClose={clearAll.cancel}
        onConfirm={clearAll.confirm}
      />
    </div>
  )
}
