import { useI18n } from '../../i18n/useI18n'
import { Panel } from './Panel'

export function ReleaseReadinessSection() {
  const { t } = useI18n()

  return (
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
