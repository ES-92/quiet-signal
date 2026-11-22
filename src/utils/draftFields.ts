export function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function clean(value?: string) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length ? trimmed : undefined
}

// Value for a datetime-local input. Never throws: unparsable dates and years outside 1-9999 (which would overflow
// toISOString after the time zone shift, or not fit the input format) give an empty field.
export function toLocalDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  const year = local.getUTCFullYear()
  if (Number.isNaN(local.getTime()) || year < 1 || year > 9999) return ''
  return local.toISOString().slice(0, 16)
}

export function fromLocalDateTime(value: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}
