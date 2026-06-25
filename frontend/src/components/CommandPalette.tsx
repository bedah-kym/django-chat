import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, CornerDownLeft } from 'lucide-react'
import { sidebarSections, personalNavItems, getRoomPath } from '@/domains'
import { useChatStore } from '@/stores/chatStore'
import styles from './CommandPalette.module.css'

interface CommandItem {
  id: string
  label: string
  hint?: string
  group: string
  to: string
}

export function CommandPalette() {
  const navigate = useNavigate()
  const rooms = useChatStore((s) => s.rooms)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Open/close on Cmd+K / Ctrl+K, close on Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')
      if (isToggle) {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (open && e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Reset state when reopening, autofocus the input
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    // Defer so the input has mounted
    queueMicrotask(() => inputRef.current?.focus())
  }, [open])

  // Build the unified command list
  const allItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = []
    for (const section of sidebarSections) {
      for (const it of section.items) {
        items.push({
          id: `nav:${it.path}`,
          label: it.label,
          hint: section.label || 'Navigate',
          group: section.label || 'Navigate',
          to: it.path,
        })
      }
    }
    for (const it of personalNavItems) {
      items.push({ id: `pers:${it.path}`, label: it.label, hint: 'Personal', group: 'Personal', to: it.path })
    }
    for (const room of rooms) {
      items.push({
        id: `room:${room.id}`,
        label: room.displayName,
        hint: room.isAiRoom ? 'AI room' : room.domain,
        group: 'Rooms',
        to: getRoomPath(room),
      })
    }
    return items
  }, [rooms])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return allItems
    return allItems.filter(
      (it) => it.label.toLowerCase().includes(q) || it.hint?.toLowerCase().includes(q),
    )
  }, [allItems, q])

  // Group by group name preserving filtered order
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    for (const it of filtered) {
      const list = map.get(it.group) || []
      list.push(it)
      map.set(it.group, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  const safeIndex = filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1)

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      const item = filtered[safeIndex]
      if (item) {
        navigate(item.to)
        setOpen(false)
      }
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className={styles.palette}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Command palette"
          >
            <div className={styles.searchRow}>
              <Search size={16} className={styles.searchIcon} />
              <input
                ref={inputRef}
                className={styles.searchInput}
                placeholder="Jump to a room, workspace, or setting…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
                onKeyDown={onKey}
              />
              <span className={styles.shortcutHint}>esc</span>
            </div>

            <div className={styles.results}>
              {filtered.length === 0 ? (
                <div className={styles.empty}>No matches</div>
              ) : (
                grouped.map(([groupName, items]) => (
                  <div key={groupName} className={styles.group}>
                    <div className={styles.groupLabel}>{groupName}</div>
                    {items.map((item) => {
                      const flatIndex = filtered.indexOf(item)
                      const isActive = flatIndex === safeIndex
                      return (
                        <button
                          key={item.id}
                          className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onClick={() => { navigate(item.to); setOpen(false) }}
                        >
                          <span className={styles.itemLabel}>{item.label}</span>
                          <span className={styles.itemHint}>{item.hint}</span>
                          {isActive && <CornerDownLeft size={13} className={styles.enterIcon} />}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            <div className={styles.footer}>
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>esc</kbd> close</span>
              <span className={styles.openShortcut}><kbd>⌘</kbd><kbd>K</kbd> to summon</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
