/* Shared inline sparkline / sparkbars — used in the feed, detail panel, and tiles. */

export function Sparkline({
  data,
  color,
  height = 28,
  lineWidth = 1.3,
  area = true,
}: {
  data: number[]
  color: string
  height?: number
  lineWidth?: number
  area?: boolean
}) {
  if (!data || data.length < 2) return null
  const w = 100
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const stepX = w / (data.length - 1)
  const pts = data.map(
    (v, i) => `${(i * stepX).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`,
  )
  const linePath = 'M' + pts.join(' L')
  const areaPath = linePath + ` L${w},${height} L0,${height} Z`
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
    >
      {area && <path d={areaPath} fill={color} fillOpacity="0.14" />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={lineWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Sparkbars({
  data,
  color,
  height = 28,
}: {
  data: number[]
  color: string
  height?: number
}) {
  if (!data || data.length === 0) return null
  const w = 100
  const max = Math.max(...data, 1)
  const barW = w / data.length
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
    >
      {data.map((v, i) => {
        const h = Math.max(0.5, (v / max) * height)
        return (
          <rect
            key={i}
            x={(i * barW + barW * 0.15).toFixed(2)}
            y={(height - h).toFixed(2)}
            width={(barW * 0.7).toFixed(2)}
            height={h.toFixed(2)}
            fill={color}
            opacity={0.55 + (v / max) * 0.4}
          />
        )
      })}
    </svg>
  )
}
