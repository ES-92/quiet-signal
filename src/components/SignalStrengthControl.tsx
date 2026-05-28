import { Radio } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import { tapHaptic } from '../services/haptics'
import type { SignalStrength } from '../types/quote'

const strengths: SignalStrength[] = ['quiet', 'normal', 'strong']
const labels = {
  quiet: 'signalStrength_quiet',
  normal: 'signalStrength_normal',
  strong: 'signalStrength_strong'
} as const

export function SignalStrengthControl({
  value,
  onChange,
  className = ''
}: {
  value: SignalStrength
  onChange: (value: SignalStrength) => void
  className?: string
}) {
  const { t } = useI18n()

  return (
    <div className={['grid gap-2', className].filter(Boolean).join(' ')}>
      <span className="text-sm text-graphite">{t('signalStrength')}</span>
      <div className="inline-grid grid-cols-3 rounded-md border border-line bg-paper p-0.5">
        {strengths.map((strength) => (
          <button
            key={strength}
            type="button"
            className={[
              'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded px-2 text-xs transition sm:text-sm',
              value === strength ? 'bg-ink text-paper shadow-[0_6px_14px_rgba(31,30,28,0.16)]' : 'text-graphite hover:text-ink'
            ].join(' ')}
            onClick={() => {
              tapHaptic(value === strength ? 5 : 10)
              onChange(strength)
            }}
          >
            <Radio size={14} />
            {t(labels[strength])}
          </button>
        ))}
      </div>
    </div>
  )
}
