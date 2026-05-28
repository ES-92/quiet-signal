export function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-graphite">{label}</span>
      <input className="rounded-md border border-line bg-white/50 px-3 py-3" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
