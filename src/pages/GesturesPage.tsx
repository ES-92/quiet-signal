import { useI18n } from '../i18n/I18nProvider'

export function GesturesPage() {
  const { t } = useI18n()
  const cardGestures = [
    { dir: '→', label: `${t('gestureKeep')} / ${t('finishSignal')}` },
    { dir: '←', label: t('later') },
    { dir: '↓', label: t('deleteNoise') },
    { dir: '↑', label: t('details') }
  ]
  const more = [t('gestureCapture'), t('gestureInbox'), t('gestureMenu'), t('gestureLongPress')]

  return (
    <div className="grid gap-6 pt-3 sm:gap-8 sm:pt-10">
      <section>
        <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('gestures')}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{t('gestures')}</h1>
        <p className="mt-4 max-w-xl leading-7 text-graphite">{t('gesturesIntro')}</p>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">{t('gesturesCardSection')}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {cardGestures.map((gesture) => (
            <li key={gesture.dir} className="flex items-center gap-3 rounded-md border border-line bg-white/30 px-4 py-3">
              <span className="w-6 text-center font-serif text-2xl text-ink">{gesture.dir}</span>
              <span className="text-sm text-graphite">{gesture.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">{t('gesturesMoreSection')}</h2>
        <ul className="grid gap-2">
          {more.map((line) => (
            <li key={line} className="rounded-md border border-line bg-white/30 px-4 py-3 text-sm leading-6 text-graphite">
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
