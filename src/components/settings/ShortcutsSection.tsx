import { Copy } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { useShortcutCopy } from '../../hooks/useShortcutCopy'
import { Panel } from './Panel'

export function ShortcutsSection() {
  const { t } = useI18n()
  const shortcut = useShortcutCopy()

  return (
    <Panel title={t('shortcuts')}>
      <p className="text-sm leading-6 text-graphite">{t('shortcutsHelp')}</p>
      <div className="mt-4 grid gap-2">
        <ShortcutButton label={t('shortcutText')} onClick={() => void shortcut.copy('text')} />
        <ShortcutButton label={t('shortcutPhoto')} onClick={() => void shortcut.copy('photo')} />
        <ShortcutButton label={t('shortcutAudio')} onClick={() => void shortcut.copy('audio')} />
      </div>
      {shortcut.message && <p className="mt-3 break-words text-sm leading-6 text-moss">{shortcut.message}</p>}
    </Panel>
  )
}

function ShortcutButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-[44px] items-center justify-between gap-3 rounded-md border border-line bg-paper/70 px-3 py-2 text-left text-sm text-graphite transition hover:border-ink/45 hover:text-ink"
      onClick={onClick}
    >
      <span className="truncate">{label}</span>
      <Copy size={15} />
    </button>
  )
}
