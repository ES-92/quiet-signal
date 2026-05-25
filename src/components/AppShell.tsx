import { BookMarked, BookOpen, Download, Library, Loader2, PenLine, Settings, Sparkles } from 'lucide-react'
import { Suspense } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import { InstallPrompt } from './InstallPrompt'

const navItems = [
  { to: '/today', labelKey: 'today', icon: Sparkles },
  { to: '/library', labelKey: 'library', icon: Library },
  { to: '/books', labelKey: 'books', icon: BookMarked },
  { to: '/add', labelKey: 'add', icon: PenLine },
  { to: '/import', labelKey: 'data', icon: Download },
  { to: '/settings', labelKey: 'settings', icon: Settings }
] as const

type NavItem = (typeof navItems)[number]

export function AppShell() {
  const { t } = useI18n()
  const location = useLocation()
  const isToday = location.pathname === '/today' || location.pathname === '/'

  return (
    <div className="flex min-h-[100dvh] flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-ink sm:pb-0">
      <header className="mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-8 sm:py-5">
        <NavLink to="/today" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-ink bg-ink text-paper shadow-[0_10px_25px_rgba(31,30,28,0.16)] sm:h-10 sm:w-10">
            <BookOpen size={18} />
          </span>
          <span>
            <span className="block font-serif text-xl leading-none tracking-wide sm:text-2xl">Commonplace</span>
            <span className="hidden text-xs uppercase tracking-[0.2em] text-graphite sm:block">{t('appTagline')}</span>
          </span>
        </NavLink>
        <nav className="hidden items-center gap-1 sm:flex" aria-label={t('primaryNavigation')}>
          {navItems.map((item) => (
            <NavButton key={item.to} item={item} />
          ))}
        </nav>
      </header>
      <main
        className={[
          'mx-auto w-full max-w-6xl flex-1 px-4 sm:px-8',
          isToday ? 'flex min-h-0 pb-3 sm:pb-6' : 'pb-12'
        ].join(' ')}
      >
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-paper/95 px-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-16px_40px_rgba(31,30,28,0.08)] backdrop-blur sm:hidden"
        aria-label={t('mobileNavigation')}
      >
        {navItems.map((item) => (
          <NavButton key={item.to} item={item} compact />
        ))}
      </nav>
      <InstallPrompt />
    </div>
  )
}

function PageLoader() {
  return (
    <div className="flex min-h-[40dvh] w-full items-center justify-center">
      <Loader2 className="animate-spin text-graphite" size={28} aria-label="…" />
    </div>
  )
}

function NavButton({ item, compact = false }: { item: NavItem; compact?: boolean }) {
  const { t } = useI18n()
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          'flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-graphite transition',
          compact ? 'min-h-[44px] px-1' : '',
          isActive ? 'bg-ink text-paper shadow-[0_8px_20px_rgba(31,30,28,0.12)]' : 'hover:bg-white/50 hover:text-ink'
        ].join(' ')
      }
      aria-label={t(item.labelKey)}
    >
      <Icon size={compact ? 18 : 16} />
      <span className={compact ? 'sr-only' : ''}>{t(item.labelKey)}</span>
    </NavLink>
  )
}
