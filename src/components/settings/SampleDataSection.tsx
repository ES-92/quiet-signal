import { useI18n } from '../../i18n/useI18n'
import { sampleSeed } from '../../services/sampleData'
import { useBookStore } from '../../store/useBookStore'
import { useQuoteStore } from '../../store/useQuoteStore'
import { Panel } from './Panel'

export function SampleDataSection() {
  const { t } = useI18n()
  const importQuotes = useQuoteStore((state) => state.importQuotes)
  const importBooks = useBookStore((state) => state.importBooks)

  async function loadSamples() {
    const seed = sampleSeed()
    await importBooks(seed.books)
    await importQuotes(seed.quotes)
  }

  return (
    <Panel title={t('sampleData')}>
      <button className="mt-4 rounded-md bg-ink px-4 py-2 text-sm text-paper" onClick={() => void loadSamples()}>
        {t('loadSamples')}
      </button>
    </Panel>
  )
}
