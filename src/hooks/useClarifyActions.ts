import { useI18n } from '../i18n/useI18n'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import type { Quote, QuoteStatus } from '../types/quote'

// Handlers for the top card: move to signals, keep in the inbox with edits, snooze, discard (with undo).
export function useClarifyActions(
  quote: Quote | undefined,
  buildPatch: (status: QuoteStatus) => Partial<Quote>,
  onMessage: (message: string) => void,
  // The optional first thought is appended on the fresh row after the main save, then cleared so a second save cannot repeat it.
  firstThought?: { text: string; onSaved: () => void }
) {
  const { t } = useI18n()
  const { saveQuote, addThought, snoozeQuote, discardQuote, restoreQuote } = useQuoteStore()
  const { showToast } = useToastStore()

  // Returns false when the entry itself could not be saved (e.g. it was deleted elsewhere); the user gets a toast instead of an unhandled rejection.
  async function saveWithThought(id: string, status: QuoteStatus) {
    try {
      await saveQuote(id, buildPatch(status))
    } catch {
      showToast({ message: t('saveFailed') })
      return false
    }
    if (firstThought?.text.trim()) {
      // The entry itself is saved at this point; a failing thought keeps its draft text and only reports the failure.
      try {
        await addThought(id, firstThought.text)
        firstThought.onSaved()
      } catch {
        showToast({ message: t('saveFailed') })
      }
    }
    return true
  }

  async function finishSignal() {
    if (!quote) return
    if (await saveWithThought(quote.id, 'signal')) onMessage(t('movedToSignals'))
  }

  async function saveDetails() {
    if (!quote) return
    if (await saveWithThought(quote.id, 'inbox')) onMessage(t('keptInNoise'))
  }

  async function snoozeCurrent() {
    if (!quote) return
    await snoozeQuote(quote.id)
    showToast({ message: t('snoozedToast') })
  }

  async function discardCurrent() {
    if (!quote) return
    const id = quote.id
    await discardQuote(id)
    showToast({ message: t('discardedToast'), actionLabel: t('undo'), onAction: () => void restoreQuote(id) })
  }

  return { finishSignal, saveDetails, snoozeCurrent, discardCurrent }
}
