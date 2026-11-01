import { fill } from './cast'
import type { Rng } from './rng'
import type { Character, Room, Setting } from './types'

export const STEP = 15

const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const clock = (start: string, t: number) => {
  const x = (mins(start) + t * STEP) % 1440
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
}

export const stepOf = (start: string, hhmm: string) => Math.round(((mins(hhmm) - mins(start) + 1440) % 1440) / STEP)

const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a) }, (_, k) => a + k)

// rooms are adjacent (share a wall, so sound carries) when their rectangles share an edge
export function adjacency(rooms: Room[]): Record<string, string[]> {
  const touch = (a: Room, b: Room) => {
    const xo = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const yo = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    return (xo === 0 && yo > 0) || (yo === 0 && xo > 0)
  }
  return Object.fromEntries(rooms.map((a) => [a.id, rooms.filter((b) => b !== a && touch(a, b)).map((b) => b.id)]))
}

export type Sim = ReturnType<typeof simulate>

export function simulate(rng: Rng, s: Setting, cast: Character[], V: number, K: number) {
  const ids = s.rooms.map((r) => r.id)
  const adj = adjacency(s.rooms)
  const quiet = s.rooms.filter((r) => r.quiet).map((r) => r.id)

  const weapon = rng.pick(s.weapons)
  const R = rng.pick(quiet.filter((r) => r !== weapon.room))
  const tm = rng.int(5, 10)
  const td = tm + rng.int(1, 3)
  const T = td + 1
  const tw = rng.int(Math.max(1, tm - 4), tm - 1)
  const inn = cast.filter((c) => c.i !== V && c.i !== K).map((c) => c.i)
  const locked = (i: number, t: number) => cast[i].secret?.step === t

  // 1. a natural evening: events pull people in, otherwise drift between favourite rooms
  const pos: string[][] = cast.map(() => [])
  for (const c of cast)
    for (let t = 0; t < T; t++) {
      const ev = s.events.find((e) => t >= stepOf(s.start, e.from) && t < stepOf(s.start, e.to))
      pos[c.i][t] =
        ev && rng.chance(ev.pull) ? ev.room
        : t > 0 && rng.chance(0.5) ? pos[c.i][t - 1]
        : rng.chance(0.7) ? rng.pick(c.arch.haunts)
        : rng.pick(ids)
    }

  // 2. secrets that put someone somewhere they will lie about. Never near the murder.
  for (const c of cast) {
    const sec = c.secret
    if (!sec || sec.kind === 'info' || sec.step !== undefined) continue
    const ts = rng.pick(range(1, td).filter((t) => t < tm - 1 || t > tm + 1))
    const r = rng.pick(quiet.filter((q) => ts < tm || q !== R))
    for (const i of sec.with !== undefined ? [c.i, sec.with] : [c.i]) {
      const me = cast[i].secret!
      const prev = pos[i][ts - 1]
      me.step = ts
      me.room = r
      me.lie = prev !== r && prev !== R ? prev : rng.pick(ids.filter((x) => x !== r && x !== R))
      pos[i][ts] = r
    }
  }

  // 3. the murder: weapon pickup, then the killer alone with the victim
  pos[K][tw] = weapon.room
  for (let t = tm; t < T; t++) pos[V][t] = R
  pos[K][tm] = R

  // sometimes an innocent sees the killer take the weapon (unless everyone is busy with secrets)
  if (rng.chance(0.75)) {
    const free = inn.filter((i) => !locked(i, tw))
    if (free.length) pos[rng.pick(free)][tw] = weapon.room
  }

  // someone must have seen the victim alive just before
  const vr = pos[V][tm - 1]
  if (!inn.some((i) => pos[i][tm - 1] === vr)) pos[rng.pick(inn)][tm - 1] = vr

  // 4. the murder window: innocents in pairs or threes so each has a witness,
  // one group within earshot, one group where the killer will claim to have been
  const E = rng.pick(adj[R])
  const C = rng.pick(ids.filter((x) => x !== R && x !== E && !adj[R].includes(x)))
  const rest = ids.filter((x) => x !== R && x !== E && x !== C)
  let left = rng.shuffle(inn)
  for (let g = 0; left.length; g++) {
    const n = left.length <= 3 ? left.length : rng.int(2, Math.min(3, left.length - 2))
    const r = g === 0 ? E : g === 1 ? C : rng.pick(rest)
    for (const i of left.slice(0, n)) pos[i][tm] = r
    left = left.slice(n)
  }

  // 5. nobody walks into the body until it is found
  for (let t = tm + 1; t < T; t++)
    for (const c of cast)
      if (c.i !== V && pos[c.i][t] === R)
        pos[c.i][t] = pos[c.i][t - 1] !== R ? pos[c.i][t - 1] : rng.pick(ids.filter((x) => x !== R))
  const D = rng.pick(inn)
  pos[D][td] = R

  const lieW = pos[K][tw - 1] !== weapon.room && pos[K][tw - 1] !== R ? pos[K][tw - 1] : rng.pick(ids.filter((x) => x !== weapon.room && x !== R))

  const roomName = (id: string) => s.rooms.find((r) => r.id === id)!.name
  for (const c of cast)
    if (c.secret)
      c.secret.text = fill(c.secret.text, {
        other: c.secret.with !== undefined ? cast[c.secret.with].first : '',
        room: c.secret.room ? roomName(c.secret.room) : '',
        time: c.secret.step !== undefined ? clock(s.start, c.secret.step) : '',
      })

  return { pos, T, tm, td, tw, R, C, E, lieW, weapon, D, V, K, sound: rng.pick(s.sounds) }
}
