import { FileText, Download } from 'lucide-react'
import { VoiceMessage } from './VoiceMessage'
import type { Attachment } from '@/types/chat'
import styles from './MessageAttachments.module.css'

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null
  return (
    <div className={styles.list}>
      {attachments.map((a) => {
        if (a.type === 'image') {
          return (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className={styles.imageWrap}>
              <img src={a.url} alt={a.name} className={styles.image} loading="lazy" />
            </a>
          )
        }
        if (a.type === 'video') {
          return (
            <video key={a.id} src={a.url} controls preload="metadata" className={styles.video} />
          )
        }
        if (a.type === 'audio') {
          return <VoiceMessage key={a.id} audioUrl={a.url} />
        }
        return (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" download className={styles.fileCard}>
            <span className={styles.fileIcon}><FileText size={18} /></span>
            <span className={styles.fileMeta}>
              <span className={styles.fileName}>{a.name}</span>
              <span className={styles.fileSize}>{humanSize(a.size)}</span>
            </span>
            <Download size={15} className={styles.fileDownload} />
          </a>
        )
      })}
    </div>
  )
}
