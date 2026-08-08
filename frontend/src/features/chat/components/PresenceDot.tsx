import * as Tooltip from '@radix-ui/react-tooltip'
import { humanizeLastSeen } from '@/utils/time'
import styles from './PresenceDot.module.css'

interface Props {
  isOnline: boolean
  lastSeen?: string
  size?: number
}

export function PresenceDot({ isOnline, lastSeen, size = 8 }: Props) {
  const label = isOnline ? 'Online' : lastSeen ? humanizeLastSeen(lastSeen) : 'Offline'

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            className={`${styles.dot} ${isOnline ? styles.online : styles.offline}`}
            style={{ width: size, height: size }}
          />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className={styles.tooltip} sideOffset={4}>
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
