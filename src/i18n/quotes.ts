import type { LanguageCode } from './translations'

const marks: Record<LanguageCode, [string, string]> = {
  de: ['„', '“'],
  en: ['“', '”'],
  es: ['«', '»'],
  fr: ['« ', ' »']
}

/** Wraps a quotation in the language's typographic quotes; an own note without author stays unquoted. */
export function quoted(text: string, author: string | undefined, language: LanguageCode): string {
  if (!author?.trim()) return text
  const [open, close] = marks[language]
  return `${open}${text}${close}`
}
