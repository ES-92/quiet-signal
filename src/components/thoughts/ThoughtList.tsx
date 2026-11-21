import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import type { Thought } from '../../types/quote'
import { formatRelativeDay } from '../../utils/date'

interface ThoughtListProps {
  thoughts: Thought[]
  now?: Date
  onEdit?: (id: string, text: string) => void
  onRemove?: (id: string) => void
}

// Thoughts as passed in (callers sort); read-only unless edit/remove callbacks are given.
export function ThoughtList({ thoughts, now, onEdit, onRemove }: ThoughtListProps) {
  const { t, language } = useI18n()
  const [reference] = useState(() => now ?? new Date())
  const reading = now ?? reference

  return (
    <ul className="grid gap-2 text-sm text-graphite">
      {thoughts.map((thought) => (
        <li key={thought.id} className="grid gap-0.5">
          <span className="text-xs">
            {formatRelativeDay(thought.createdAt, reading, language)}
            {thought.fromNote ? ` · ${t('fromNote')}` : ''}
          </span>
          {onEdit ? (
            <ThoughtInput key={thought.text} thought={thought} label={t('editThought')} onEdit={onEdit} />
          ) : (
            <span className="whitespace-pre-wrap break-words text-ink">{thought.text}</span>
          )}
          {onRemove && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-graphite hover:bg-white/50"
              aria-label={t('removeThought')}
              onClick={() => onRemove(thought.id)}
            >
              <Trash2 size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

// Edits on blur; an empty or unchanged value reverts to the stored text (clearing never deletes).
function ThoughtInput({ thought, label, onEdit }: { thought: Thought; label: string; onEdit: (id: string, text: string) => void }) {
  const [value, setValue] = useState(thought.text)

  return (
    <input
      className="rounded-md border border-line bg-paper px-2 py-1 text-ink"
      value={value}
      aria-label={label}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        const trimmed = value.trim()
        if (trimmed && trimmed !== thought.text) onEdit(thought.id, trimmed)
        else setValue(thought.text)
      }}
    />
  )
}
