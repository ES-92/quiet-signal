import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { TodayPage } from './pages/TodayPage'

// Today is the landing page, so keep it in the main bundle. Everything else is
// split out so the first mobile load stays small.
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })))
const InboxPage = lazy(() => import('./pages/InboxPage').then((m) => ({ default: m.InboxPage })))
const BooksPage = lazy(() => import('./pages/BooksPage').then((m) => ({ default: m.BooksPage })))
const BookDetailPage = lazy(() => import('./pages/BookDetailPage').then((m) => ({ default: m.BookDetailPage })))
const QuoteDetailPage = lazy(() => import('./pages/QuoteDetailPage').then((m) => ({ default: m.QuoteDetailPage })))
const AddQuotePage = lazy(() => import('./pages/AddQuotePage').then((m) => ({ default: m.AddQuotePage })))
const ImportExportPage = lazy(() => import('./pages/ImportExportPage').then((m) => ({ default: m.ImportExportPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const MigrationPage = lazy(() => import('./pages/MigrationPage').then((m) => ({ default: m.MigrationPage })))
const ShareTargetPage = lazy(() => import('./pages/ShareTargetPage').then((m) => ({ default: m.ShareTargetPage })))
const ReflectionsPage = lazy(() => import('./pages/ReflectionsPage').then((m) => ({ default: m.ReflectionsPage })))

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-paper" />}>
      <Routes>
        <Route path="/migrate" element={<MigrationPage />} />
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/books" element={<BooksPage />} />
          <Route path="/books/:id" element={<BookDetailPage />} />
          <Route path="/quote/:id" element={<QuoteDetailPage />} />
          <Route path="/add" element={<AddQuotePage />} />
          <Route path="/import" element={<ImportExportPage />} />
          <Route path="/export" element={<Navigate to="/import" replace />} />
          <Route path="/share-target" element={<ShareTargetPage />} />
          <Route path="/reflections" element={<ReflectionsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
