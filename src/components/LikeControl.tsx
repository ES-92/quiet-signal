import { Flame, Minus } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'

interface LikeControlProps {
  likes: number
  onLike: () => void
  onDislike: () => void
  /** Icon-only like zone (used in the tight Today action row). */
  compact?: boolean
  className?: string
}

// Segmented control: the main zone likes (+1), the trailing minus takes a like
// back (-1) and only appears once there is at least one like to remove.
export function LikeControl({ likes, onLike, onDislike, compact = false, className }: LikeControlProps) {
  const { t } = useI18n()
  const active = likes > 0

  return (
    <div
      className={[
        'inline-flex min-h-[44px] items-stretch overflow-hidden rounded-md border',
        active ? 'border-clay text-clay' : 'border-line text-graphite',
        className
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        onClick={onLike}
        aria-label={t('like')}
        className={['inline-flex flex-1 items-center justify-center gap-2 text-sm', compact ? 'px-2' : 'px-3'].join(' ')}
      >
        <Flame size={16} fill={active ? 'currentColor' : 'none'} />
        {active ? (
          <span key={likes} className="like-pop tabular-nums">
            {likes}
          </span>
        ) : (
          <span className={compact ? 'sr-only' : ''}>{t('like')}</span>
        )}
      </button>
      {active && (
        <button
          type="button"
          onClick={onDislike}
          aria-label={t('dislike')}
          className="inline-flex items-center justify-center border-l border-clay/30 px-2.5"
        >
          <Minus size={16} />
        </button>
      )}
    </div>
  )
}
