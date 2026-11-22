import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

interface PanelProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  // Pass both to control the panel from outside (e.g. a notice that opens it).
  open?: boolean
  onOpenChange?: (open: boolean) => void
  id?: string
}

export function Panel({ title, children, defaultOpen = false, open: controlledOpen, onOpenChange, id }: PanelProps) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  const open = controlledOpen ?? ownOpen

  return (
    <details
      id={id}
      className="group min-w-0 border-t border-line py-5 md:rounded-md md:border md:bg-white/30 md:p-5 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
      open={open}
      onToggle={(event) => {
        setOwnOpen(event.currentTarget.open)
        onOpenChange?.(event.currentTarget.open)
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <h2 className="font-serif text-2xl leading-tight sm:text-[1.7rem]">{title}</h2>
        <ChevronDown className="shrink-0 text-graphite transition duration-200 group-open:rotate-180" size={18} />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}
