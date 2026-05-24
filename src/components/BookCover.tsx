import { bookCover } from '../services/bookCover'

interface BookCoverProps {
  title: string
  author?: string
  /** Show only a monogram — for tight spots like list rows. */
  compact?: boolean
  className?: string
}

export function BookCover({ title, author, compact = false, className }: BookCoverProps) {
  const cover = bookCover(title, author)

  return (
    <div
      className={[
        'relative flex aspect-[3/4] flex-col overflow-hidden rounded-[3px]',
        'shadow-[0_14px_30px_rgba(31,30,28,0.22)]',
        compact ? 'items-center justify-center p-2' : 'justify-between p-3 sm:p-4',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ background: `linear-gradient(140deg, ${cover.base}, ${cover.edge})`, color: cover.text }}
      aria-hidden={compact || undefined}
    >
      {/* Spine + binding shadow on the left edge */}
      <span
        className="absolute inset-y-0 left-0 w-[6px]"
        style={{ background: cover.edge, boxShadow: 'inset -3px 0 7px rgba(0,0,0,0.4)' }}
      />
      {/* Cloth sheen */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(105deg, rgba(255,255,255,0.16), transparent 42%)' }}
      />
      {/* Oversized monogram watermark for depth */}
      <span
        className="pointer-events-none absolute font-serif leading-none"
        style={{
          bottom: `${-12 + cover.bandOffset * 6}%`,
          right: '-4%',
          fontSize: compact ? '3.4rem' : '7.5rem',
          color: cover.text,
          opacity: 0.08
        }}
      >
        {cover.initials}
      </span>

      {compact ? (
        <span className="relative font-serif text-base leading-none">{cover.initials}</span>
      ) : (
        <>
          <div className="relative">
            <div className="mb-2 h-px w-8" style={{ background: cover.text, opacity: 0.45 }} />
            <p className="line-clamp-4 font-serif text-sm leading-tight sm:text-base">{title}</p>
          </div>
          {author && (
            <p className="relative line-clamp-2 text-[0.6rem] uppercase tracking-[0.14em] opacity-80">{author}</p>
          )}
        </>
      )}
    </div>
  )
}
