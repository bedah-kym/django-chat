import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FileText, Download, X, Sparkles, Check } from 'lucide-react'
import { VoiceMessage } from './VoiceMessage'
import type { Attachment } from '@/types/chat'
import styles from './MessageAttachments.module.css'

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function ext(name: string): string {
  const e = name.split('.').pop() || ''
  return e.length <= 4 ? e.toUpperCase() : 'FILE'
}

/** Subtle "Mathia is reading this…" hint that settles to "read" once she's
 *  had a moment to ingest the document (processing completes in seconds). */
function AiReadingHint() {
  const [done, setDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 5000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className={`${styles.aiHint} ${done ? styles.aiHintDone : ''}`}>
      {done ? <Check size={11} /> : <Sparkles size={11} className={styles.aiSparkle} />}
      <span>{done ? 'Mathia read this' : 'Mathia is reading this…'}</span>
    </div>
  )
}

export function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  if (!attachments.length) return null

  return (
    <div className={styles.list}>
      {attachments.map((a) => {
        if (a.type === 'image') {
          return (
            <div key={a.id} className={styles.block}>
              <button type="button" className={styles.imageWrap} onClick={() => setLightbox(a.url)}>
                <img src={a.url} alt={a.name} className={styles.image} loading="lazy" />
              </button>
              {a.aiReadable ? <AiReadingHint /> : null}
            </div>
          )
        }
        if (a.type === 'video') {
          return <video key={a.id} src={a.url} controls preload="metadata" className={styles.video} />
        }
        if (a.type === 'audio') {
          return <VoiceMessage key={a.id} audioUrl={a.url} />
        }
        const isPdf = a.mime === 'application/pdf' || a.name.toLowerCase().endsWith('.pdf')
        return (
          <div key={a.id} className={styles.block}>
            <a href={a.url} target="_blank" rel="noreferrer" download className={styles.fileCard}>
              <span className={`${styles.fileIcon} ${isPdf ? styles.filePdf : ''}`}>
                <FileText size={20} />
                <span className={styles.fileExt}>{ext(a.name)}</span>
              </span>
              <span className={styles.fileMeta}>
                <span className={styles.fileName}>{a.name}</span>
                <span className={styles.fileSize}>{humanSize(a.size)}</span>
              </span>
              <Download size={16} className={styles.fileDownload} />
            </a>
            {a.aiReadable ? <AiReadingHint /> : null}
          </div>
        )
      })}

      {createPortal(
        <AnimatePresence>
          {lightbox ? (
            <motion.div
              className={styles.lightbox}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setLightbox(null)}
            >
              <button className={styles.lightboxClose} onClick={() => setLightbox(null)} aria-label="Close">
                <X size={22} />
              </button>
              <motion.img
                src={lightbox}
                alt=""
                className={styles.lightboxImg}
                initial={{ scale: 0.92 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.92 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
