import { useState, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useUiStore } from '@/stores/uiStore'
import styles from './EmojiPickerPopover.module.css'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (emoji: string) => void
  children: React.ReactNode
}

export function EmojiPickerPopover({ open, onOpenChange, onSelect, children }: Props) {
  const theme = useUiStore(s => s.theme)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [PickerComponent, setPickerComponent] = useState<any>(null)
  const [emojiData, setEmojiData] = useState<unknown>(null)

  // Lazy-load emoji-mart only when picker opens for the first time
  useEffect(() => {
    if (!open || PickerComponent) return
    Promise.all([
      import('@emoji-mart/react'),
      import('@emoji-mart/data'),
    ]).then(([pickerMod, dataMod]) => {
      setPickerComponent(() => pickerMod.default)
      setEmojiData(dataMod.default)
    }).catch(() => {
      // emoji-mart failed to load — silently degrade
    })
  }, [open, PickerComponent])

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} align="end" className={styles.content}>
          {PickerComponent && emojiData ? (
            <PickerComponent
              data={emojiData}
              theme={theme}
              onEmojiSelect={(emoji: { native: string }) => {
                onSelect(emoji.native)
                onOpenChange(false)
              }}
              previewPosition="none"
              skinTonePosition="search"
              perLine={8}
            />
          ) : (
            <div className={styles.loading}>Loading emojis...</div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
