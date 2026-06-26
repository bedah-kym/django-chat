import { useState, useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { SignetNode, Filters, SignetEdge } from './types'
import { nodeColor, nodeRadius, edgeColor, accountThreatLevel } from './utils'
import { SG } from './tokens'
import { SectionLabel } from './components/Primitives'
import { SignetDetailPanel } from './SignetDetailPanel'
import s from './GraphView.module.css'

const NODE_LABEL_FONT = "'IBM Plex Mono','SFMono-Regular',ui-monospace,'Courier New',monospace"

interface GraphViewProps {
  selected: SignetNode | null
  setSelected: (n: SignetNode | null) => void
  filters: Filters
  setFilters: (f: Filters) => void
  search: string
  nodes: SignetNode[]
  edges: SignetEdge[]
}

export function GraphView({ selected, setSelected, filters, setFilters, search, nodes: NODES, edges: EDGES }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<SignetNode | null>(null)
  const [dims, setDims] = useState({ w: 800, h: 600 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const searchLower = search.trim().toLowerCase()
  const matchesSearch = (n: SignetNode) => {
    if (!searchLower) return true
    const label = 'handle' in n ? n.handle : n.label
    const hay = (label + ' ' + (n.tags || []).join(' ')).toLowerCase()
    return hay.includes(searchLower)
  }

  // Threat distribution over real account nodes, bucketed by classifier tags.
  const accountNodes = NODES.filter(n => n.type === 'account')
  const threatDist = [
    { l: 'HIGH', c: SG.high, n: accountNodes.filter(n => accountThreatLevel(n) === 'HIGH').length },
    { l: 'MEDIUM', c: SG.med, n: accountNodes.filter(n => accountThreatLevel(n) === 'MEDIUM').length },
    { l: 'LOW', c: SG.low, n: accountNodes.filter(n => accountThreatLevel(n) === 'LOW').length },
  ]

  useEffect(() => {
    if (!svgRef.current || dims.w < 10) return
    const { w, h } = dims
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const visNodes = NODES.filter(n => filters[n.type] && matchesSearch(n))
    const visIds = new Set(visNodes.map(n => n.id))
    const visEdges = EDGES.filter(e => visIds.has(e.source) && visIds.has(e.target))

    const nodes = visNodes.map(n => ({ ...n })) as any[]
    const edges = visEdges.map(e => ({ ...e }))

    const defs = svg.append('defs')
    ;['amber', 'red', 'blue', 'purple'].forEach((name) => {
      const f = defs.append('filter').attr('id', `glow-${name}`).attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
      f.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '4').attr('result', 'blur')
      const merge = f.append('feMerge')
      merge.append('feMergeNode').attr('in', 'blur')
      merge.append('feMergeNode').attr('in', 'SourceGraphic')
    })
    ;[['SEEDS', SG.seed], ['AMPLIFIES', SG.amplify], ['SPREADS_VIA', SG.high]].forEach(([type, col]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`).attr('viewBox', '0 -5 10 10').attr('refX', 22).attr('refY', 0)
        .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', col as string).attr('opacity', 0.6)
    })

    const root = svg.append('g')
    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.25, 4]).on('zoom', ev => root.attr('transform', ev.transform)))

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id((d: any) => d.id).distance((d: any) => {
        if (d.type === 'PART_OF_NETWORK') return 55
        if (d.type === 'SEEDS') return 110
        return 85
      }).strength(0.25))
      .force('charge', d3.forceManyBody().strength((d: any) => {
        if (d.type === 'narrative') return -500
        if (d.tier === 'macro') return -350
        if (d.tier === 'mid') return -200
        return -120
      }))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide((d: any) => nodeRadius(d as SignetNode) + 14))

    const link = root.append('g').selectAll('line').data(edges).join('line')
      .attr('stroke', d => edgeColor(d))
      .attr('stroke-width', d => d.type === 'SEEDS' ? 1.8 : d.type === 'PART_OF_NETWORK' ? 1.5 : 1)
      .attr('stroke-opacity', d => d.type === 'TAGGED_WITH' ? 0.15 : 0.45)
      .attr('stroke-dasharray', d => d.type === 'PART_OF_NETWORK' ? '5,4' : null)
      .attr('marker-end', d => ['SEEDS', 'AMPLIFIES', 'SPREADS_VIA'].includes(d.type) ? `url(#arrow-${d.type})` : null)

    const nodeG = root.append('g').selectAll('g').data(nodes).join('g').attr('cursor', 'pointer') as any
    nodeG.call(d3.drag()
      .on('start', (ev: any, d: any) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag', (ev: any, d: any) => { d.fx = ev.x; d.fy = ev.y })
      .on('end', (ev: any, d: any) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null }))
      .on('click', (ev: any, d: any) => { ev.stopPropagation(); setSelected(d as SignetNode) })
      .on('mouseenter', (ev: any, d: any) => {
        setHovered(d as SignetNode)
        const col = d.type === 'hashtag' ? 'amber' : d.type === 'narrative' ? 'red' : 'blue'
        d3.select(ev.currentTarget).selectAll('circle,rect,path').style('filter', `url(#glow-${col})`).attr('opacity', 1)
      })
      .on('mouseleave', () => {
        setHovered(null)
        d3.selectAll('.glow-target').style('filter', null).attr('opacity', 0.82)
      })

    nodeG.each(function (this: SVGGElement, d: any) {
      const el = d3.select(this)
      const r = nodeRadius(d as SignetNode)
      const col = nodeColor(d as SignetNode)
      if (d.type === 'narrative') {
        const s = r * 1.5
        if (d.status === 'active') {
          el.append('rect').attr('width', s * 2 + 12).attr('height', s * 2 + 12).attr('x', -s - 6).attr('y', -s - 6).attr('rx', 4)
            .attr('transform', 'rotate(45)').attr('fill', 'none').attr('stroke', col).attr('stroke-width', 0.5).attr('opacity', 0.25)
        }
        el.append('rect').attr('width', s * 2).attr('height', s * 2).attr('x', -s).attr('y', -s).attr('rx', 3)
          .attr('transform', 'rotate(45)').attr('fill', col).attr('fill-opacity', 0.12)
          .attr('stroke', col).attr('stroke-width', 1.5).attr('opacity', 0.82)
      } else if (d.type === 'hashtag') {
        el.append('path').attr('d', d3.symbol().type(d3.symbolTriangle).size(r * r * 3.5)()!)
          .attr('fill', col).attr('fill-opacity', 0.2).attr('stroke', col).attr('stroke-width', 1).attr('opacity', 0.82)
      } else {
        el.append('circle').attr('r', r + 6).attr('fill', 'none').attr('stroke', SG.line).attr('stroke-width', 1)
        if (d.confidence > 0) {
          const circ = 2 * Math.PI * (r + 6)
          el.append('circle').attr('r', r + 6).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 1.2)
            .attr('stroke-dasharray', `${circ * d.confidence} ${circ * (1 - d.confidence)}`)
            .attr('stroke-dashoffset', circ * 0.25).attr('opacity', 0.4)
        }
        el.append('circle').attr('r', r).attr('fill', col).attr('fill-opacity', 0.1)
          .attr('stroke', col).attr('stroke-width', d.tier === 'macro' ? 2 : 1.5).attr('opacity', 0.82)
        if (d.tier === 'macro') el.append('circle').attr('r', 4).attr('fill', col).attr('opacity', 0.6)
      }
      el.append('text')
        .text(() => {
          if (d.type === 'account') return d.handle
          if (d.type === 'narrative') return d.label.length > 20 ? d.label.slice(0, 18) + '\u2026' : d.label
          return d.label
        })
        .attr('dy', r + 14).attr('text-anchor', 'middle')
        .attr('font-size', d.tier === 'macro' ? '11px' : '10px')
        .attr('font-family', NODE_LABEL_FONT)
        .attr('fill', d.type === 'narrative' && d.status === 'active' ? SG.high : d.tier === 'macro' ? SG.text : SG.textLow)
        .attr('pointer-events', 'none')
    })

    sim.on('tick', () => {
      link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y)
      nodeG.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    svg.on('click', () => setSelected(null))
    return () => { sim.stop() }
  }, [dims, filters, search, setSelected])

  const toggleFilter = (type: string) => setFilters({ ...filters, [type]: !filters[type as keyof Filters] })

  return (
    <div className={s.view}>
      <div className={s.rail}>
        <div className={s.section}>
          <SectionLabel style={{ marginBlockEnd: 10 }}>Node filters</SectionLabel>
          {[{ type: 'account', color: SG.amplify, label: 'ACCOUNTS' }, { type: 'narrative', color: SG.high, label: 'NARRATIVES' }, { type: 'hashtag', color: SG.seed, label: 'HASHTAGS' }].map(f => {
            const key = f.type as keyof Filters
            const on = filters[key]
            return (
              <div
                key={f.type}
                onClick={() => toggleFilter(f.type)}
                className={`${s.filter} ${on ? s.filterActive : ''}`}
                style={on ? { borderColor: f.color + '50', background: f.color + '12' } : undefined}
              >
                <div className={s.filterDot} style={{ background: f.color }} />
                <span className={s.filterLabel}>{f.label}</span>
              </div>
            )
          })}
        </div>
        <div className={s.section}>
          <SectionLabel style={{ marginBlockEnd: 10 }}>Edge types</SectionLabel>
          {[{ t: 'SEEDS', c: SG.seed }, { t: 'AMPLIFIES', c: SG.amplify }, { t: 'SPREADS VIA', c: SG.high },
          { t: 'TAGGED WITH', c: SG.lineStrong }, { t: 'COORDINATION', c: SG.coord, dash: true }].map(e => (
            <div key={e.t} className={s.legendRow}>
              <div
                className={`${s.legendSwatch} ${e.dash ? s.legendSwatchDash : ''}`}
                style={e.dash ? { borderBlockStartColor: e.c } : { background: e.c }}
              />
              <span className={s.legendLabel}>{e.t}</span>
            </div>
          ))}
        </div>
        <div className={s.section}>
          <SectionLabel style={{ marginBlockEnd: 10 }}>Threat dist.</SectionLabel>
          {threatDist.map(t => (
            <div key={t.l} className={s.distRow}>
              <div className={s.distLeft}>
                <div className={s.distSwatch} style={{ background: t.c }} />
                <span className={s.distLabel}>{t.l}</span>
              </div>
              <span className={s.distCount} style={{ color: t.c }}>{t.n}</span>
            </div>
          ))}
        </div>
        <div className={s.section}>
          <SectionLabel style={{ marginBlockEnd: 10 }}>Platforms</SectionLabel>
          {[
            { l: 'REDDIT', active: NODES.some(n => n.type === 'account' && n.platform === 'reddit') },
            { l: 'TELEGRAM', active: NODES.some(n => n.type === 'account' && n.platform === 'telegram') },
            { l: 'FACEBOOK', active: false },
          ].map(p => (
            <div key={p.l} className={`${s.platformRow} ${p.active ? '' : s.platformRowInactive}`}>
              <div className={`${s.platformDot} ${p.active ? s.platformDotActive : ''}`} />
              <span className={`${s.platformLabel} ${p.active ? s.platformLabelActive : ''}`}>{p.l}</span>
            </div>
          ))}
        </div>
      </div>

      <div ref={containerRef} className={s.canvas}>
        <div className={s.grid} />
        <svg ref={svgRef} className={s.svg} width="100%" height="100%" />
        {hovered && (
          <div className={s.tooltip}>
            {hovered.type === 'account' && `${hovered.handle} · ${hovered.tier?.toUpperCase()} · REACH ${hovered.followers?.toLocaleString()}`}
            {hovered.type === 'narrative' && `${hovered.label} · REACH ${hovered.reach?.toLocaleString()} · ${hovered.status?.toUpperCase()}`}
            {hovered.type === 'hashtag' && `${hovered.label} · ${hovered.volume?.toLocaleString()} posts · ${hovered.velocity?.toUpperCase()}`}
          </div>
        )}
      </div>

      <SignetDetailPanel selected={selected} onClose={() => setSelected(null)} onNavigate={setSelected} nodes={NODES} edges={EDGES} />
    </div>
  )
}
