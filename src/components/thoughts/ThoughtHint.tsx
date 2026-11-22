import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import type { Thought } from '../../types/quote'
import { formatRelativeDay } from '../../utils/date'
import { ThoughtList } from './ThoughtList'

interface ThoughtHintProps {
  thoughts: Thought[]
  now?: Date
}

// One quiet line on a card: the newest thought with its age; tapping expands all thoughts.
export function ThoughtHint({ thoughts, now }: ThoughtHintProps) {
  const { language } = useI18n()
  const [open, setOpen] = useState(false)
  const [reference] = useState(() => now ?? new Date())
  if (thoughts.length === 0) return null

  const reading = now ?? reference
  const sorted = [...thoughts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const newest = sorted[0]
  const extra = sorted.length - 1

  return (
    <div className="grid gap-2 text-xs text-graphite" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
      <button type="button" className="flex w-full min-w-0 items-baseline gap-2 text-left" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="min-w-0 flex-1 truncate">{`${formatRelativeDay(newest.createdAt, reading, language)}: ${newest.text.replace(/\s+/g, ' ')}`}</span>
        {extra > 0 && <span className="shrink-0">{`+${extra}`}</span>}
      </button>
      {open && (
        <div className="max-h-32 overflow-y-auto">
          <ThoughtList thoughts={sorted} now={reading} />
        </div>
      )}
    </div>
  )
}
