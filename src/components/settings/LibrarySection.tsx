import { useI18n } from '../../i18n/useI18n'
import { Panel } from './Panel'

export function LibrarySection({ entryCount }: { entryCount: number }) {
  const { t } = useI18n()

  return (
    <Panel title={t('library')}>
      <p className="text-sm text-graphite">{t('storedLocally', { count: entryCount })}</p>
    </Panel>
  )
}
