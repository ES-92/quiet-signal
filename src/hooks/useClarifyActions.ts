import { useI18n } from '../i18n/useI18n'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import type { Quote, QuoteStatus, SignalStrength } from '../types/quote'

// Handlers for the top card: move to signals, keep in the inbox with edits, snooze, discard (with undo).
export function useClarifyActions(
  quote: Quote | undefined,
  buildPatch: (status: QuoteStatus, strength?: SignalStrength) => Partial<Quote>,
  onMessage: (message: string) => void,
  // The optional first thought is appended on the fresh row after the main save, then cleared so a second save cannot repeat it.
  firstThought?: { text: string; onSaved: () => void }
) {
  const { t } = useI18n()
  const { saveQuote, addThought, snoozeQuote, discardQuote, restoreQuote } = useQuoteStore()
  const { showToast } = useToastStore()

  async function saveWithThought(id: string, status: QuoteStatus, strength?: SignalStrength) {
    await saveQuote(id, buildPatch(status, strength))
    if (firstThought?.text.trim()) {
      await addThought(id, firstThought.text)
      firstThought.onSaved()
    }
  }

  async function finishSignal(strength?: SignalStrength) {
    if (!quote) return
    await saveWithThought(quote.id, 'signal', strength)
    onMessage(t('movedToSignals'))
  }

  async function saveDetails() {
    if (!quote) return
    await saveWithThought(quote.id, 'inbox')
    onMessage(t('keptInNoise'))
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
