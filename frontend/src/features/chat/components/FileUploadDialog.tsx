import { useState, useRef, type DragEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import { X, Upload, FileText, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import styles from './FileUploadDialog.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

const VALID_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image', 'image/jpg': 'image', 'image/png': 'image',
  'image/gif': 'image', 'image/webp': 'image',
}
const MAX_SIZES = { pdf: 10 * 1024 * 1024, image: 5 * 1024 * 1024 }

export function FileUploadDialog({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    if (!file) return
    setUploading(true); setProgress(0)
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 90) { clearInterval(interval); return p }
        return p + 10
      })
    }, 100)
    setTimeout(() => {
      clearInterval(interval); setProgress(100)
      setTimeout(() => {
        toast.success('Document uploaded! Mathia is indexing it now.')
        setFile(null); setProgress(0); setUploading(false); onClose()
      }, 400)
    }, 1200)
  }

  const reset = () => { setFile(null); setProgress(0); setUploading(false) }

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

            <div className={styles.quota}>Uploads remaining: <strong>3 / 5</strong></div>
            <div className={styles.restrictions}>Supported: PDFs (max 10MB) and Images (max 5MB)</div>

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
                  {!uploading && <button className={styles.removeBtn} onClick={reset}><X size={14} /></button>}
                </div>
                {uploading && (
                  <div className={styles.progressBar}>
                    <motion.div className={styles.progressFill} animate={{ width: `${progress}%` }} transition={{ duration: 0.1 }} />
                  </div>
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
