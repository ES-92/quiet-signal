import { type CSSProperties, type ReactNode } from 'react'

export function GestureStamp({
  className,
  opacity,
  rotate = 0,
  x = 0,
  y = 0,
  children
}: {
  className: string
  opacity: number
  rotate?: number
  x?: number
  y?: number
  children: ReactNode
}) {
  return (
    <div
      className={[
        'pointer-events-none absolute z-10 inline-flex items-center gap-1.5 rounded-full border-2 bg-paper/86 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] shadow-[0_12px_30px_rgba(31,30,28,0.1)] backdrop-blur transition-opacity',
        className
      ].join(' ')}
      style={
        {
          opacity,
          translate: `${x * (1 - opacity)}px ${y * (1 - opacity)}px`,
          rotate: `${rotate * opacity}deg`,
          scale: `${0.94 + opacity * 0.06}`
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}
