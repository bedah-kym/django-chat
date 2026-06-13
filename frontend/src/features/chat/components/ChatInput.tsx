import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Paperclip, Mic, SendHorizontal, Smile } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { getChatSocket } from '@/api/chatSocket'
import { useAutoResize } from '@/hooks/useAutoResize'
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete'
import type { Participant } from '@/types/chat'
import type { QuickPromptAction } from '@/utils/quickPrompts'
import { ReplyBar } from './ReplyBar'
import { MentionDropdown } from './MentionDropdown'
import { QuickPromptsPanel } from './QuickPromptsPanel'
import { QuickPromptDialog } from './QuickPromptDialog'
import { FileUploadDialog } from './FileUploadDialog'
import { VoiceRecorder } from './VoiceRecorder'
import { EmojiPickerPopover } from './EmojiPickerPopover'
import styles from './ChatInput.module.css'

interface Props {
  roomId: number
  participants: Participant[]
}

export function ChatInput({ roomId, participants }: Props) {
  const [inputValue, setInputValue] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [promptAction, setPromptAction] = useState<QuickPromptAction | null>(null)
  const textareaRef = useAutoResize(inputValue)
  const replyingTo = useChatStore(s => s.replyingTo)
  const setReplyingTo = useChatStore(s => s.setReplyingTo)
  const sendMessage = useChatStore(s => s.sendMessage)

  const mention = useMentionAutocomplete(inputValue, participants)

  useEffect(() => {
    mention.update(inputValue)
  }, [inputValue, mention.update])

  // Quick prompts: show when input ends with @mathia (no text after)
  const showQuickPrompts = /(?:^|\s)@mathia\s*$/i.test(inputValue)

  // Throttle typing pings so we emit at most one every couple of seconds.
  const lastTypingRef = useRef(0)
  const emitTyping = () => {
    const now = Date.now()
    if (now - lastTypingRef.current > 2000) {
      lastTypingRef.current = now
      getChatSocket().sendTyping()
    }
  }

  const handleSend = () => {
    if (!inputValue.trim()) return
    sendMessage(roomId, inputValue.trim(), replyingTo?.id)
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mention.onKeyDown(e)) {
      if (e.key === 'Tab' || e.key === 'Enter') {
        const selected = mention.filtered[mention.selectedIndex]
        if (selected) {
          setInputValue(mention.select(selected))
          mention.close()
        }
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickPromptSelect = (action: QuickPromptAction) => {
    if (action.fields.length === 0) {
      // No form needed — send immediately
      const prompt = action.buildPrompt({})
      sendMessage(roomId, prompt)
      setInputValue('')
    } else {
      setPromptAction(action)
    }
  }

  const handlePromptSubmit = (prompt: string) => {
    sendMessage(roomId, prompt)
    setInputValue('')
  }

  if (isRecording) {
    return (
      <div className={styles.inputArea}>
        <AnimatePresence>
          <VoiceRecorder
            onStop={() => setIsRecording(false)}
            onCancel={() => setIsRecording(false)}
          />
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className={styles.inputArea}>
      {/* Reply bar */}
      <AnimatePresence>
        {replyingTo && (
          <ReplyBar message={replyingTo} onDismiss={() => setReplyingTo(null)} />
        )}
      </AnimatePresence>

      {/* Quick prompts panel */}
      <AnimatePresence>
        {showQuickPrompts && (
          <QuickPromptsPanel
            onSelect={handleQuickPromptSelect}
            onClose={() => setInputValue(inputValue.replace(/@mathia\s*$/i, ''))}
          />
        )}
      </AnimatePresence>

      {/* Quick prompt dialog */}
      {promptAction && (
        <QuickPromptDialog
          action={promptAction}
          open={!!promptAction}
          onClose={() => setPromptAction(null)}
          onSubmit={handlePromptSubmit}
        />
      )}

      {/* File upload dialog */}
      <FileUploadDialog open={showUpload} onClose={() => setShowUpload(false)} />

      {/* Input row */}
      <div className={styles.inputWrapper}>
        <AnimatePresence>
          {mention.isOpen && (
            <MentionDropdown
              participants={mention.filtered}
              selectedIndex={mention.selectedIndex}
              onSelect={(p) => {
                setInputValue(mention.select(p))
                mention.close()
              }}
            />
          )}
        </AnimatePresence>

        <div className={styles.inputRow}>
          <Tooltip.Provider delayDuration={300}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button className={styles.inputBtn} onClick={() => setShowUpload(true)}>
                  <Paperclip size={18} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal><Tooltip.Content className={styles.tooltip} sideOffset={6}>Attach file</Tooltip.Content></Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>

          <textarea
            ref={textareaRef}
            className={styles.textInput}
            placeholder="Type a message... (@mention to tag)"
            value={inputValue}
            rows={1}
            onChange={e => { setInputValue(e.target.value); emitTyping() }}
            onKeyDown={handleKeyDown}
          />

          <EmojiPickerPopover
            open={emojiOpen}
            onOpenChange={setEmojiOpen}
            onSelect={(emoji) => setInputValue(v => v + emoji)}
          >
            <button className={styles.inputBtn}><Smile size={18} /></button>
          </EmojiPickerPopover>

          <Tooltip.Provider delayDuration={300}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button className={styles.inputBtn} onClick={() => setIsRecording(true)}>
                  <Mic size={18} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal><Tooltip.Content className={styles.tooltip} sideOffset={6}>Voice message</Tooltip.Content></Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>

          <motion.button className={styles.sendBtn} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} onClick={handleSend}>
            <SendHorizontal size={18} />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
