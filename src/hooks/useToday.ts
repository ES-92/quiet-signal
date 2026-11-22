import { useEffect, useState } from 'react'

// The current moment, refreshed shortly after each local midnight, so day/week/month views roll over while the page is open.
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date())

  useEffect(() => {
    const nextMidnight = new Date(today)
    nextMidnight.setHours(24, 0, 0, 0)
    const timer = window.setTimeout(() => setToday(new Date()), Math.max(0, nextMidnight.getTime() - Date.now()) + 1000)
    return () => window.clearTimeout(timer)
  }, [today])

  return today
}
