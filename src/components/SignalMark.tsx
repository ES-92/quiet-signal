export function SignalMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="currentColor" opacity="0.1" />
      <path
        d="M15 32c4.6-7.2 10.3-10.8 17-10.8S44.4 24.8 49 32c-4.6 7.2-10.3 10.8-17 10.8S19.6 39.2 15 32Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M23 32c2.5-3.7 5.5-5.6 9-5.6s6.5 1.9 9 5.6c-2.5 3.7-5.5 5.6-9 5.6s-6.5-1.9-9-5.6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle cx="32" cy="32" r="3.8" fill="currentColor" />
      <circle cx="18" cy="16" r="1.6" fill="currentColor" opacity="0.34" />
      <circle cx="48" cy="18" r="1.2" fill="currentColor" opacity="0.28" />
      <circle cx="14" cy="47" r="1.1" fill="currentColor" opacity="0.28" />
      <circle cx="51" cy="45" r="1.5" fill="currentColor" opacity="0.34" />
    </svg>
  )
}
