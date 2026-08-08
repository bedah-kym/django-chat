import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { uploadAvatar } from '../settingsApi'
import styles from './AvatarUpload.module.css'

interface Props {
  displayName: string
  avatarUrl?: string
  onUploaded: (url: string) => void
}

export function AvatarUpload({ displayName, avatarUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function confirm() {
    if (!selectedFile) return
    setUploading(true)
    try {
      const { url } = await uploadAvatar(selectedFile)
      onUploaded(url)
      setPreview(null)
      setSelectedFile(null)
      toast.success('Avatar updated')
    } catch {
      toast.error('Upload failed — please try again')
    } finally {
      setUploading(false)
    }
  }

  function cancel() {
    setPreview(null)
    setSelectedFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const rawSrc = preview ?? avatarUrl
  // Only render safe image URL schemes (blob: from createObjectURL, data:image,
  // http(s), or relative) so a tainted URL can't smuggle a javascript: scheme.
  const src = rawSrc && /^(blob:|data:image\/|https?:|\/)/i.test(rawSrc) ? rawSrc : undefined

  return (
    <div className={styles.wrap}>
      <div className={styles.avatar}>
        {src ? (
          <img src={src} alt={displayName} className={styles.img} />
        ) : (
          <span className={styles.initials}>{initials}</span>
        )}
      </div>
      <div className={styles.actions}>
        {preview ? (
          <>
            <button
              className={styles.btnPrimary}
              onClick={confirm}
              disabled={uploading}
              type="button"
            >
              {uploading ? 'Uploading…' : 'Save photo'}
            </button>
            <button className={styles.btnOutline} onClick={cancel} type="button">
              Cancel
            </button>
          </>
        ) : (
          <button
            className={styles.btnOutline}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            Change Avatar
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className={styles.fileInput}
          onChange={onFileChange}
        />
      </div>
    </div>
  )
}
