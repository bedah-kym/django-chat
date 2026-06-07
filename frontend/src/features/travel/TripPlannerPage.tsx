import styles from './TravelPages.module.css'

export function TripPlannerPage() {
  return (
    <div className={styles.travel}>
      <h2 className={styles.pageTitle}>Plan a Trip</h2>
      <div className={styles.wizardCard}>
        <div className={styles.wizardStep}>
          <span className={styles.stepNumber}>1</span>
          <span className={styles.stepLabel}>Destination</span>
        </div>
        <div className={styles.formSection}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Where to?</span>
            <input className={styles.input} placeholder="e.g. Nairobi, Mombasa, Dar es Salaam" />
          </label>
          <div className={styles.dateRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>From</span>
              <input className={styles.input} type="date" defaultValue="2026-04-15" />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>To</span>
              <input className={styles.input} type="date" defaultValue="2026-04-18" />
            </label>
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Budget (KES)</span>
            <input className={styles.input} type="number" placeholder="50000" />
          </label>
        </div>
        <div className={styles.wizardActions}>
          <button className={styles.btnPrimary}>Search Options</button>
        </div>
      </div>
    </div>
  )
}
