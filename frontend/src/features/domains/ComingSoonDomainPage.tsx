import type { DomainId } from '@/types/domain'
import { domainConfigs, domainStatusCopy } from '@/domains'
import styles from './ComingSoonDomainPage.module.css'

interface Props {
  domainId: DomainId
}

export function ComingSoonDomainPage({ domainId }: Props) {
  const domain = domainConfigs[domainId]
  const Icon = domain.icon

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}><Icon size={22} /></div>
        <h2 className={styles.title}>{domain.label}</h2>
        <p className={styles.description}>{domain.description}</p>
        <p className={styles.note}>{domainStatusCopy[domainId]}</p>
      </div>
    </div>
  )
}
