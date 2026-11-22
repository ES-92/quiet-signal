import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useLoadSamples } from '../hooks/useLoadSamples'

// Secondary action of the empty states: fills an empty library with the built-in examples.
export function TrySamplesButton() {
  const { t } = useI18n()
  const loadSamples = useLoadSamples()
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (busy) return
    setBusy(true)
    try {
      await loadSamples()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      className="quiet-touch min-h-[44px] rounded-md border disabled:opacity-50 border-line bg-paper/70 px-4 py-2 text-sm text-graphite transition hover:border-ink/40 hover:text-ink"
      onClick={() => void handleClick()}
    >
      {t('trySamples')}
    </button>
  )
}
