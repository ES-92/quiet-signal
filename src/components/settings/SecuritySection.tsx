import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useEncryptionSettings } from '../../hooks/useEncryptionSettings'
import { usePinLock } from '../../hooks/usePinLock'
import { useSecurityStatus } from '../../hooks/useSecurityStatus'
import { lockAppNow, lockEncryption } from '../../services/security'
import { Panel } from './Panel'

export const securityPanelId = 'settings-security'

interface SecuritySectionProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SecuritySection({ open, onOpenChange }: SecuritySectionProps) {
  const { t } = useI18n()
  const { pinEnabled, encryptionEnabled, encryptionUnlocked } = useSecurityStatus()
  const [message, setMessage] = useState('')
  const pinLock = usePinLock(setMessage)
  const encryption = useEncryptionSettings(setMessage)

  return (
    <Panel id={securityPanelId} title={t('security')} open={open} onOpenChange={onOpenChange}>
      <p className="text-sm leading-6 text-graphite">{t('securityHelp')}</p>
      <div className="mt-4 grid gap-2">
        <input
          className="rounded-md border border-line bg-paper px-3 py-2"
          inputMode="numeric"
          type="password"
          placeholder={t('pinPlaceholder')}
          value={pinLock.pin}
          onChange={(event) => pinLock.setPin(event.target.value)}
        />
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button className="rounded-md bg-ink px-3 py-2 text-sm text-paper" onClick={() => void pinLock.savePin()}>
            {pinEnabled ? t('changePin') : t('enablePin')}
          </button>
          {pinEnabled && (
            <>
              <button className="rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={() => lockAppNow()}>
                {t('lockNow')}
              </button>
              <button className="rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={pinLock.removePin}>
                {t('disablePin')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-2 border-t border-line pt-4">
        <input
          className="rounded-md border border-line bg-paper px-3 py-2"
          type="password"
          placeholder={t('encryptionPassword')}
          value={encryption.password}
          onChange={(event) => encryption.setPassword(event.target.value)}
        />
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          {!encryptionEnabled ? (
            <button disabled={encryption.busy} className="rounded-md bg-ink px-3 py-2 text-sm text-paper disabled:opacity-50" onClick={() => void encryption.enable()}>
              {t('enableEncryption')}
            </button>
          ) : (
            <>
              <button className="rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={() => lockEncryption()}>
                {t(encryptionUnlocked ? 'lockVault' : 'vaultLocked')}
              </button>
              <button disabled={encryption.busy} className="rounded-md border border-clay px-3 py-2 text-sm text-clay disabled:opacity-50" onClick={() => void encryption.disable()}>
                {t('disableEncryption')}
              </button>
            </>
          )}
        </div>
      </div>
      {message && <p className="mt-3 text-sm text-moss">{message}</p>}
    </Panel>
  )
}
