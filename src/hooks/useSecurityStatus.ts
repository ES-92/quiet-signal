import { useEffect, useState } from 'react'
import { hasPinLock, isEncryptionEnabled, isEncryptionUnlocked } from '../services/security'

// Reads the PIN/vault state during render and re-renders whenever the security service reports a change.
export function useSecurityStatus() {
  const [, setVersion] = useState(0)

  useEffect(() => {
    function refresh() {
      setVersion((value) => value + 1)
    }
    window.addEventListener('quiet-signal-security-changed', refresh)
    return () => window.removeEventListener('quiet-signal-security-changed', refresh)
  }, [])

  return {
    pinEnabled: hasPinLock(),
    encryptionEnabled: isEncryptionEnabled(),
    encryptionUnlocked: isEncryptionUnlocked()
  }
}
