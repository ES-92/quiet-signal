import { X } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

interface TodayBookEditorProps {
  title: string
  author: string
  onTitleChange: (value: string) => void
  onAuthorChange: (value: string) => void
  onClose: () => void
  onSave: () => void
}

// Modal form to rename the book of the top card without leaving the deck.
export function TodayBookEditor({ title, author, onTitleChange, onAuthorChange, onClose, onSave }: TodayBookEditorProps) {
  const { t } = useI18n()

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/15 p-3 backdrop-blur-[2px] sm:items-center sm:justify-center" onClick={onClose}>
      <form
        className="grid w-full gap-3 rounded-md border border-line bg-paper p-4 shadow-[0_24px_80px_rgba(31,30,28,0.2)] sm:max-w-md"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">{t('editBookInline')}</h2>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-graphite hover:bg-white/50" onClick={onClose} aria-label={t('close')}>
            <X size={17} />
          </button>
        </div>
        <label className="grid gap-2 text-sm text-graphite">
          <span>{t('bookTitleLabel')}</span>
          <input className="rounded-md border border-line bg-paper px-3 py-2 text-ink" value={title} onChange={(event) => onTitleChange(event.target.value)} autoFocus />
        </label>
        <label className="grid gap-2 text-sm text-graphite">
          <span>{t('bookAuthorLabel')}</span>
          <input className="rounded-md border border-line bg-paper px-3 py-2 text-ink" value={author} onChange={(event) => onAuthorChange(event.target.value)} />
        </label>
        <div className="grid gap-2 sm:flex sm:justify-end">
          <button type="button" className="rounded-md border border-line px-4 py-2 text-sm text-graphite" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm text-paper">
            {t('saveChanges')}
          </button>
        </div>
      </form>
    </div>
  )
}
