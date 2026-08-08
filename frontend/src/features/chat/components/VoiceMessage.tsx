import { useEffect, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import styles from './VoiceMessage.module.css'

interface Props {
  audioUrl: string
  transcript?: string
}

export function VoiceMessage({ audioUrl, transcript }: Props) {
  const waveformRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wavesurferRef = useRef<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState('0:00')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!waveformRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ws: any = null

    import('wavesurfer.js').then(({ default: WaveSurfer }) => {
      if (!waveformRef.current) return
      ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#667eea',
        progressColor: '#5a3a82',
        barWidth: 2,
        barRadius: 3,
        height: 28,
        cursorWidth: 0,
        url: audioUrl,
      })

      ws.on('ready', () => {
        setReady(true)
        const dur: number = ws.getDuration() ?? 0
        const m = Math.floor(dur / 60)
        const s = Math.floor(dur % 60)
        setDuration(`${m}:${s.toString().padStart(2, '0')}`)
      })
      ws.on('play', () => setIsPlaying(true))
      ws.on('pause', () => setIsPlaying(false))
      ws.on('finish', () => setIsPlaying(false))
      wavesurferRef.current = ws
    })

    return () => { ws?.destroy() }
  }, [audioUrl])

  const toggle = () => {
    if (!wavesurferRef.current || !ready) return
    if (isPlaying) wavesurferRef.current.pause()
    else wavesurferRef.current.play()
  }

  return (
    <div className={styles.voice}>
      <button className={styles.playBtn} onClick={toggle}>
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className={styles.waveform} ref={waveformRef} />
      <span className={styles.duration}>{duration}</span>
      {transcript && (
        <div className={styles.transcript}>{transcript}</div>
      )}
    </div>
  )
}
