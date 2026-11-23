import { clearCoachmarkSeen } from './coach'

export const onboardingKey = 'quiet-signal-onboarding-seen'
export const onboardingEventName = 'quiet-signal-open-onboarding'

export function openOnboarding() {
  localStorage.removeItem(onboardingKey)
  clearCoachmarkSeen()
  window.dispatchEvent(new Event(onboardingEventName))
}

export function markOnboardingSeen() {
  localStorage.setItem(onboardingKey, 'true')
}

export function shouldShowOnboarding() {
  return localStorage.getItem(onboardingKey) !== 'true'
}

// Whether the onboarding sheet is on screen right now, so other overlays (install prompt) can stay out of its way.
const openStateEventName = 'quiet-signal-onboarding-open-state'
let onboardingOpen = false

export function setOnboardingOpen(value: boolean) {
  if (onboardingOpen === value) return
  onboardingOpen = value
  window.dispatchEvent(new Event(openStateEventName))
}

/** True while the onboarding is showing or still waiting to be shown. */
export function isOnboardingActive() {
  return onboardingOpen || shouldShowOnboarding()
}

export function subscribeOnboardingActive(listener: () => void) {
  window.addEventListener(openStateEventName, listener)
  return () => window.removeEventListener(openStateEventName, listener)
}
