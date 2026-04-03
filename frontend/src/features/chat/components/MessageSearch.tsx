import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { useDebounce } from '@/hooks/useDebounce'
import styles from './MessageSearch.module.css'

interface Props {
  onClose: () => void
}

export function MessageSearch({ onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const searchQuery = useChatStore(s => s.searchQuery)
  const setSearchQuery = useChatStore(s => s.setSearchQuery)
  const searchDateFrom = useChatStore(s => s.searchDateFrom)
  const searchDateTo = useChatStore(s => s.searchDateTo)
  const setSearchDateRange = useChatStore(s => s.setSearchDateRange)
  const searchResults = useChatStore(s => s.searchResults)
  const searchActiveIndex = useChatStore(s => s.searchActiveIndex)
  const setSearchActiveIndex = useChatStore(s => s.setSearchActiveIndex)
  const clearSearch = useChatStore(s => s.clearSearch)

  const debouncedQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Apply debounced search
  useEffect(() => {
    setSearchQuery(debouncedQuery)
  }, [debouncedQuery, setSearchQuery])

  const goNext = () => {
    if (searchResults.length === 0) return
    setSearchActiveIndex((searchActiveIndex + 1) % searchResults.length)
  }

  const goPrev = () => {
    if (searchResults.length === 0) return
    setSearchActiveIndex(searchActiveIndex <= 0 ? searchResults.length - 1 : searchActiveIndex - 1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { clearSearch(); onClose() }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); goNext() }
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); goPrev() }
  }

  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
    >
      <div className={styles.row}>
        <Search size={15} className={styles.icon} />
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Search messages..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {searchResults.length > 0 && (
          <span className={styles.count}>
            {searchActiveIndex + 1} / {searchResults.length}
          </span>
        )}
        <div className={styles.navBtns}>
          <button className={styles.navBtn} onClick={goPrev} disabled={searchResults.length === 0}>
            <ChevronUp size={16} />
          </button>
          <button className={styles.navBtn} onClick={goNext} disabled={searchResults.length === 0}>
            <ChevronDown size={16} />
          </button>
        </div>
        <button className={styles.closeBtn} onClick={() => { clearSearch(); onClose() }}>
          <X size={16} />
        </button>
      </div>
      <div className={styles.filters}>
        <label className={styles.dateLabel}>
          From
          <input
            type="date"
            className={styles.dateInput}
            value={searchDateFrom ?? ''}
            onChange={e => setSearchDateRange(e.target.value || null, searchDateTo)}
          />
        </label>
        <label className={styles.dateLabel}>
          To
          <input
            type="date"
            className={styles.dateInput}
            value={searchDateTo ?? ''}
            onChange={e => setSearchDateRange(searchDateFrom, e.target.value || null)}
          />
        </label>
        {(searchDateFrom || searchDateTo) && (
          <button className={styles.clearBtn} onClick={() => setSearchDateRange(null, null)}>
            Clear dates
          </button>
        )}
      </div>
    </motion.div>
  )
}
