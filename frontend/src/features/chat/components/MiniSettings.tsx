import * as Popover from '@radix-ui/react-popover'
import { Settings2, Moon, Sun } from 'lucide-react'
import { motion } from 'framer-motion'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import styles from './MiniSettings.module.css'

export function MiniSettings() {
  const fontSize = useSettingsStore(s => s.fontSize)
  const setFontSize = useSettingsStore(s => s.setFontSize)
  const density = useSettingsStore(s => s.messageDensity)
  const setDensity = useSettingsStore(s => s.setMessageDensity)
  const theme = useUiStore(s => s.theme)
  const toggleTheme = useUiStore(s => s.toggleTheme)

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <motion.button className={styles.trigger} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Settings">
          <Settings2 size={16} />
        </motion.button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} align="start" asChild>
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div className={styles.title}>Chat Settings</div>

            {/* Theme */}
            <div className={styles.row}>
              <span className={styles.label}>Theme</span>
              <button className={styles.themeBtn} onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>

            {/* Font size */}
            <div className={styles.row}>
              <span className={styles.label}>Font Size</span>
              <div className={styles.sliderRow}>
                <input
                  type="range"
                  min={12}
                  max={20}
                  value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{fontSize}px</span>
              </div>
            </div>

            {/* Density */}
            <div className={styles.row}>
              <span className={styles.label}>Density</span>
              <div className={styles.densityBtns}>
                {(['compact', 'comfortable', 'spacious'] as const).map(d => (
                  <button
                    key={d}
                    className={`${styles.densityBtn} ${density === d ? styles.densityActive : ''}`}
                    onClick={() => setDensity(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <Popover.Arrow className={styles.arrow} />
          </motion.div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
