import { useI18n } from '../i18n/I18nProvider'
import type { TranslationKey } from '../i18n/translations'
import { bookWeights, type BookWeight } from '../types/book'

const labelKey: Record<BookWeight, TranslationKey> = {
  rare: 'weightRare',
  normal: 'weightNormal',
  often: 'weightOften'
}

interface WeightControlProps {
  value: BookWeight
  onChange: (weight: BookWeight) => void
  className?: string
}

export function WeightControl({ value, onChange, className }: WeightControlProps) {
  const { t } = useI18n()

  return (
    <div className={['inline-flex rounded-md border border-line bg-paper p-0.5', className].filter(Boolean).join(' ')}>
      {bookWeights.map((weight) => (
        <button
          key={weight}
          type="button"
          aria-pressed={value === weight}
          onClick={() => onChange(weight)}
          className={[
            'rounded px-3 py-1.5 text-xs transition',
            value === weight ? 'bg-ink text-paper shadow-[0_6px_14px_rgba(31,30,28,0.16)]' : 'text-graphite hover:text-ink'
          ].join(' ')}
        >
          {t(labelKey[weight])}
        </button>
      ))}
    </div>
  )
}
