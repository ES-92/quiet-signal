import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { clearPinLock, setPinLock } from '../services/security'

export function usePinLock(onMessage: (message: string) => void) {
  const { t } = useI18n()
  const [pin, setPin] = useState('')

  async function savePin() {
    if (pin.length < 4) {
      onMessage(t('pinTooShort'))
      return
    }
    await setPinLock(pin)
    setPin('')
    onMessage(t('pinEnabled'))
  }

  function removePin() {
    clearPinLock()
    onMessage(t('pinDisabled'))
  }

  return { pin, setPin, savePin, removePin }
}
