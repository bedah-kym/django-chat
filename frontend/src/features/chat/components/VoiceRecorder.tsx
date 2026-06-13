import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Square, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatDuration } from '@/utils/time'
import styles from './VoiceRecorder.module.css'

interface Props {
  onStop: (audioBlob: Blob) => void
  onCancel: () => void
}

export function VoiceRecorder({ onStop, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [duration, setDuration] = useState(0)

  const cleanup = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    // Guard against a double-stop (handleStop + unmount) which throws InvalidStateError.
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  useEffect(() => {
    let audioCtx: AudioContext | null = null

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' })
        const recorder = mediaRecorderRef.current
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          chunksRef.current = []
          onStop(blob)
        }
        recorder.start()

        audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        analyserRef.current = analyser

        drawWaveform(analyser)
      } catch {
        toast.error('Microphone access denied')
        onCancel()
      }
    }

    const drawWaveform = (analyser: AnalyserNode) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw)
        analyser.getByteTimeDomainData(dataArray)

        const w = canvas.width
        const h = canvas.height
        ctx.clearRect(0, 0, w, h)
        ctx.lineWidth = 2
        ctx.strokeStyle = '#667eea'
        ctx.beginPath()

        const sliceWidth = w / dataArray.length
        let x = 0
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] ?? 128) / 128.0
          const y = (v * h) / 2
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          x += sliceWidth
        }
        ctx.lineTo(w, h / 2)
        ctx.stroke()
      }
      draw()
    }

    start()
    return () => {
      cleanup()
      audioCtx?.close()
    }
  }, [onCancel, cleanup])

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const handleStop = () => {
    // cleanup() stops the recorder, whose onstop handler builds the blob and
    // calls onStop(blob). Don't call onStop here — it would fire a second time
    // with no audio.
    cleanup()
    toast.success('Voice message recorded')
  }

  return (
    <motion.div
      className={styles.recorder}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
    >
      <div className={styles.indicator}>
        <span className={styles.redDot} />
        <span className={styles.timer}>{formatDuration(duration)}</span>
      </div>
      <canvas ref={canvasRef} className={styles.waveform} width={300} height={40} />
      <div className={styles.controls}>
        <button className={styles.cancelBtn} onClick={() => { cleanup(); onCancel() }}>
          <X size={18} />
        </button>
        <button className={styles.stopBtn} onClick={handleStop}>
          <Square size={16} fill="currentColor" />
        </button>
      </div>
    </motion.div>
  )
}
