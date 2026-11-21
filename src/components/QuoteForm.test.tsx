import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { translations } from '../i18n/translations'
import { useBookStore } from '../store/useBookStore'
import { makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { QuoteForm } from './QuoteForm'

const en = translations.en

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useBookStore.setState({ books: [], loading: true })
})

describe('QuoteForm', () => {
  it('submits every field when creating a new entry', async () => {
    // Arrange
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<QuoteForm submitLabel="Go" onSubmit={onSubmit} />)

    // Act
    fireEvent.change(screen.getByLabelText(en.text), { target: { value: 'Neu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      text: 'Neu',
      tags: [],
      favorite: false,
      status: 'signal',
      signalStrength: 'normal',
      entryType: 'note'
    })
    expect(Object.keys(onSubmit.mock.calls[0][0])).toEqual(expect.arrayContaining(['author', 'note', 'people', 'status']))
  })

  it('submits only the changed fields when editing', async () => {
    // Arrange
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<QuoteForm quote={makeQuote({ id: 'q-1', text: 'Alt', tags: ['a'] })} submitLabel="Go" onSubmit={onSubmit} />)

    // Act
    fireEvent.change(screen.getByLabelText(en.tags), { target: { value: 'b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({ tags: ['b'] })
  })

  it('still submits a cleared optional field as undefined', async () => {
    // Arrange
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<QuoteForm quote={makeQuote({ id: 'q-1', author: 'Autor' })} submitLabel="Go" onSubmit={onSubmit} />)

    // Act
    fireEvent.change(screen.getByLabelText(en.author), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const changes = onSubmit.mock.calls[0][0]
    expect(Object.keys(changes)).toEqual(['author'])
    expect(changes.author).toBeUndefined()
  })
})
