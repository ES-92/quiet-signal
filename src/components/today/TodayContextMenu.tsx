import { BookOpen, ExternalLink, Heart, Trash2, X } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

interface TodayContextMenuProps {
  favorite: boolean
  hasBook: boolean
  onClose: () => void
  onFavorite: () => void
  onOpenDetails: () => void
  onEditBook: () => void
  onDiscard: () => void
}

// Popup with the secondary card actions, opened by long-pressing the top card or via the action bar.
export function TodayContextMenu({
  favorite,
  hasBook,
  onClose,
  onFavorite,
  onOpenDetails,
  onEditBook,
  onDiscard
}: TodayContextMenuProps) {
  const { t } = useI18n()

  return (
    <div
      className="quiet-pop absolute inset-x-6 bottom-7 z-30 rounded-md border border-line bg-paper/95 p-2 shadow-[0_22px_70px_rgba(31,30,28,0.18)] backdrop-blur sm:inset-x-auto sm:bottom-10 sm:right-8 sm:w-72"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3 px-2 py-1">
        <p className="text-xs uppercase tracking-[0.16em] text-graphite">{t('contextActions')}</p>
        <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-graphite hover:bg-white/50" onClick={onClose} aria-label={t('close')}>
          <X size={16} />
        </button>
      </div>
      <div className="mt-1 grid gap-1">
        <button className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-left text-sm text-ink hover:bg-white/50" onClick={onFavorite}>
          <Heart size={17} fill={favorite ? 'currentColor' : 'none'} className={favorite ? 'text-clay' : 'text-graphite'} />
          {t('favorite')}
        </button>
        <button className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-left text-sm text-ink hover:bg-white/50" onClick={onOpenDetails}>
          <ExternalLink size={17} className="text-graphite" />
          {t('openDetails')}
        </button>
        {hasBook && (
          <button className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-left text-sm text-ink hover:bg-white/50" onClick={onEditBook}>
            <BookOpen size={17} className="text-graphite" />
            {t('editBookInline')}
          </button>
        )}
        <button className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-left text-sm text-graphite hover:bg-white/50" onClick={onDiscard}>
          <Trash2 size={17} className="text-graphite" />
          {t('deleteEntry')}
        </button>
      </div>
    </div>
  )
}
