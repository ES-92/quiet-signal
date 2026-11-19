import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DailyRestState } from '../components/deck/DailyRestState'
import { QuickCaptureDock } from '../components/deck/QuickCaptureDock'
import { GestureCoach } from '../components/GestureCoach'
import { TodayBookEditor } from '../components/today/TodayBookEditor'
import { TodayContextMenu } from '../components/today/TodayContextMenu'
import { TodayDeckStack } from '../components/today/TodayDeckStack'
import { TodayHeader } from '../components/today/TodayHeader'
import { useDailySession } from '../hooks/useDailySession'
import { useSwipeDeck } from '../hooks/useSwipeDeck'
import { useTodayActions } from '../hooks/useTodayActions'
import { useI18n } from '../i18n/useI18n'
import { markCoachmarkSeen, shouldShowCoachmark } from '../services/coach'

export function TodayPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const session = useDailySession()
  const { currentQuote, currentBook, currentIndex, dailyQuotes } = session
  const actions = useTodayActions({
    currentQuote,
    currentBook,
    advanceIndex: session.advanceIndex,
    hideQuote: session.hideQuote,
    showQuote: session.showQuote
  })

  // The coach is shown once per device; whether it was seen is read once when the page mounts.
  const [coachDismissed, setCoachDismissed] = useState(() => !shouldShowCoachmark())
  const coachVisible = Boolean(currentQuote) && !coachDismissed

  function dismissCoach() {
    markCoachmarkSeen()
    setCoachDismissed(true)
  }

  const deck = useSwipeDeck(
    {
      right: actions.handleKeep,
      left: actions.handleSnooze,
      down: actions.handleDiscard,
      up: actions.openContext,
      longPress: actions.openContext
    },
    { enabled: Boolean(currentQuote) && !actions.contextOpen && !coachVisible, distance: 76, exitMs: 620 }
  )

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden sm:gap-4">
      <TodayHeader showReflectionNudge={session.showReflectionNudge} reflectionCount={session.reflectionCount} />

      {session.loading ? (
        <div className="flex min-h-0 items-center justify-center rounded-md border border-line bg-white/30 text-graphite">
          {t('loadingLibrary')}
        </div>
      ) : currentQuote ? (
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
              onSnooze={actions.handleContextSnooze}
              onDislike={actions.handleDislike}
              onOpenDetails={actions.handleOpenDetails}
              onEditBook={actions.openBookEditor}
              onDiscard={actions.handleContextDiscard}
            />
          )}
          {coachVisible && <GestureCoach deck="today" onDismiss={dismissCoach} />}
        </TodayDeckStack>
      ) : (
        <DailyRestState
          title={session.stackCompleted ? t('doneForToday') : t('nothingDueToday')}
          body={session.stackCompleted ? t('doneForTodayBody') : t('nothingDueBody')}
          showReflection={session.showReflectionNudge}
          onOpenReflections={() => navigate('/reflections')}
          inboxCount={session.inboxCount}
          onOpenInbox={() => navigate('/inbox')}
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
      <footer className="flex shrink-0 justify-center pb-1 sm:hidden" aria-label={t('quickNoise')}>
        <QuickCaptureDock />
      </footer>
    </div>
  )
}
