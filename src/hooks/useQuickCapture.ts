import { useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useQuoteStore } from '../store/useQuoteStore'
import type { SignalStrength } from '../types/quote'
import { splitList } from '../utils/draftFields'

// State and submit handler of the quick-capture form (text, photo, voice, tags, strength).
export function useQuickCapture(onSaved: (message: string) => void) {
  const { t } = useI18n()
  const { addQuote } = useQuoteStore()
  const [text, setText] = useState('')
  const [tags, setTags] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>()
  const [imageMimeType, setImageMimeType] = useState<string | undefined>()
  const [audioDataUrl, setAudioDataUrl] = useState<string | undefined>()
  const [audioMimeType, setAudioMimeType] = useState<string | undefined>()
  const [audioDurationMs, setAudioDurationMs] = useState<number | undefined>()
  const [signalStrength, setSignalStrength] = useState<SignalStrength>('quiet')
  const canSave = Boolean(text.trim() || imageDataUrl || audioDataUrl)

  function setImage(image?: { dataUrl: string; mimeType: string }) {
    setImageDataUrl(image?.dataUrl)
    setImageMimeType(image?.mimeType)
  }

  function setAudio(audio?: { dataUrl: string; mimeType: string; durationMs?: number }) {
    setAudioDataUrl(audio?.dataUrl)
    setAudioMimeType(audio?.mimeType)
    setAudioDurationMs(audio?.durationMs)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    await addQuote({
      text: text.trim(),
      tags: splitList(tags),
      note: undefined,
      favorite: false,
      status: 'inbox',
      signalStrength,
      entryType: 'note',
      people: [],
      audioDataUrl,
      audioMimeType,
      audioDurationMs,
      imageDataUrl,
      imageMimeType
    })
    setText('')
    setTags('')
    setImage(undefined)
    setAudio(undefined)
    setSignalStrength('quiet')
    onSaved(t('noiseSaved'))
  }

  return {
    text,
    setText,
    tags,
    setTags,
    imageDataUrl,
    audioDataUrl,
    signalStrength,
    setSignalStrength,
    setImage,
    setAudio,
    canSave,
    submit
  }
}
