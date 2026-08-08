/*
 * SIGNET console color constants for JS/SVG/d3 consumers.
 *
 * SVG attributes and the d3 force graph can't resolve CSS custom properties
 * cleanly, so this is the single JS-side source of truth. Keep it in sync with
 * `signet.tokens.css` (--sg-* variables).
 */

export const SG = {
  canvas: '#0a0e14',
  panel: '#0f141b',
  panelRaised: '#161d27',
  panelInset: '#0b0f15',
  overlay: '#1a2330',

  line: '#1e2630',
  lineStrong: '#2a3340',
  lineFaint: '#161c25',

  textHi: '#e6edf3',
  text: '#aab6c4',
  textMid: '#8b98a9',
  textLow: '#5a6675',
  textFaint: '#3a4453',

  signal: '#f5a623',

  low: '#3ba4f0',
  med: '#f5a623',
  high: '#ff5c49',

  live: '#3dd68c',
  coord: '#9b7df0',
  amplify: '#3ba4f0',
  seed: '#f5a623',
} as const

/** Threat band → console color. */
export function bandColor(score: number): string {
  if (score >= 80) return SG.high
  if (score >= 40) return SG.med
  return SG.low
}

/** Confidence/review tier → console color. */
export function tierColorToken(tier: string): string {
  const map: Record<string, string> = { high: SG.high, medium: SG.med, low: SG.low }
  return map[tier?.toLowerCase()] ?? SG.textLow
}

/** Edge relationship type → console color. */
export function edgeColorToken(type: string): string {
  const map: Record<string, string> = {
    SEEDS: SG.seed,
    AMPLIFIES: SG.amplify,
    TAGGED_WITH: SG.lineStrong,
    SPREADS_VIA: SG.high,
    PART_OF_NETWORK: SG.coord,
  }
  return map[type] ?? SG.line
}
