import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { TodayPage } from './pages/TodayPage'

// Today is the landing page, so keep it in the main bundle. Everything else is
// split out so the first mobile load stays small.
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })))
const BooksPage = lazy(() => import('./pages/BooksPage').then((m) => ({ default: m.BooksPage })))
const BookDetailPage = lazy(() => import('./pages/BookDetailPage').then((m) => ({ default: m.BookDetailPage })))
const QuoteDetailPage = lazy(() => import('./pages/QuoteDetailPage').then((m) => ({ default: m.QuoteDetailPage })))
const AddQuotePage = lazy(() => import('./pages/AddQuotePage').then((m) => ({ default: m.AddQuotePage })))
const ImportExportPage = lazy(() => import('./pages/ImportExportPage').then((m) => ({ default: m.ImportExportPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/books/:id" element={<BookDetailPage />} />
        <Route path="/quote/:id" element={<QuoteDetailPage />} />
        <Route path="/add" element={<AddQuotePage />} />
        <Route path="/import" element={<ImportExportPage />} />
        <Route path="/export" element={<Navigate to="/import" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
