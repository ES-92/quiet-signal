import { Moon, Sun } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { useSettingsStore, type AppTheme } from '../../store/useSettingsStore'
import { Panel } from './Panel'

export function AppearanceSection() {
  const { t } = useI18n()
  const { theme, setTheme } = useSettingsStore()

  return (
    <Panel title={t('appearance')} defaultOpen>
      <p className="text-sm leading-6 text-graphite">{t('appearanceHelp')}</p>
      <ThemeToggle theme={theme} onChange={setTheme} />
    </Panel>
  )
}

function ThemeToggle({ theme, onChange }: { theme: AppTheme; onChange: (theme: AppTheme) => void }) {
  const { t } = useI18n()
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      className="mt-4 flex min-h-[50px] w-full items-center justify-between rounded-md border border-line bg-paper/80 p-1 text-sm text-ink transition hover:border-ink/45"
      aria-pressed={dark}
      onClick={() => onChange(dark ? 'light' : 'dark')}
    >
      <span
        className={[
          'flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded px-3 transition',
          !dark ? 'bg-ink text-paper shadow-[0_8px_18px_rgba(31,30,28,0.14)]' : 'text-graphite'
        ].join(' ')}
      >
        <Sun size={16} />
        {t('lightMode')}
      </span>
      <span
        className={[
          'flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded px-3 transition',
          dark ? 'bg-ink text-paper shadow-[0_8px_18px_rgba(31,30,28,0.14)]' : 'text-graphite'
        ].join(' ')}
      >
        <Moon size={16} />
        {t('darkMode')}
      </span>
    </button>
  )
}
