import { motion } from 'motion/react'
import type { Setting } from '../../../engine/src'

const U = 46

export type Mark = { key: string; room: string; text: string; tone?: 'red' | 'gold' | 'dim' }

export function FloorPlan({ s, murder, marks = [], active, onRoom }: { s: Setting; murder?: string; marks?: Mark[]; active?: string; onRoom?: (id: string) => void }) {
  const W = Math.max(...s.rooms.map((r) => r.x + r.w)) * U
  const H = Math.max(...s.rooms.map((r) => r.y + r.h)) * U
  const byRoom = new Map<string, Mark[]>()
  for (const m of marks) byRoom.set(m.room, [...(byRoom.get(m.room) ?? []), m])

  const spot = (m: Mark) => {
    const r = s.rooms.find((x) => x.id === m.room)!
    const list = byRoom.get(m.room)!
    const k = list.indexOf(m)
    const perRow = Math.max(1, Math.floor((r.w * U - 24) / 30))
    const rows = Math.ceil(list.length / perRow)
    const inRow = Math.min(perRow, list.length - Math.floor(k / perRow) * perRow)
    return {
      x: r.x * U + (r.w * U) / 2 + ((k % perRow) - (inRow - 1) / 2) * 30,
      y: r.y * U + (r.h * U) / 2 + 8 + (Math.floor(k / perRow) - (rows - 1) / 2) * 30,
    }
  }

  return (
    <svg className="plan" viewBox={`-4 -4 ${W + 8} ${H + 8}`} role="img" aria-label={`Floor plan of ${s.title}`}>
      <defs>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="1" opacity="0.08" />
        </pattern>
      </defs>
      {s.rooms.map((r) => {
        const x = r.x * U + 3
        const y = r.y * U + 3
        const w = r.w * U - 6
        const h = r.h * U - 6
        const dead = r.id === murder
        return (
          <g key={r.id} className={`room ${dead ? 'murder' : ''} ${active === r.id ? 'active' : ''} ${onRoom ? 'clickable' : ''}`} onClick={() => onRoom?.(r.id)}>
            <rect x={x} y={y} width={w} height={h} rx="3" className="room-fill" />
            {r.quiet && <rect x={x} y={y} width={w} height={h} rx="3" fill="url(#hatch)" />}
            <text x={x + 9} y={y + 17} className="room-name">
              {r.name}
            </text>
            {dead && (
              <path
                className="chalk"
                transform={`translate(${x + w / 2 - 26} ${y + h / 2 - 14}) scale(0.9)`}
                d="M8 22 q-6 -12 6 -14 q8 -1 10 6 l14 -4 q10 -2 18 4 l10 -8 q4 -2 5 2 l-8 10 q6 6 2 12 l8 8 q2 4 -2 5 l-10 -6 q-8 4 -18 1 l-14 6 q-4 1 -4 -3 l10 -8 q-6 -2 -10 -2 q-12 0 -17 -9 z"
              />
            )}
          </g>
        )
      })}
      {marks.map((m) => {
        const p = spot(m)
        return (
          <motion.g key={m.key} className={`mark ${m.tone ?? ''}`} initial={false} animate={{ x: p.x, y: p.y }} transition={{ type: 'spring', stiffness: 140, damping: 20 }}>
            <circle r="12" />
            <text y="4">{m.text}</text>
          </motion.g>
        )
      })}
    </svg>
  )
}

// short unique tags for map markers: "RA", then "RI" if taken, and so on
export function tags(names: string[]) {
  const used = new Set<string>()
  return names.map((n) => {
    const [first, last = ''] = n.toUpperCase().split(' ')
    const opts = [first.slice(0, 2), first[0] + last[0], ...first.slice(1).split('').map((ch) => first[0] + ch), first[0] + '•']
    const t = opts.find((o) => o.length === 2 && !used.has(o)) ?? first.slice(0, 2)
    used.add(t)
    return t
  })
}
