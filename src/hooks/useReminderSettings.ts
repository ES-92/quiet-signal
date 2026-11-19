import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import {
  disableReminder,
  enableReminder,
  isNotificationSupported,
  notificationPermission,
  refreshReminderConfig,
  requestNotificationPermission,
  sendTestReminder
} from '../services/reminder'
import { useSettingsStore } from '../store/useSettingsStore'

export function useReminderSettings() {
  const { language, t } = useI18n()
  const { reminderEnabled, reminderTime, setReminderEnabled, setReminderTime } = useSettingsStore()
  const [message, setMessage] = useState('')

  // Keep the cached reminder text in sync when the UI language changes.
  useEffect(() => {
    if (reminderEnabled) {
      void refreshReminderConfig({ time: reminderTime, title: t('reminderTitle'), body: t('reminderBody') })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  async function toggle(checked: boolean) {
    if (!isNotificationSupported()) {
      setMessage(t('reminderUnsupported'))
      return
    }
    if (checked) {
      const result = await enableReminder({ time: reminderTime, title: t('reminderTitle'), body: t('reminderBody') })
      if (!result.ok) {
        setMessage(t('reminderDenied'))
        return
      }
      setReminderEnabled(true)
      setMessage(result.background ? t('reminderActive') : `${t('reminderActive')} ${t('reminderBackgroundNote')}`)
    } else {
      await disableReminder()
      setReminderEnabled(false)
      setMessage('')
    }
  }

  async function changeTime(time: string) {
    setReminderTime(time)
    if (reminderEnabled) {
      await refreshReminderConfig({ time, title: t('reminderTitle'), body: t('reminderBody') })
    }
  }

  async function sendTest() {
    if (!isNotificationSupported()) {
      setMessage(t('reminderUnsupported'))
      return
    }
    const permission = notificationPermission() === 'granted' ? 'granted' : await requestNotificationPermission()
    if (permission !== 'granted') {
      setMessage(t('reminderDenied'))
      return
    }
    await sendTestReminder(t('reminderTitle'), t('reminderBody'))
    setMessage(t('reminderTestSent'))
  }

  return { reminderEnabled, reminderTime, message, toggle, changeTime, sendTest }
}
