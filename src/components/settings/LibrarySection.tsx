import { useI18n } from '../../i18n/useI18n'
import { Panel } from './Panel'

export function LibrarySection({ entryCount }: { entryCount: number }) {
  const { t, tCount } = useI18n()

  return (
    <Panel title={t('library')}>
      <p className="text-sm text-graphite">{tCount('storedLocally', entryCount)}</p>
    </Panel>
  )
}
