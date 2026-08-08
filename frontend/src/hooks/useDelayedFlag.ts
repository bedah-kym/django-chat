import { useEffect, useRef, useState } from 'react'

export function useDelayedFlag(active: boolean, delayMs = 350): boolean {
  const [flag, setFlag] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (active) {
      if (!flag) {
        timerRef.current = setTimeout(() => setFlag(true), delayMs)
      }
    } else {
      setFlag(false)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = undefined
      }
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = undefined
      }
    }
  }, [active, delayMs, flag])

  return flag
}
