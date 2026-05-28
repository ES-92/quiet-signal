export function SignalMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="currentColor" opacity="0.1" />
      <circle cx="32" cy="32" r="12" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.75" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.4" />
      <circle cx="32" cy="32" r="5" fill="currentColor" />
      <circle cx="15" cy="14" r="1.4" fill="currentColor" opacity="0.3" />
      <circle cx="50" cy="49" r="1.4" fill="currentColor" opacity="0.3" />
    </svg>
  )
}
