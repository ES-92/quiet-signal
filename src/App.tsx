import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AddQuotePage } from './pages/AddQuotePage'
import { BookDetailPage } from './pages/BookDetailPage'
import { BooksPage } from './pages/BooksPage'
import { ImportExportPage } from './pages/ImportExportPage'
import { LibraryPage } from './pages/LibraryPage'
import { QuoteDetailPage } from './pages/QuoteDetailPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'

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
