import { useI18n } from '../../i18n/useI18n'
import { useReminderSettings } from '../../hooks/useReminderSettings'
import { Panel } from './Panel'

export function ReminderSection() {
  const { t } = useI18n()
  const reminder = useReminderSettings()

  return (
    <Panel title={t('reminders')}>
      <p className="text-sm leading-6 text-graphite">{t('remindersHelp')}</p>
      <label className="mt-4 flex items-center gap-3 text-sm text-graphite">
        <input
          type="checkbox"
          checked={reminder.reminderEnabled}
          onChange={(event) => void reminder.toggle(event.target.checked)}
        />
        {t('enableReminder')}
      </label>
      <label className="mt-4 grid gap-2 text-sm text-graphite">
        <span>{t('reminderTimeLabel')}</span>
        <input
          type="time"
          value={reminder.reminderTime}
          onChange={(event) => void reminder.changeTime(event.target.value)}
          disabled={!reminder.reminderEnabled}
          className="w-fit rounded-md border border-line bg-paper px-3 py-2 disabled:opacity-50"
        />
      </label>
      <button
        className="mt-4 rounded-md border border-line px-3 py-2 text-sm text-graphite"
        onClick={() => void reminder.sendTest()}
      >
        {t('testReminder')}
      </button>
      {reminder.message && <p className="mt-3 text-sm leading-6 text-moss">{reminder.message}</p>}
    </Panel>
  )
}
