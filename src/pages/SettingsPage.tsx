import { useEffect } from 'react'

import { ConfirmSheet } from '../components/ConfirmSheet'
import { AppearanceSection } from '../components/settings/AppearanceSection'
import { BackupSection } from '../components/settings/BackupSection'
import { DailyReviewSection } from '../components/settings/DailyReviewSection'
import { DangerZoneSection } from '../components/settings/DangerZoneSection'
import { LanguageSection } from '../components/settings/LanguageSection'
import { LibrarySection } from '../components/settings/LibrarySection'
import { LocalStatusRibbon } from '../components/settings/LocalStatusRibbon'
import { OnboardingSection } from '../components/settings/OnboardingSection'
import { PrivacyTrustSection } from '../components/settings/PrivacyTrustSection'
import { ReleaseReadinessSection } from '../components/settings/ReleaseReadinessSection'
import { ReminderSection } from '../components/settings/ReminderSection'
import { SampleDataSection } from '../components/settings/SampleDataSection'
import { SecuritySection } from '../components/settings/SecuritySection'
import { ShortcutsSection } from '../components/settings/ShortcutsSection'
import { SupportSection } from '../components/settings/SupportSection'
import { useBackupStatus } from '../hooks/useBackupStatus'
import { useClearAllData } from '../hooks/useClearAllData'
import { useSecurityStatus } from '../hooks/useSecurityStatus'
import { useI18n } from '../i18n/useI18n'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { quoteStatus } from '../types/quote'

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

  const noiseCount = quotes.filter((quote) => quoteStatus(quote) === 'inbox').length
  const signalCount = quotes.filter((quote) => quoteStatus(quote) === 'signal').length
  const restCount = quotes.filter((quote) => quoteStatus(quote) === 'rest').length
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
        restCount={restCount}
        noiseCount={noiseCount}
        bookCount={books.length}
        backupStateValue={backup.state}
        protectionStatus={protectionStatus}
      />

      <section className="grid gap-0 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        <LanguageSection />
        <AppearanceSection />
        <LibrarySection entryCount={quotes.length} />
        <PrivacyTrustSection />
        <OnboardingSection />
        <BackupSection
          state={backup.state}
          lastBackupAt={backup.lastBackupAt}
          age={backup.age}
          message={backup.message}
          onBackup={backup.createBackup}
        />
        <ReleaseReadinessSection />
        <DailyReviewSection />
        <ReminderSection />
        <ShortcutsSection />
        <SecuritySection />
        <SampleDataSection />
        <SupportSection />
        <DangerZoneSection onDeleteAll={clearAll.request} />
      </section>
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
