import { Loader2, Menu } from 'lucide-react'
import { Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import { captureEventName, isCaptureMode, type CaptureMode } from '../services/captureEvents'
import { tapHaptic } from '../services/haptics'
import { CommandDrawer } from './CommandDrawer'
import { InstallPrompt } from './InstallPrompt'
import { Onboarding } from './Onboarding'
import { Toast } from './Toast'
import { SignalMark } from './SignalMark'
import { ZeroCaptureSheet } from './ZeroCaptureSheet'

export function AppShell() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const isToday = location.pathname === '/today' || location.pathname === '/'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('text')
  const gestureRef = useRef<{ x: number; y: number; startedAtTop: boolean; edge: 'left' | 'right' | null } | null>(null)

  useEffect(() => {
    const openCapture = (event: Event) => {
      const mode = event instanceof CustomEvent && isCaptureMode(event.detail?.mode) ? event.detail.mode : 'text'
      setCaptureMode(mode)
      setCaptureOpen(true)
    }
    const openDrawer = () => setDrawerOpen(true)
    window.addEventListener(captureEventName, openCapture)
    window.addEventListener('quiet-signal-open-drawer', openDrawer)
    return () => {
      window.removeEventListener(captureEventName, openCapture)
      window.removeEventListener('quiet-signal-open-drawer', openDrawer)
    }
  }, [])

  useEffect(() => {
    if (!isToday) return
    const params = new URLSearchParams(location.search)
    const mode = params.get('capture')
    if (!isCaptureMode(mode)) return
    setCaptureMode(mode)
    setCaptureOpen(true)
    navigate('/today', { replace: true })
  }, [isToday, location.search, navigate])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        tapHaptic(8)
        setDrawerOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (!isToday || isInteractiveTarget(event.target)) return
    const width = window.innerWidth || 390
    gestureRef.current = {
      x: event.clientX,
      y: event.clientY,
      startedAtTop: event.clientY < 190,
      edge: event.clientX < 28 ? 'left' : event.clientX > width - 28 ? 'right' : null
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    const start = gestureRef.current
    gestureRef.current = null
    if (!start || !isToday) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (start.edge === 'left' && dx > 76 && Math.abs(dy) < 90) {
      tapHaptic(14)
      navigate('/inbox')
      return
    }
    if (start.edge === 'right' && dx < -76 && Math.abs(dy) < 90) {
      tapHaptic(14)
      setDrawerOpen(true)
      return
    }
    if (start.startedAtTop && dy > 90 && Math.abs(dx) < 70) {
      tapHaptic(10)
      setCaptureMode('text')
      setCaptureOpen(true)
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden text-ink">
      <header
        className="mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))] transition sm:px-8 sm:py-5"
      >
        <NavLink to="/today" className="flex items-center gap-3" aria-label="Quiet Signal">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-ink bg-ink text-paper shadow-[0_10px_25px_rgba(31,30,28,0.16)] sm:h-10 sm:w-10">
            <SignalMark className="h-6 w-6" />
          </span>
          <span className="hidden sm:block">
            <span className="block font-serif text-xl leading-none tracking-wide sm:text-2xl">Quiet Signal</span>
            <span className="hidden text-xs uppercase tracking-[0.2em] text-graphite sm:block">{t('appTagline')}</span>
          </span>
        </NavLink>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line bg-paper/70 text-graphite transition hover:border-ink/40 hover:text-ink"
          onClick={() => {
            tapHaptic(8)
            setDrawerOpen(true)
          }}
          aria-label={t('openCommandMenu')}
        >
          <Menu size={18} />
        </button>
      </header>
      {isToday && (
        <>
          <div className="pointer-events-none fixed left-0 top-[32dvh] z-20 h-28 w-3 rounded-r-full border-y border-r border-line bg-paper/50 opacity-70 transition" />
          <div className="pointer-events-none fixed right-0 top-[32dvh] z-20 h-28 w-3 rounded-l-full border-y border-l border-line bg-paper/50 opacity-70 transition" />
        </>
      )}
      <main
        className={[
          'mx-auto w-full max-w-6xl min-h-0 flex-1 px-4 sm:px-8',
          isToday ? 'flex overflow-hidden pb-3 sm:pb-6' : 'overflow-y-auto pb-8 sm:pb-12'
        ].join(' ')}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <CommandDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <ZeroCaptureSheet open={captureOpen} onClose={() => setCaptureOpen(false)} initialMode={captureMode} />
      <InstallPrompt />
      <Onboarding />
      <Toast />
    </div>
  )
}

function PageLoader() {
  return (
    <div className="flex min-h-[40dvh] w-full items-center justify-center">
      <Loader2 className="animate-spin text-graphite" size={28} aria-label="Loading" />
    </div>
  )
}

function isInteractiveTarget(target: EventTarget) {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, select, textarea, audio, summary'))
}
