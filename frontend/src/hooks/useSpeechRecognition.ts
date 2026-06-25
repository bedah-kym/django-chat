import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionResult {
  transcript: string
  isFinal: boolean
}

interface UseSpeechRecognitionOptions {
  onResult?: (result: SpeechRecognitionResult) => void
  onEnd?: () => void
  onError?: (error: string) => void
}

interface UseSpeechRecognitionReturn {
  isSupported: boolean
  isListening: boolean
  start: () => void
  stop: () => void
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: {
    resultIndex: number
    results: {
      [index: number]: { isFinal: boolean; [index: number]: { transcript: string } }
      length: number
    }
  }) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

export function useSpeechRecognition({ onResult, onEnd, onError }: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!isSupported) return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result) continue
        if (result.isFinal) {
          finalTranscript += result[0]?.transcript ?? ''
        } else {
          interimTranscript += result[0]?.transcript ?? ''
        }
      }
      const transcript = finalTranscript + interimTranscript
      onResult?.({ transcript, isFinal: !!(finalTranscript && !interimTranscript) })
    }

    recognition.onend = () => {
      setIsListening(false)
      onEnd?.()
    }

    recognition.onerror = (event) => {
      setIsListening(false)
      onError?.(event?.error || 'unknown')
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isSupported, onResult, onEnd, onError])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  return { isSupported, isListening, start, stop }
}
