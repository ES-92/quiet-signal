import { DatabaseBackup, FileText, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/useI18n'
import type { BackupState } from '../../services/backup'

export function LocalStatusRibbon({
  signalCount,
  restCount,
  noiseCount,
  bookCount,
  backupStateValue,
  protectionStatus
}: {
  signalCount: number
  restCount: number
  noiseCount: number
  bookCount: number
  backupStateValue: BackupState
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
          <StatusMetric icon={<Sparkles size={16} />} label={t('dataSignalsLabel')} value={t('dataSignalsValue', { signals: signalCount, rest: restCount, noise: noiseCount })} />
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
  icon: ReactNode
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
