export function humanizeLastSeen(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay === 1) {
    return `Yesterday at ${new Date(isoDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(isoDate).toLocaleDateString()
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
