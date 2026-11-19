import { useI18n } from '../../i18n/useI18n'
import { languages, type LanguageCode } from '../../i18n/translations'
import { Panel } from './Panel'

export function LanguageSection() {
  const { language, setLanguage, t } = useI18n()

  return (
    <Panel title={t('language')} defaultOpen>
      <p className="text-sm leading-6 text-graphite">{t('languageHelp')}</p>
      <select
        className="mt-4 w-full rounded-md border border-line bg-paper px-3 py-2"
        value={language}
        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </Panel>
  )
}
