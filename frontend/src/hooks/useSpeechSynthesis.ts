import { useCallback, useEffect, useState } from 'react'

interface UseSpeechSynthesisReturn {
  isSupported: boolean
  speak: (text: string) => void
  stop: () => void
  /** Reactive — true while an utterance from this hook is playing. */
  speaking: boolean
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [speaking, setSpeaking] = useState(false)
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const speak = useCallback((text: string) => {
    if (!isSupported || !text) return
    const synth = window.speechSynthesis
    synth.cancel() // stop anything already playing
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    synth.speak(utterance)
  }, [isSupported])

  const stop = useCallback(() => {
    if (!isSupported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [isSupported])

  // Cancel any in-flight speech if the component unmounts.
  useEffect(() => {
    return () => { if (isSupported) window.speechSynthesis.cancel() }
  }, [isSupported])

  return { isSupported, speak, stop, speaking }
}
