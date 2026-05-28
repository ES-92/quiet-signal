import { BookOpen, Lightbulb, MapPinned, MessageCircle, NotebookText, Sparkles } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import type { EntryType } from '../types/quote'

const types: Array<{ value: EntryType; label: EntryTypeLabel; icon: typeof NotebookText }> = [
  { value: 'note', label: 'entryType_note', icon: NotebookText },
  { value: 'memory', label: 'entryType_memory', icon: Sparkles },
  { value: 'book_quote', label: 'entryType_book_quote', icon: BookOpen },
  { value: 'idea', label: 'entryType_idea', icon: Lightbulb },
  { value: 'conversation', label: 'entryType_conversation', icon: MessageCircle },
  { value: 'observation', label: 'entryType_observation', icon: MapPinned }
]

type EntryTypeLabel =
  | 'entryType_note'
  | 'entryType_memory'
  | 'entryType_book_quote'
  | 'entryType_idea'
  | 'entryType_conversation'
  | 'entryType_observation'

export function EntryTypeControl({ value, onChange }: { value: EntryType; onChange: (value: EntryType) => void }) {
  const { t } = useI18n()

  return (
    <div className="grid gap-2">
      <span className="text-sm text-graphite">{t('classifyPrompt')}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {types.map((type) => {
          const Icon = type.icon
          const active = value === type.value
          return (
            <button
              key={type.value}
              type="button"
              className={[
                'flex min-h-[48px] items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition',
                active ? 'border-ink bg-ink text-paper shadow-[0_10px_20px_rgba(31,30,28,0.14)]' : 'border-line bg-paper/70 text-graphite hover:border-ink/50 hover:text-ink'
              ].join(' ')}
              onClick={() => onChange(type.value)}
            >
              <Icon size={16} />
              {t(type.label)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
