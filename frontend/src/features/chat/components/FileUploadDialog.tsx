import { useState, useRef, type DragEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import { X, Upload, FileText, Image as ImageIcon, Film, Music } from 'lucide-react'
import { toast } from 'sonner'
import styles from './FileUploadDialog.module.css'

interface Props {
  open: boolean
  onClose: () => void
  roomId: number | null
}

const MAX_SIZE = 50 * 1024 * 1024 // 50MB (matches backend)

function kindOf(mime: string): 'image' | 'video' | 'audio' | 'file' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'file'
}

export function FileUploadDialog({ open, onClose, roomId }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  const handleFile = (f: File) => {
    if (f.size > MAX_SIZE) { toast.error('File too large. Max 50MB.'); return }
    setFile(f)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleUpload = () => {
    if (!file || !roomId) return
    setUploading(true); setProgress(0)

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100)
        // The message arrives live via the WS broadcast — just close.
        setFile(null); setProgress(0); setUploading(false)
        onClose()
      } else {
        toast.error('Upload failed. Please try again.')
        setUploading(false)
      }
    })

    xhr.addEventListener('error', () => {
      toast.error('Upload failed. Please try again.')
      setUploading(false)
    })

    const formData = new FormData()
    formData.append('file', file)

    const token = localStorage.getItem('mathia-auth-token')
    xhr.open('POST', `/chatbot/api/rooms/${roomId}/attachments/upload/`)
    if (token) xhr.setRequestHeader('Authorization', `Token ${token}`)
    xhr.send(formData)
  }

  const handleCancel = () => {
    if (xhrRef.current) xhrRef.current.abort()
    setFile(null); setProgress(0); setUploading(false)
  }

  const PreviewIcon = file
    ? ({ image: ImageIcon, video: Film, audio: Music, file: FileText }[kindOf(file.type)])
    : FileText

  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) { handleCancel(); onClose() } }}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div className={styles.dialog} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.15 }}>
            <div className={styles.header}>
              <Dialog.Title className={styles.title}>Attach a file</Dialog.Title>
              <Dialog.Close asChild><button className={styles.closeBtn}><X size={16} /></button></Dialog.Close>
            </div>

            <div className={styles.restrictions}>Images, video, audio, or documents — up to 50MB</div>

            {!file ? (
              <div
                className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={32} className={styles.dropIcon} />
                <p className={styles.dropText}>Drop file here or click to browse</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.zip"
                  hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>
            ) : (
              <div className={styles.preview}>
                <div className={styles.fileInfo}>
                  <PreviewIcon size={24} />
                  <div>
                    <div className={styles.fileName}>{file.name}</div>
                    <div className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                  {!uploading && <button className={styles.removeBtn} onClick={handleCancel}><X size={14} /></button>}
                </div>
                {uploading ? (
                  <>
                    <div className={styles.progressBar}>
                      <motion.div className={styles.progressFill} animate={{ width: `${progress}%` }} transition={{ duration: 0.1 }} />
                    </div>
                    <button className={styles.uploadBtn} onClick={handleCancel} style={{ background: 'var(--text-muted)' }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className={styles.uploadBtn} onClick={handleUpload}>Send</button>
                )}
              </div>
            )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
