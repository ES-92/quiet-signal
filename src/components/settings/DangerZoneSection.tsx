import { useI18n } from '../../i18n/useI18n'
import { Panel } from './Panel'

export function DangerZoneSection({ onDeleteAll }: { onDeleteAll: () => void }) {
  const { t } = useI18n()

  return (
    <Panel title={t('dangerZone')}>
      <button className="mt-4 rounded-md border border-clay px-4 py-2 text-sm text-clay" onClick={onDeleteAll}>
        {t('deleteAllLocalData')}
      </button>
    </Panel>
  )
}
