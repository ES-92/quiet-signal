import { Coffee, CreditCard, ExternalLink, HeartHandshake } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { Panel } from './Panel'

export function SupportSection() {
  const { t } = useI18n()

  return (
    <Panel title={t('supportProject')}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-paper text-clay">
          <HeartHandshake size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm leading-6 text-graphite">{t('supportProjectBody')}</p>
          <div className="mt-4 grid gap-2">
            <SupportLink href="https://ko-fi.com/esc92" label={t('supportProjectAction')} provider="Ko-fi" variant="primary" />
            <SupportLink href="https://paypal.me/ErikSchroeder92" label={t('supportProjectAction')} provider="PayPal" variant="secondary" />
          </div>
        </div>
      </div>
    </Panel>
  )
}

function SupportLink({
  href,
  label,
  provider,
  variant
}: {
  href: string
  label: string
  provider: string
  variant: 'primary' | 'secondary'
}) {
  const Icon = variant === 'primary' ? Coffee : CreditCard
  const primary = variant === 'primary'

  if (!primary) {
    return (
      <a
        className="inline-flex min-h-[46px] w-full items-center justify-between gap-3 rounded-md border border-line bg-paper/70 px-3 py-2 text-sm text-graphite transition duration-200 hover:border-ink/50 hover:bg-white/45 hover:text-ink"
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={`${label} via ${provider}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CreditCard className="shrink-0 text-clay" size={15} />
          <span className="truncate">{label}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded border border-current px-2 py-1 text-[11px] uppercase tracking-[0.14em]">
          {provider}
          <ExternalLink size={13} />
        </span>
      </a>
    )
  }

  return (
    <a
      className="group inline-flex min-h-[58px] w-full items-center gap-3 rounded-md border border-ink bg-ink px-3.5 py-3 text-left text-sm text-paper shadow-[0_16px_34px_rgba(31,30,28,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#171615] hover:shadow-[0_20px_42px_rgba(31,30,28,0.2)]"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} via ${provider}`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-paper/20 bg-paper/10 text-paper"
      >
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        <span className="mt-0.5 block text-[11px] uppercase tracking-[0.16em] text-paper/60">{provider}</span>
      </span>
      <ExternalLink className="text-paper/60 transition group-hover:text-paper" size={15} />
    </a>
  )
}
