import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DailyRestState } from '../components/deck/DailyRestState'
import { QuickCaptureDock } from '../components/deck/QuickCaptureDock'
import { GestureCoach } from '../components/GestureCoach'
import { TodayActionBar } from '../components/today/TodayActionBar'
import { TodayBookEditor } from '../components/today/TodayBookEditor'
import { TodayContextMenu } from '../components/today/TodayContextMenu'
import { TodayDeckStack } from '../components/today/TodayDeckStack'
import { TodayHeader } from '../components/today/TodayHeader'
import { ThoughtSheet } from '../components/thoughts/ThoughtSheet'
import { useDailySession } from '../hooks/useDailySession'
import { useSwipeDeck } from '../hooks/useSwipeDeck'
import { useTodayActions } from '../hooks/useTodayActions'
import { useI18n } from '../i18n/useI18n'
import { markCoachmarkSeen, shouldShowCoachmark } from '../services/coach'
import { thoughtsNewestFirst } from '../services/thoughts'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'

export function TodayPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const session = useDailySession()
  const { currentQuote, currentBook, currentIndex, dailyQuotes } = session
  const actions = useTodayActions({
    currentQuote,
    currentBook,
    browsing: session.browsing,
    advanceIndex: session.advanceIndex,
    hideQuote: session.hideQuote,
    showQuote: session.showQuote
  })

  // The coach is shown once per device; whether it was seen is read once when the page mounts.
  const [coachDismissed, setCoachDismissed] = useState(() => !shouldShowCoachmark())
  const coachVisible = Boolean(currentQuote) && !coachDismissed

  const { addThought } = useQuoteStore()
  const { showToast } = useToastStore()

  // Saves the thought, then closes the sheet; the card stays on top. On failure the sheet keeps the text.
  async function saveThought(text: string) {
    if (!currentQuote) return
    try {
      await addThought(currentQuote.id, text)
      actions.closeThought()
    } catch {
      showToast({ message: t('saveFailed') })
    }
  }

  function dismissCoach() {
    markCoachmarkSeen()
    setCoachDismissed(true)
  }

  const deck = useSwipeDeck(
    {
      right: () => void actions.handleMoreOften(),
      left: () => void actions.handleLessOften(),
      down: actions.handleRest,
      up: actions.openThought,
      longPress: actions.openContext
    },
    {
      enabled: Boolean(currentQuote) && !actions.contextOpen && !actions.thoughtOpen && !coachVisible,
      distance: 76,
      exitMs: 620
    }
  )

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden sm:gap-4">
      <TodayHeader showReflectionNudge={session.showReflectionNudge} reflectionCount={session.reflectionCount} />

      {session.loading ? (
        <div className="flex min-h-0 items-center justify-center rounded-md border border-line bg-white/30 text-graphite">
          {t('loadingLibrary')}
        </div>
      ) : currentQuote ? (
        <div
          data-testid="today-deck-area"
          // The hint row only exists while browsing; without it the card must own the single flexible row.
          className={`grid min-h-0 gap-2 ${session.browsing ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]'}`}
        >
          {session.browsing && (
            <div className="flex items-center justify-center gap-3 text-xs text-graphite">
              <span>{t('browsingLabel')}</span>
              <button
                type="button"
                className="quiet-touch rounded-full border border-line bg-paper/82 px-3 py-1 text-ink transition active:scale-[0.98]"
                onClick={session.stopBrowsing}
              >
                {t('stopBrowsing')}
              </button>
            </div>
          )}
          <TodayDeckStack
            quote={currentQuote}
            nextQuote={session.nextQuote}
            thirdQuote={session.thirdQuote}
            position={currentIndex + 1}
            total={dailyQuotes.length}
            deck={deck}
          >
            {actions.contextOpen && (
              <TodayContextMenu
                favorite={currentQuote.favorite}
                hasBook={Boolean(currentBook)}
                onClose={actions.closeContext}
                onFavorite={() => void actions.handleFavoriteToggle()}
                onOpenDetails={actions.handleOpenDetails}
                onEditBook={actions.openBookEditor}
                onDiscard={actions.handleContextDiscard}
              />
            )}
            {coachVisible && <GestureCoach deck="today" onDismiss={dismissCoach} />}
          </TodayDeckStack>
        </div>
      ) : (
        <DailyRestState
          title={session.stackCompleted ? t('doneForToday') : t('nothingDueToday')}
          body={session.stackCompleted ? t('doneForTodayBody') : session.hasSignals ? t('nothingDueBodyWithSignals') : t('nothingDueBody')}
          showReflection={session.showReflectionNudge}
          onOpenReflections={() => navigate('/reflections')}
          inboxCount={session.inboxCount}
          onOpenInbox={() => navigate('/inbox')}
          onBrowse={session.hasSignals ? session.startBrowsing : undefined}
        />
      )}
      {actions.thoughtOpen && currentQuote && (
        <ThoughtSheet
          thoughts={thoughtsNewestFirst(currentQuote)}
          onSave={(text) => void saveThought(text)}
          onClose={actions.closeThought}
        />
      )}
      {actions.bookEditorOpen && currentBook && (
        <TodayBookEditor
          title={actions.bookTitle}
          author={actions.bookAuthor}
          onTitleChange={actions.setBookTitle}
          onAuthorChange={actions.setBookAuthor}
          onClose={actions.closeBookEditor}
          onSave={() => void actions.handleSaveBook()}
        />
      )}
      <footer className="flex shrink-0 flex-col items-center gap-2 pb-1" aria-label={t('quickNoise')}>
        {currentQuote && (
          <TodayActionBar
            onMoreOften={() => void actions.handleMoreOften()}
            onLessOften={() => void actions.handleLessOften()}
            onThought={actions.openThought}
            onRest={actions.handleRest}
            onMenu={actions.openContext}
            contextOpen={actions.contextOpen}
            disabled={coachVisible || actions.contextOpen || actions.thoughtOpen}
          />
        )}
        <div className="sm:hidden">
          <QuickCaptureDock />
        </div>
      </footer>
    </div>
  )
}
