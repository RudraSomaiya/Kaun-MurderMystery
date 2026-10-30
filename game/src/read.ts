// Reading what suspects say: pulling "I was in X at T" claims out of replies for the
// notebook, and a crude polygraph that reacts to touchy topics (nerves, not guilt).
import { clock, type Case } from '../../engine/src'

export type Claim = { who: number; t: number; room: string; quote: string }

const SKIP = new Set(['room', 'the', 'old', 'second-floor', 'floor', 'deck', 'lot', "star's", "heroine's"])

function aliases(c: Case) {
  const words = c.setting.rooms.map((r) => r.name.toLowerCase().replace(/'s\b/g, '').split(/\s+/).filter((w) => !SKIP.has(w) && (w.length > 3 || /\d/.test(w))))
  const count = new Map<string, number>()
  words.flat().forEach((w) => count.set(w, (count.get(w) ?? 0) + 1))
  return c.setting.rooms.map((r, k) => ({ id: r.id, keys: [r.name.toLowerCase(), ...words[k].filter((w) => count.get(w) === 1)] }))
}

const TIME = /\b(\d{1,2})[:.](\d{2})\s*(am|pm)?|\b(\d{1,2})\s*(am|pm|baje|o'?clock)\b/gi
const toMin = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3)

export function stepOfText(c: Case, h: number, m: number, ampm?: string) {
  const start = toMin(c.setting.start)
  const span = c.steps * 15
  const cands = ampm?.toLowerCase() === 'am' ? [h % 12] : ampm?.toLowerCase() === 'pm' ? [(h % 12) + 12] : [h % 24, (h + 12) % 24]
  const best = cands
    .map((x) => ((x * 60 + m - start + 1440) % 1440))
    .filter((d) => d <= span + 15)
    .sort((a, b) => a - b)[0]
  return best === undefined ? -1 : Math.min(c.steps - 1, Math.round(best / 15))
}

export function parseClaims(c: Case, who: number, text: string): Claim[] {
  const rooms = aliases(c)
  const out: Claim[] = []
  for (const sent of text.split(/(?<=[.!?])\s+/)) {
    if (!/\b(i|i'm|i'd|me|my|main|mai|hum|we|apun)\b/i.test(sent)) continue
    // one claim per clause: "at 8:15 we danced, then at 8:30 I was on the terrace"
    for (const part of sent.split(/;|,?\s+then\s+|,\s+and\s+|,\s+(?=(?:at|around|by|from)\s+\d)/i)) {
      const low = part.toLowerCase()
      const steps = [...part.matchAll(TIME)].map((m) => (m[1] ? stepOfText(c, +m[1], +m[2], m[3]) : stepOfText(c, +m[4], 0, m[5] === 'pm' || m[5] === 'am' ? m[5] : undefined))).filter((t) => t >= 0)
      const hit = rooms.filter((r) => r.keys.some((k) => low.includes(k)))
      if (steps.length && hit.length === 1) for (const t of new Set(steps)) out.push({ who, t, room: hit[0].id, quote: sent.trim() })
    }
  }
  return out
}

export function nerve(c: Case, who: number, q: string) {
  const me = c.cast[who]
  const s = q.toLowerCase()
  const room = (id?: string) => c.setting.rooms.find((r) => r.id === id)?.name.toLowerCase() ?? '\u0000'
  const hits = (xs: string[]) => xs.some((x) => x && s.includes(x.toLowerCase()))
  const at = (t: number) => {
    const hhmm = clock(c.setting.start, t)
    const h12 = `${((+hhmm.slice(0, 2) + 11) % 12) + 1}:${hhmm.slice(3)}`
    return s.includes(hhmm) || s.includes(h12)
  }
  let d = 0
  if (at(c.murder.step) || hits([room(c.murder.room), c.murder.weapon.name.replace(/^(the|a|an) /, ''), 'kill', 'murder']))
    d += who === c.killer ? 0.45 : me.motive ? 0.2 : 0.06
  if (who === c.killer && at(c.murder.pickup)) d += 0.25
  const sec = me.secret
  if (sec && (hits(sec.reveal) || (sec.room && s.includes(room(sec.room))) || (sec.step !== undefined && at(sec.step)))) d += 0.35
  if (me.motive && hits(me.motive.reveal)) d += 0.3
  if (/\b(liar|lying|arrest|confess|jail|truth|caught)\b/.test(s)) d += 0.12
  return d
}
