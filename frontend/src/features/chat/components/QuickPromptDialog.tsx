import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { QuickPromptAction } from '@/utils/quickPrompts'
import styles from './QuickPromptDialog.module.css'

interface Props {
  action: QuickPromptAction
  open: boolean
  onClose: () => void
  onSubmit: (prompt: string) => void
}

export function QuickPromptDialog({ action, open, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const Icon = action.icon

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const prompt = action.buildPrompt(values)
    onSubmit(prompt)
    setValues({})
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            className={styles.dialog}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.header}>
              <div className={styles.headerTitle}>
                <Icon size={18} />
                <Dialog.Title className={styles.title}>{action.label}</Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button className={styles.closeBtn}><X size={16} /></button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              {action.fields.map(field => (
                <label key={field.name} className={styles.field}>
                  <span className={styles.label}>
                    {field.label} {field.required && <span className={styles.required}>*</span>}
                  </span>
                  {field.type === 'textarea' ? (
                    <textarea
                      className={styles.textarea}
                      rows={3}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className={styles.input}
                      required={field.required}
                      value={values[field.name] ?? field.options?.[0] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                    >
                      {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      className={styles.input}
                      type={field.type}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
              <div className={styles.actions}>
                <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                <button type="submit" className={styles.submitBtn}>Run</button>
              </div>
            </form>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
