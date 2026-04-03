import { useState, useCallback } from 'react'
import type { Participant } from '@/types/chat'

interface MentionState {
  isOpen: boolean
  filtered: Participant[]
  selectedIndex: number
  triggerStart: number // position of @ in input
}

export function useMentionAutocomplete(
  inputValue: string,
  participants: Participant[],
) {
  const [state, setState] = useState<MentionState>({
    isOpen: false,
    filtered: [],
    selectedIndex: 0,
    triggerStart: -1,
  })

  const update = useCallback((value: string) => {
    // Find the last @ that isn't already completed (no space after username)
    const lastAt = value.lastIndexOf('@')
    if (lastAt === -1) {
      setState(s => ({ ...s, isOpen: false }))
      return
    }

    const afterAt = value.slice(lastAt + 1)
    // If there's a space, the mention is complete
    if (afterAt.includes(' ')) {
      setState(s => ({ ...s, isOpen: false }))
      return
    }

    const query = afterAt.toLowerCase()
    const filtered = participants.filter(
      p => p.username.toLowerCase().startsWith(query) ||
           p.displayName.toLowerCase().startsWith(query)
    )

    setState({
      isOpen: filtered.length > 0,
      filtered,
      selectedIndex: 0,
      triggerStart: lastAt,
    })
  }, [participants])

  const select = useCallback((participant: Participant): string => {
    const before = inputValue.slice(0, state.triggerStart)
    return `${before}@${participant.username} `
  }, [inputValue, state.triggerStart])

  const onKeyDown = useCallback((e: React.KeyboardEvent): boolean => {
    if (!state.isOpen) return false

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setState(s => ({ ...s, selectedIndex: (s.selectedIndex + 1) % s.filtered.length }))
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setState(s => ({ ...s, selectedIndex: s.selectedIndex <= 0 ? s.filtered.length - 1 : s.selectedIndex - 1 }))
      return true
    }
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      return true // caller should call select() with filtered[selectedIndex]
    }
    if (e.key === 'Escape') {
      setState(s => ({ ...s, isOpen: false }))
      return true
    }
    return false
  }, [state.isOpen, state.filtered.length])

  return {
    isOpen: state.isOpen,
    filtered: state.filtered,
    selectedIndex: state.selectedIndex,
    update,
    select,
    onKeyDown,
    close: () => setState(s => ({ ...s, isOpen: false })),
  }
}
