import { useState, useEffect, useRef, type DragEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import { X, Upload, FileText, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { fetchUploadQuota, type UploadQuota } from '@/api/chat'
import styles from './FileUploadDialog.module.css'

interface Props {
  open: boolean
  onClose: () => void
  roomId: number | null
}

const VALID_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image', 'image/jpg': 'image', 'image/png': 'image',
  'image/gif': 'image', 'image/webp': 'image',
}
const MAX_SIZES = { pdf: 10 * 1024 * 1024, image: 5 * 1024 * 1024 }

export function FileUploadDialog({ open, onClose, roomId }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [quota, setQuota] = useState<UploadQuota | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  useEffect(() => {
    if (open && roomId) {
      setQuotaLoading(true)
      fetchUploadQuota(roomId)
        .then(setQuota)
        .catch(() => toast.error('Could not load upload quota'))
        .finally(() => setQuotaLoading(false))
    }
  }, [open, roomId])

  const validate = (f: File): boolean => {
    const category = VALID_TYPES[f.type]
    if (!category) { toast.error('Unsupported file type. Use PDF or images.'); return false }
    const max = MAX_SIZES[category as keyof typeof MAX_SIZES]!
    if (f.size > max) { toast.error(`File too large. Max ${max / 1024 / 1024}MB for ${category}s.`); return false }
    return true
  }

  const handleFile = (f: File) => {
    if (validate(f)) setFile(f)
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
      if (xhr.status === 429) {
        toast.error('Upload quota exceeded. Remove some documents first.')
        setUploading(false)
        return
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100)
        setTimeout(() => {
          toast.success('Document uploaded! Mathia is indexing it now.')
          setFile(null); setProgress(0); setUploading(false)
          if (quota) setQuota({ used: quota.used + 1, limit: quota.limit })
          onClose()
        }, 400)
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
    xhr.open('POST', `/chatbot/api/rooms/${roomId}/documents/upload/`)
    if (token) xhr.setRequestHeader('Authorization', `Token ${token}`)

    xhr.send(formData)
  }

  const handleCancel = () => {
    if (xhrRef.current) xhrRef.current.abort()
    setFile(null); setProgress(0); setUploading(false)
  }

  const reset = () => {
    if (xhrRef.current) xhrRef.current.abort()
    setFile(null); setProgress(0); setUploading(false)
  }

  const remaining = quota ? quota.limit - quota.used : 0

  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) { reset(); onClose() } }}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div className={styles.dialog} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.15 }}>
            <div className={styles.header}>
              <Dialog.Title className={styles.title}>Upload Document</Dialog.Title>
              <Dialog.Close asChild><button className={styles.closeBtn}><X size={16} /></button></Dialog.Close>
            </div>

            <div className={styles.quota}>
              {quotaLoading ? 'Loading quota…' : `Uploads remaining: ${remaining} / ${quota?.limit ?? 5}`}
            </div>
            <div className={styles.restrictions}>Supported: PDFs (max 10MB) and Images (max 5MB)</div>

            {remaining === 0 && quota ? (
              <div className={styles.dropzone} style={{ borderColor: 'var(--critical-color)', opacity: 0.7 }}>
                <p className={styles.dropText}>No uploads remaining. Remove documents to free up quota.</p>
              </div>
            ) : !file ? (
              <div
                className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={32} className={styles.dropIcon} />
                <p className={styles.dropText}>Drop file here or click to browse</p>
                <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
            ) : (
              <div className={styles.preview}>
                <div className={styles.fileInfo}>
                  {file.type === 'application/pdf' ? <FileText size={24} /> : <ImageIcon size={24} />}
                  <div>
                    <div className={styles.fileName}>{file.name}</div>
                    <div className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                  {!uploading && <button className={styles.removeBtn} onClick={handleCancel}><X size={14} /></button>}
                </div>
                {uploading && (
                  <>
                    <div className={styles.progressBar}>
                      <motion.div className={styles.progressFill} animate={{ width: `${progress}%` }} transition={{ duration: 0.1 }} />
                    </div>
                    <button className={styles.uploadBtn} onClick={handleCancel} style={{ background: 'var(--text-muted)' }}>
                      Cancel
                    </button>
                  </>
                )}
                {!uploading && (
                  <button className={styles.uploadBtn} onClick={handleUpload}>Upload</button>
                )}
              </div>
            )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
