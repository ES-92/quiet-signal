export const coachKey = 'quiet-signal-coach-seen'

export function shouldShowCoachmark() {
  return localStorage.getItem(coachKey) !== 'true'
}

export function markCoachmarkSeen() {
  localStorage.setItem(coachKey, 'true')
}

export function clearCoachmarkSeen() {
  localStorage.removeItem(coachKey)
}
