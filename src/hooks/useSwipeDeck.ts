import { useRef, useState, type PointerEvent } from 'react'
import { tapHaptic } from '../services/haptics'

export type SwipeDirection = 'right' | 'left' | 'up' | 'down'

export interface SwipeDeckActions {
  right?: () => void
  left?: () => void
  up?: () => void
  down?: () => void
  longPress?: () => void
}

export interface SwipeDeckOptions {
  distance?: number
  velocity?: number
  longPressMs?: number
  exitMs?: number
  enabled?: boolean
}

export interface DeckDrag {
  x: number
  y: number
  active: boolean
}

export interface DeckExit {
  direction: SwipeDirection
  x: number
  y: number
  rotate: number
}

interface PointerSnapshot {
  pointerId: number
  x: number
  y: number
  lastX: number
  lastY: number
  lastTime: number
  vx: number
  vy: number
}

const DEFAULT_DISTANCE = 76
const DEFAULT_VELOCITY = 0.44
const DEFAULT_LONG_PRESS = 520
const DEFAULT_EXIT = 460

export function useSwipeDeck(actions: SwipeDeckActions, options: SwipeDeckOptions = {}) {
  const distance = options.distance ?? DEFAULT_DISTANCE
  const velocity = options.velocity ?? DEFAULT_VELOCITY
  const longPressMs = options.longPressMs ?? DEFAULT_LONG_PRESS
  const exitMs = options.exitMs ?? DEFAULT_EXIT
  const enabled = options.enabled ?? true

  const [drag, setDrag] = useState<DeckDrag>({ x: 0, y: 0, active: false })
  const [exit, setExit] = useState<DeckExit | null>(null)
  const pointerRef = useRef<PointerSnapshot | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function reset() {
    setDrag({ x: 0, y: 0, active: false })
  }

  function commit(direction: SwipeDirection, action?: () => void) {
    const width = window.innerWidth || 390
    const horizontal = direction === 'right' || direction === 'left'
    const sign = direction === 'right' || direction === 'down' ? 1 : -1
    setExit({
      direction,
      x: horizontal ? sign * width * 1.4 : 0,
      y: direction === 'down' ? width * 0.85 : direction === 'up' ? -width * 0.7 : -24,
      rotate: horizontal ? sign * 12 : 0
    })
    window.setTimeout(() => {
      setExit(null)
      reset()
      action?.()
    }, exitMs)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || exit || isInteractiveTarget(event.target)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    longPressFired.current = false
    pointerRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      vx: 0,
      vy: 0
    }
    clearLongPress()
    if (actions.longPress) {
      longPressTimer.current = window.setTimeout(() => {
        longPressFired.current = true
        reset()
        tapHaptic([18, 35, 18])
        actions.longPress?.()
      }, longPressMs)
    }
    setDrag({ x: 0, y: 0, active: true })
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = pointerRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const now = performance.now()
    const elapsed = Math.max(now - start.lastTime, 16)
    const rawDx = event.clientX - start.x
    const rawDy = event.clientY - start.y
    if (Math.hypot(rawDx, rawDy) > 12) clearLongPress()
    start.vx = (event.clientX - start.lastX) / elapsed
    start.vy = (event.clientY - start.lastY) / elapsed
    start.lastX = event.clientX
    start.lastY = event.clientY
    start.lastTime = now
    setDrag({
      x: rubberDistance(rawDx, window.innerWidth * 0.82),
      y: rubberDistance(rawDy, window.innerHeight * 0.5),
      active: true
    })
  }

  function finish(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    clearLongPress()
    const start = pointerRef.current
    pointerRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may already have been released by the browser.
    }
    if (!start || start.pointerId !== event.pointerId || cancelled || longPressFired.current) {
      reset()
      return
    }
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const projX = dx + start.vx * 230
    const projY = dy + start.vy * 200
    const horizontal = Math.abs(projX) >= Math.abs(projY)
    const fast = Math.max(Math.abs(start.vx), Math.abs(start.vy)) > velocity

    if (horizontal && (Math.abs(projX) > distance || (fast && Math.abs(dx) > 22))) {
      if (projX > 0) {
        tapHaptic([8, 28, 8])
        commit('right', actions.right)
      } else {
        tapHaptic(10)
        commit('left', actions.left)
      }
      return
    }
    if (!horizontal && (Math.abs(projY) > distance || (fast && Math.abs(dy) > 22))) {
      if (projY < 0) {
        tapHaptic(8)
        commit('up', actions.up)
      } else {
        tapHaptic(12)
        commit('down', actions.down)
      }
      return
    }
    reset()
  }

  const bind = {
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => finish(event),
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finish(event, true)
  }

  const hints = {
    right: clamp(drag.x / distance, 0, 1),
    left: clamp(-drag.x / distance, 0, 1),
    up: clamp(-drag.y / distance, 0, 1),
    down: clamp(drag.y / distance, 0, 1)
  }

  return { drag, exit, bind, hints, exitMs }
}

function rubberDistance(distance: number, dimension: number) {
  const sign = Math.sign(distance)
  const absolute = Math.abs(distance)
  return sign * ((absolute * dimension) / (dimension + absolute * 0.62))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isInteractiveTarget(target: EventTarget) {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, select, textarea, audio, summary'))
}
