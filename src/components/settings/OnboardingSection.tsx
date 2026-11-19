import { RotateCcw } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { openOnboarding } from '../../services/onboarding'
import { Panel } from './Panel'

export function OnboardingSection() {
  const { t } = useI18n()

  return (
    <Panel title={t('onboardingSettings')}>
      <p className="text-sm leading-6 text-graphite">{t('onboardingSettingsHelp')}</p>
      <button className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={openOnboarding}>
        <RotateCcw size={16} /> {t('restartOnboarding')}
      </button>
    </Panel>
  )
}
