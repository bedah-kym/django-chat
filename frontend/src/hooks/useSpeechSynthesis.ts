import { useRef, useCallback } from 'react'

interface UseSpeechSynthesisReturn {
  isSupported: boolean
  speak: (text: string) => void
  stop: () => void
  isSpeaking: () => boolean
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const synthRef = useRef<SpeechSynthesis | null>(null)

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const speak = useCallback((text: string) => {
    if (!isSupported) return
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    synth.speak(utterance)
    synthRef.current = synth
  }, [isSupported])

  const stop = useCallback(() => {
    if (!isSupported) return
    window.speechSynthesis.cancel()
  }, [isSupported])

  const isSpeaking = useCallback(() => {
    return isSupported && window.speechSynthesis.speaking
  }, [isSupported])

  return { isSupported, speak, stop, isSpeaking }
}
