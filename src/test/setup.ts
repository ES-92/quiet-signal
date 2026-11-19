import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

beforeEach(() => {
  localStorage.clear()
})

// Vitest runs without globals, so Testing Library's automatic cleanup is not registered.
afterEach(() => {
  cleanup()
})
