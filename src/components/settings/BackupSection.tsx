import { Check, DatabaseBackup } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import type { BackupState } from '../../services/backup'
import { Panel } from './Panel'

interface BackupSectionProps {
  state: BackupState
  lastBackupAt?: string
  age?: number
  message: string
  onBackup: () => void
}

export function BackupSection({ state, lastBackupAt, age, message, onBackup }: BackupSectionProps) {
  const { t, tCount } = useI18n()

  return (
    <Panel title={t('backupSafety')} defaultOpen>
      <div className="flex items-start gap-3">
        <span className={['mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border', state === 'fresh' ? 'border-moss text-moss' : state === 'empty' ? 'border-line text-graphite' : 'border-clay text-clay'].join(' ')}>
          {state === 'fresh' ? <Check size={17} /> : <DatabaseBackup size={17} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm leading-6 text-graphite">
            {state === 'empty'
              ? t('backupEmpty')
              : lastBackupAt
                ? (age ?? 0) === 0
                  ? t('backupToday')
                  : tCount('backupStatus', age ?? 0)
                : t('backupMissing')}
          </p>
          <button className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md bg-ink px-3 py-2 text-sm text-paper" onClick={onBackup}>
            <DatabaseBackup size={16} /> {t('backupNow')}
          </button>
          {message && <p className="mt-3 text-sm leading-6 text-moss">{message}</p>}
        </div>
      </div>
    </Panel>
  )
}
