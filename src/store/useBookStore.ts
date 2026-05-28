import { create } from 'zustand'
import { clearBooks, createBook, deleteBook, listBooks, updateBook, upsertBooks } from '../db/database'
import type { Book, BookInput, BookWeight } from '../types/book'
import { useQuoteStore } from './useQuoteStore'

interface BookStore {
  books: Book[]
  loading: boolean
  loadBooks: () => Promise<void>
  addBook: (input: BookInput) => Promise<Book>
  saveBook: (id: string, patch: Partial<Book>) => Promise<void>
  setWeight: (id: string, weight: BookWeight) => Promise<void>
  removeBook: (id: string) => Promise<void>
  importBooks: (books: Book[]) => Promise<void>
  clearAll: () => Promise<void>
}

export const useBookStore = create<BookStore>((set, get) => ({
  books: [],
  loading: true,
  loadBooks: async () => {
    set({ loading: true })
    set({ books: await listBooks(), loading: false })
  },
  addBook: async (input) => {
    const book = await createBook(input)
    await get().loadBooks()
    return book
  },
  saveBook: async (id, patch) => {
    const previousBook = get().books.find((book) => book.id === id)
    await updateBook(id, patch)
    const nextTitle = patch.title?.trim() || previousBook?.title
    const nextAuthor = patch.author !== undefined ? patch.author?.trim() || undefined : previousBook?.author
    const changedIdentity =
      Boolean(previousBook) &&
      ((patch.title !== undefined && nextTitle !== previousBook?.title) ||
        (patch.author !== undefined && nextAuthor !== previousBook?.author))

    if (previousBook && nextTitle && changedIdentity) {
      await useQuoteStore.getState().syncBookReferences(
        id,
        { title: nextTitle, author: nextAuthor },
        { title: previousBook.title, author: previousBook.author }
      )
    }
    await get().loadBooks()
  },
  setWeight: async (id, weight) => {
    // Optimistic so the weight control feels instant.
    set((state) => ({ books: state.books.map((book) => (book.id === id ? { ...book, weight } : book)) }))
    await updateBook(id, { weight })
  },
  removeBook: async (id) => {
    await deleteBook(id)
    await useQuoteStore.getState().unlinkBook(id)
    await get().loadBooks()
  },
  importBooks: async (books) => {
    await upsertBooks(books)
    await get().loadBooks()
  },
  clearAll: async () => {
    await clearBooks()
    await get().loadBooks()
  }
}))
