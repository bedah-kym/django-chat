import type { ReactNode, CSSProperties } from 'react'
import { isHighThreatTag } from '../utils'
import s from './primitives.module.css'

/* ---------------- SectionLabel ---------------- */
export function SectionLabel({
  children,
  accent,
  style,
}: {
  children: ReactNode
  accent?: boolean
  style?: CSSProperties
}) {
  return (
    <div className={`${s.label} ${accent ? s.labelAccent : ''}`} style={style}>
      {children}
    </div>
  )
}

/* ---------------- Panel (corner-bracket reticle) ---------------- */
export function Panel({
  children,
  reticle = false,
  variant = 'panel',
  className = '',
  style,
  ...rest
}: {
  children: ReactNode
  reticle?: boolean
  variant?: 'panel' | 'inset' | 'raised'
  className?: string
  style?: CSSProperties
} & React.HTMLAttributes<HTMLDivElement>) {
  const variantClass = variant === 'inset' ? s.panelInset : variant === 'raised' ? s.panelRaised : ''
  return (
    <div className={`${s.panel} ${variantClass} ${className}`} style={style} {...rest}>
      {reticle && (
        <>
          <span className={`${s.corner} ${s.cornerTL}`} />
          <span className={`${s.corner} ${s.cornerTR}`} />
          <span className={`${s.corner} ${s.cornerBL}`} />
          <span className={`${s.corner} ${s.cornerBR}`} />
        </>
      )}
      {children}
    </div>
  )
}

/* ---------------- TagChip ---------------- */
export function TagChip({ tag }: { tag: string }) {
  const high = isHighThreatTag(tag)
  return <span className={`${s.chip} ${high ? s.chipHigh : ''}`}>{tag.replace(/_/g, ' ')}</span>
}

export function TagRow({ tags, max = 3 }: { tags?: string[]; max?: number }) {
  const list = tags ?? []
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {list.slice(0, max).map(t => (
        <TagChip key={t} tag={t} />
      ))}
      {list.length > max && <span className={s.chipMore}>+{list.length - max}</span>}
    </div>
  )
}

/* ---------------- SignalDot ---------------- */
export function SignalDot({ live = true }: { live?: boolean }) {
  return <span className={`${s.dot} ${live ? s.dotLive : s.dotIdle}`} />
}

/* ---------------- ThreatMeter ---------------- */
export function ThreatMeter({
  value,
  max,
  color,
  label,
}: {
  value: number
  max: number
  color: string
  label?: string | number
}) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100)
  return (
    <div className={s.meter}>
      <div className={s.meterTrack}>
        <div className={s.meterFill} style={{ inlineSize: `${pct}%`, background: color }} />
      </div>
      <span className={s.meterValue} style={{ color }}>
        {label ?? value}
      </span>
    </div>
  )
}

/* ---------------- KeyValue (stat tile) ---------------- */
export function KeyValue({
  label,
  value,
  color,
}: {
  label: string
  value: ReactNode
  color?: string
}) {
  return (
    <div className={s.kv}>
      <div className={s.kvLabel}>{label}</div>
      <div className={s.kvValue} style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  )
}

/* ---------------- ConfidenceRing ---------------- */
export function ConfidenceRing({
  value,
  color,
  size = 52,
  stroke = 3.5,
}: {
  value: number // 0..1
  color: string
  size?: number
  stroke?: number
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * Math.max(0, Math.min(1, value))
  return (
    <div className={s.ring} style={{ inlineSize: size, blockSize: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className={s.ringTrack} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className={s.ringValue}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={color}
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ ['--sg-ring-circ' as string]: circ }}
        />
      </svg>
      <span className={s.ringLabel} style={{ fontSize: size * 0.3, color }}>
        {Math.round(value * 100)}
      </span>
    </div>
  )
}
