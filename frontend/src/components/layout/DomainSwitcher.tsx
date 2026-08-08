import { Link } from 'react-router-dom'
import { domainConfigs, domainOrder } from '@/domains'
import type { DomainId } from '@/types/domain'
import styles from './DomainSwitcher.module.css'

interface Props {
  activeDomainId?: DomainId | null
}

export function DomainSwitcher({ activeDomainId = null }: Props) {
  return (
    <div className={styles.switcher}>
      {domainOrder.map((domainId) => {
        const domain = domainConfigs[domainId]
        const Icon = domain.icon

        return (
          <Link
            key={domainId}
            to={domain.defaultRoute}
            className={`${styles.item} ${activeDomainId === domainId ? styles.active : ''}`}
          >
            <Icon size={14} />
            <span>{domain.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
