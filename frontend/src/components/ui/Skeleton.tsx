import styles from './Skeleton.module.css'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  circle?: boolean
  className?: string
}

export function Skeleton({ width, height, circle, className }: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${circle ? styles.circle : styles.block} ${className ?? ''}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}
