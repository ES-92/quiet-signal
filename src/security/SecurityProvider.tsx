import { FormEvent, useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { hasPinLock, isEncryptionEnabled, isEncryptionUnlocked, unlockEncryption, verifyPin } from '../services/security'

export function SecurityProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [pinUnlocked, setPinUnlocked] = useState(() => !hasPinLock())
  const [encryptionUnlocked, setEncryptionUnlocked] = useState(() => isEncryptionUnlocked())
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    function refresh() {
      setPinUnlocked((current) => (hasPinLock() ? current : true))
      setEncryptionUnlocked(isEncryptionUnlocked())
      setPin('')
      setPassword('')
      setError('')
    }

    window.addEventListener('commonplace-security-changed', refresh)
    window.addEventListener('commonplace-lock-now', lock)
    return () => {
      window.removeEventListener('commonplace-security-changed', refresh)
      window.removeEventListener('commonplace-lock-now', lock)
    }

    function lock() {
      if (hasPinLock()) setPinUnlocked(false)
    }
  }, [])

  async function handlePinSubmit(event: FormEvent) {
    event.preventDefault()
    if (await verifyPin(pin)) {
      setPinUnlocked(true)
      setError('')
      setPin('')
    } else {
      setError(t('wrongPin'))
    }
  }

  async function handleEncryptionSubmit(event: FormEvent) {
    event.preventDefault()
    if (await unlockEncryption(password)) {
      setEncryptionUnlocked(true)
      setError('')
      setPassword('')
    } else {
      setError(t('wrongPassword'))
    }
  }

  if (!pinUnlocked) {
    return (
      <UnlockScreen title={t('appLocked')} error={error} onSubmit={handlePinSubmit}>
        <input
          autoFocus
          inputMode="numeric"
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          className="rounded-md border border-line bg-paper px-3 py-3 text-center text-xl tracking-[0.3em]"
          placeholder="••••"
        />
        <button className="rounded-md bg-ink px-5 py-3 text-sm text-paper">{t('unlock')}</button>
      </UnlockScreen>
    )
  }

  if (isEncryptionEnabled() && !encryptionUnlocked) {
    return (
      <UnlockScreen title={t('vaultLocked')} error={error} onSubmit={handleEncryptionSubmit}>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-md border border-line bg-paper px-3 py-3"
          placeholder={t('encryptionPassword')}
        />
        <button className="rounded-md bg-ink px-5 py-3 text-sm text-paper">{t('unlock')}</button>
      </UnlockScreen>
    )
  }

  return <>{children}</>
}

function UnlockScreen({
  title,
  error,
  children,
  onSubmit
}: {
  title: string
  error: string
  children: ReactNode
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 text-ink">
      <form className="classical-panel grid w-full max-w-sm gap-4 rounded-md p-6 text-center" onSubmit={onSubmit}>
        <h1 className="font-serif text-4xl">Commonplace</h1>
        <p className="text-sm uppercase tracking-[0.22em] text-graphite">{title}</p>
        {children}
        {error && <p className="text-sm text-clay">{error}</p>}
      </form>
    </main>
  )
}
