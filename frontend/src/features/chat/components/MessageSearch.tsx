import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronUp, ChevronDown, Search, SlidersHorizontal } from 'lucide-react'
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

  const [showFilters, setShowFilters] = useState(false)
  const debouncedQuery = useDebounce(searchQuery, 250)
  const hasDateFilter = Boolean(searchDateFrom || searchDateTo)
  const hasResults = searchResults.length > 0
  const noMatches = debouncedQuery.trim().length > 0 && !hasResults

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Apply debounced search
  useEffect(() => {
    setSearchQuery(debouncedQuery)
  }, [debouncedQuery, setSearchQuery])

  const goNext = () => {
    if (!hasResults) return
    setSearchActiveIndex((searchActiveIndex + 1) % searchResults.length)
  }

  const goPrev = () => {
    if (!hasResults) return
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
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
    >
      <div className={styles.row}>
        <Search size={16} className={styles.icon} />
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Search this conversation…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {hasResults && (
          <span className={styles.count}>
            {searchActiveIndex + 1}<span className={styles.countSep}>/</span>{searchResults.length}
          </span>
        )}
        {noMatches && <span className={styles.noMatch}>No matches</span>}

        <div className={styles.navBtns}>
          <button className={styles.navBtn} onClick={goPrev} disabled={!hasResults} aria-label="Previous match" title="Previous (Shift+Enter)">
            <ChevronUp size={16} />
          </button>
          <button className={styles.navBtn} onClick={goNext} disabled={!hasResults} aria-label="Next match" title="Next (Enter)">
            <ChevronDown size={16} />
          </button>
        </div>

        <span className={styles.divider} />

        <button
          className={`${styles.iconBtn} ${showFilters || hasDateFilter ? styles.iconBtnActive : ''}`}
          onClick={() => setShowFilters(v => !v)}
          aria-label="Date filters"
          title="Filter by date"
        >
          <SlidersHorizontal size={15} />
          {hasDateFilter && <span className={styles.filterDot} />}
        </button>
        <button className={styles.iconBtn} onClick={() => { clearSearch(); onClose() }} aria-label="Close search" title="Close (Esc)">
          <X size={16} />
        </button>
      </div>

      {showFilters && (
        <motion.div
          className={styles.filters}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.15 }}
        >
          <label className={styles.dateLabel}>
            <span>From</span>
            <input
              type="date"
              className={styles.dateInput}
              value={searchDateFrom ?? ''}
              onChange={e => setSearchDateRange(e.target.value || null, searchDateTo)}
            />
          </label>
          <label className={styles.dateLabel}>
            <span>To</span>
            <input
              type="date"
              className={styles.dateInput}
              value={searchDateTo ?? ''}
              onChange={e => setSearchDateRange(searchDateFrom, e.target.value || null)}
            />
          </label>
          {hasDateFilter && (
            <button className={styles.clearBtn} onClick={() => setSearchDateRange(null, null)}>
              Clear dates
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
