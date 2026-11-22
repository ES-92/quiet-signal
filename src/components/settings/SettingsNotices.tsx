import { DatabaseBackup, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/useI18n'
import type { BackupState } from '../../services/backup'

interface SettingsNoticesProps {
  backupState: BackupState
  // Days since the last backup; undefined when there is none yet.
  backupAge?: number
  protectionOff: boolean
  onBackup: () => void
  onOpenSecurity: () => void
  onDismissProtection: () => void
}

// Quiet warnings that only exist while something needs attention: no or an overdue backup, and no PIN/vault.
export function SettingsNotices({ backupState, backupAge, protectionOff, onBackup, onOpenSecurity, onDismissProtection }: SettingsNoticesProps) {
  const { t, tCount } = useI18n()
  const backupDue = backupState === 'stale'
  if (!backupDue && !protectionOff) return null

  return (
    <section className="grid gap-2">
      {backupDue && (
        <Notice
          icon={<DatabaseBackup size={16} />}
          text={backupAge === undefined ? t('noticeNoBackup') : tCount('noticeBackupOverdue', backupAge)}
          actionLabel={t('backupNow')}
          onAction={onBackup}
        />
      )}
      {protectionOff && (
        <Notice
          icon={<ShieldAlert size={16} />}
          text={t('noticeProtectionOff')}
          actionLabel={t('openSecurity')}
          onAction={onOpenSecurity}
          secondaryLabel={t('noticeDismiss')}
          onSecondary={onDismissProtection}
        />
      )}
    </section>
  )
}

interface NoticeProps {
  icon: ReactNode
  text: string
  actionLabel: string
  onAction: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

function Notice({ icon, text, actionLabel, onAction, secondaryLabel, onSecondary }: NoticeProps) {
  return (
    <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-clay/50 bg-paper/60 px-4 py-3">
      <p className="flex min-w-0 items-center gap-2 text-sm text-ink">
        <span className="shrink-0 text-clay">{icon}</span>
        {text}
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="min-h-[44px] rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={onAction}>
          {actionLabel}
        </button>
        {secondaryLabel && (
          <button className="min-h-[44px] rounded-md px-3 py-2 text-sm text-graphite underline-offset-2 hover:underline" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
