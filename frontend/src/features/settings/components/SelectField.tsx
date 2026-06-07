import styles from './SelectField.module.css'

interface Option {
  value: string
  label: string
}

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
}

export function SelectField({ label, value, onChange, options }: Props) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <select
        className={styles.select}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
