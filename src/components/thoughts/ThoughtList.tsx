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
            <input
              className="rounded-md border border-line bg-paper px-2 py-1 text-ink"
              defaultValue={thought.text}
              aria-label={thought.text}
              onBlur={(event) => {
                const value = event.target.value.trim()
                if (value && value !== thought.text) onEdit(thought.id, value)
              }}
            />
          ) : (
            <span className="whitespace-pre-wrap break-words text-ink">{thought.text}</span>
          )}
          {onRemove && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-graphite hover:bg-white/50"
              aria-label={t('deleteNoise')}
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
