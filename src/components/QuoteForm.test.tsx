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
      status: 'signal'
    })
    const submitted = Object.keys(onSubmit.mock.calls[0][0])
    expect(submitted).toEqual(expect.arrayContaining(['author', 'note', 'people', 'status']))
    expect(submitted).not.toEqual(expect.arrayContaining(['signalStrength']))
    expect(submitted).not.toEqual(expect.arrayContaining(['entryType']))
    expect(submitted.some((key) => key.startsWith('location'))).toBe(false)
  })

  it('shows the status select directly, outside the collapsed details block', () => {
    // Arrange
    renderWithProviders(<QuoteForm quote={makeQuote({ id: 'q-1' })} submitLabel="Go" onSubmit={vi.fn()} />)

    // Act
    const select = screen.getByLabelText(en.entryStatus)

    // Assert
    expect(select.closest('details')).toBeNull()
    expect(screen.getByLabelText(en.author).closest('details')).not.toBeNull()
  })

  it('re-enables the save button when the submit fails', async () => {
    // Arrange
    const onSubmit = vi.fn().mockRejectedValue(new Error('boom'))
    renderWithProviders(<QuoteForm submitLabel="Go" onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText(en.text), { target: { value: 'Neu' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('button', { name: 'Go' })).toBeEnabled()
    expect(screen.getByLabelText(en.text)).toHaveValue('Neu')
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

  it('zeigt weder Art, Signalstärke noch Ort und lässt gespeicherte Werte beim Bearbeiten unberührt', async () => {
    // Arrange
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const quote = makeQuote({
      id: 'q-1',
      text: 'Alt',
      signalStrength: 'strong',
      entryType: 'idea',
      locationName: 'Eilenriede',
      locationLatitude: 52.38,
      locationLongitude: 9.76
    })
    const { container } = renderWithProviders(<QuoteForm quote={quote} submitLabel="Go" onSubmit={onSubmit} />)

    // Act
    fireEvent.change(screen.getByLabelText(en.text), { target: { value: 'Neu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({ text: 'Neu' })
    expect(container.textContent).not.toMatch(/Eilenriede|Location|Signal strength/i)
    expect(container.querySelectorAll('button[aria-pressed]')).toHaveLength(0)
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
