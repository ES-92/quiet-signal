import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export function Panel({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      className="group min-w-0 border-t border-line py-5 md:rounded-md md:border md:bg-white/30 md:p-5 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <h2 className="font-serif text-2xl leading-tight sm:text-[1.7rem]">{title}</h2>
        <ChevronDown className="shrink-0 text-graphite transition duration-200 group-open:rotate-180" size={18} />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}
