export const onboardingKey = 'quiet-signal-onboarding-seen'
export const onboardingEventName = 'quiet-signal-open-onboarding'

export function openOnboarding() {
  localStorage.removeItem(onboardingKey)
  window.dispatchEvent(new Event(onboardingEventName))
}

export function markOnboardingSeen() {
  localStorage.setItem(onboardingKey, 'true')
}

export function shouldShowOnboarding() {
  return localStorage.getItem(onboardingKey) !== 'true'
}
