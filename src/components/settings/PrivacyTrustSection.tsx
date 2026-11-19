import { DatabaseBackup, FileText, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { Panel } from './Panel'

export function PrivacyTrustSection() {
  const { t } = useI18n()

  return (
    <Panel title={t('privacyTrust')} defaultOpen>
      <p className="text-sm leading-6 text-graphite">{t('privacyTrustBody')}</p>
      <div className="mt-4 grid gap-2">
        <TrustPoint icon={<ShieldCheck size={16} />} title={t('privacyLocalTitle')} body={t('privacyLocalBody')} />
        <TrustPoint icon={<FileText size={16} />} title={t('privacyNoTrackingTitle')} body={t('privacyNoTrackingBody')} />
        <TrustPoint icon={<DatabaseBackup size={16} />} title={t('privacyPortableTitle')} body={t('privacyPortableBody')} />
      </div>
    </Panel>
  )
}

function TrustPoint({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-line bg-paper/60 p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-clay">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-1 text-sm leading-6 text-graphite">{body}</p>
      </div>
    </div>
  )
}
