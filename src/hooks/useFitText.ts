import { useCallback, useLayoutEffect, useRef } from 'react'

interface FitOptions {
  maxMobile?: number
  maxDesktop?: number
  minMobile?: number
  minDesktop?: number
}

/**
 * Shrinks a text element's font size until the whole container fits (no
 * scroll/overflow), so long quotes get smaller instead of being clipped.
 * Re-runs on `resetKey` change (e.g. a new quote) and on container resize.
 */
export function useFitText(resetKey: string, options: FitOptions = {}) {
  const { maxMobile = 30, maxDesktop = 48, minMobile = 15, minDesktop = 20 } = options
  const containerRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLElement | null>(null)

  const fit = useCallback(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    const wide = window.matchMedia('(min-width: 640px)').matches
    const max = wide ? maxDesktop : maxMobile
    const min = wide ? minDesktop : minMobile

    let size = max
    text.style.fontSize = `${size}px`
    // Measure the container (image + quote) so the quote also yields room to art.
    let guard = 0
    while (size > min && container.scrollHeight > container.clientHeight && guard < 80) {
      size -= 1
      text.style.fontSize = `${size}px`
      guard += 1
    }
  }, [maxMobile, maxDesktop, minMobile, minDesktop])

  useLayoutEffect(() => {
    fit()
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => fit())
    observer.observe(container)
    return () => observer.disconnect()
  }, [fit, resetKey])

  return { containerRef, textRef }
}
