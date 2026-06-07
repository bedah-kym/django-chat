declare module '@emoji-mart/react' {
  import type { ComponentType } from 'react'
  interface PickerProps {
    data: unknown
    theme?: 'light' | 'dark' | 'auto'
    onEmojiSelect?: (emoji: { native: string; id: string }) => void
    previewPosition?: 'none' | 'top' | 'bottom'
    skinTonePosition?: 'search' | 'preview' | 'none'
    perLine?: number
  }
  const Picker: ComponentType<PickerProps>
  export default Picker
}

declare module '@emoji-mart/data' {
  const data: unknown
  export default data
}
