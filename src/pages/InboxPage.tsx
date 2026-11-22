import { useState } from 'react'
import { ClarifyActionBar } from '../components/deck/ClarifyActionBar'
import { ClarifyDeckStack } from '../components/deck/ClarifyDeckStack'
import { ClarifyDetailsForm } from '../components/deck/ClarifyDetailsForm'
import { InboxCaptureForm } from '../components/deck/InboxCaptureForm'
import { EmptyState } from '../components/EmptyState'
import { useClarifyActions } from '../hooks/useClarifyActions'
import { useClarifyDraft } from '../hooks/useClarifyDraft'
import { useInboxQueue } from '../hooks/useInboxQueue'
import { useQuickCapture } from '../hooks/useQuickCapture'
import { useSwipeDeck } from '../hooks/useSwipeDeck'
import { useI18n } from '../i18n/useI18n'
import { openCapture } from '../services/captureEvents'
import { markCoachmarkSeen, shouldShowCoachmark } from '../services/coach'

export function InboxPage() {
  const { t } = useI18n()
  const { inboxQuotes, books } = useInboxQueue()
  const [message, setMessage] = useState('')
  const capture = useQuickCapture(setMessage)
  // The deck always works on the first entry; handled entries leave the list, so the next one moves up.
  const currentQuote = inboxQuotes[0]
  const { draft, updateDraft, changeBook, buildPatch, detailsOpen, setDetailsOpen } = useClarifyDraft(
    currentQuote,
    books
  )
  const { finishSignal, saveDetails, snoozeCurrent, discardCurrent } = useClarifyActions(
    currentQuote,
    buildPatch,
    setMessage,
    { text: draft.firstThought, onSaved: () => updateDraft({ firstThought: '' }) }
  )

  // The coach is shown once per device; whether it was seen is read once when the page mounts.
  const [coachDismissed, setCoachDismissed] = useState(() => !shouldShowCoachmark())
  const coachVisible = Boolean(currentQuote) && !coachDismissed

  function dismissCoach() {
    markCoachmarkSeen()
    setCoachDismissed(true)
  }

  const deck = useSwipeDeck(
    {
      right: () => void finishSignal(),
      left: () => void snoozeCurrent(),
      up: () => setDetailsOpen(true),
      down: () => void discardCurrent()
    },
    { enabled: Boolean(currentQuote) && !detailsOpen && !coachVisible, distance: 76, exitMs: 340 }
  )

  return (
    <div className="grid gap-5 pt-3 sm:gap-8 sm:pt-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
      <section className="min-w-0">
        <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('noiseInbox')}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{t('noiseInboxTitle')}</h1>
        <p className="mt-4 max-w-xl leading-7 text-graphite">{t('noiseInboxIntro')}</p>
        <p className="mt-2 max-w-xl text-sm leading-6 text-graphite">{t('clarifyQuestion')}</p>
        <button
          className="mt-5 min-h-[46px] w-full rounded-md bg-ink px-4 py-3 text-sm text-paper shadow-[0_14px_34px_rgba(31,30,28,0.14)] sm:hidden"
          onClick={() => openCapture('text')}
        >
          {t('openCapture')}
        </button>

        <InboxCaptureForm
          text={capture.text}
          onTextChange={capture.setText}
          tags={capture.tags}
          onTagsChange={capture.setTags}
          imageDataUrl={capture.imageDataUrl}
          onImageChange={capture.setImage}
          audioDataUrl={capture.audioDataUrl}
          onAudioChange={capture.setAudio}
          canSave={capture.canSave}
          onSubmit={(event) => void capture.submit(event)}
        />
      </section>

      <section className="min-w-0 lg:sticky lg:top-8 lg:self-start">
        {message && (
          <p className="mb-4 rounded-md border border-line bg-paper/80 px-4 py-3 text-sm text-moss">{message}</p>
        )}
        <div className="quiet-sheet classical-panel overflow-hidden rounded-md">
          <div className="border-b border-line p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-graphite">{t('signalProcessing')}</p>
                <h2 className="mt-1 font-serif text-3xl">{t('clarifyStack')}</h2>
              </div>
              {inboxQuotes.length > 0 && (
                <span className="shrink-0 rounded border border-line px-2 py-1 text-xs text-graphite">
                  {t('cardProgress', { current: 1, total: inboxQuotes.length })}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-graphite">{t('clarifyIntro')}</p>
          </div>

          {currentQuote ? (
            <div className="grid gap-4 p-4 sm:p-5">
              <ClarifyDeckStack
                quote={currentQuote}
                nextQuote={inboxQuotes[1]}
                thirdQuote={inboxQuotes[2]}
                deck={deck}
                coachVisible={coachVisible}
                onDismissCoach={dismissCoach}
              />
              <ClarifyActionBar
                onFinish={() => void finishSignal()}
                onToggleDetails={() => setDetailsOpen((open) => !open)}
                onSnooze={() => void snoozeCurrent()}
                onDiscard={() => void discardCurrent()}
              />
              <p className="text-center text-xs leading-5 text-graphite">{t('clarifyGestureHint')}</p>

              {detailsOpen && (
                <ClarifyDetailsForm
                  draft={draft}
                  books={books}
                  onChange={updateDraft}
                  onBookChange={changeBook}
                  onSave={() => void saveDetails()}
                  onFinish={() => void finishSignal()}
                />
              )}
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <EmptyState title={t('inboxEmptyTitle')}>{t('inboxEmptyBody')}</EmptyState>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
