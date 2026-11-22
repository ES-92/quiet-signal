import { useI18n } from '../../i18n/useI18n'
import { useSettingsStore } from '../../store/useSettingsStore'
import { Panel } from './Panel'

export function DailyReviewSection() {
  const { t } = useI18n()
  const { dailyCount, setDailyCount } = useSettingsStore()

  return (
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
    </Panel>
  )
}
