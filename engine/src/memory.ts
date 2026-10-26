import type { Rng } from './rng'
import { adjacency, type Sim } from './simulate'
import type { Character, Line, Setting } from './types'

// truth: what each suspect actually lived through.
// account: what they will tell the detective (secret and killer lies baked in).
export function buildLines(rng: Rng, s: Setting, cast: Character[], sim: Sim) {
  const { pos, tm, td, tw, R, C, lieW, weapon, D, V, K, sound } = sim
  const adj = adjacency(s.rooms)
  const doing = (r: string) => rng.pick(s.rooms.find((x) => x.id === r)!.doing)
  const victim = cast[V].first

  const truth: Line[][] = cast.map((c) => {
    if (c.i === V) return []
    const seen = pos[c.i].flatMap((r, t) => (r === weapon.room && t !== tw ? [t] : []))
    const before = Math.max(-1, ...seen.filter((t) => t < tw))
    const after = Math.min(99, ...seen.filter((t) => t > tw))
    return pos[c.i].map((r, t): Line => {
      const line: Line = {
        t,
        room: r,
        doing: doing(r),
        with: cast.filter((o) => o.i !== c.i && pos[o.i][t] === r && !(o.i === V && t >= tm)).map((o) => o.i),
      }
      if (t === tm && adj[R].includes(r)) line.heard = sound
      if (c.i !== K && t === before) line.noticed = `${weapon.name} was there`
      if (c.i !== K && t === after) line.noticed = `${weapon.name} was missing`
      if (c.i === K && t === tw) line.doing = `quietly took ${weapon.name}`
      if (c.i === K && t === tm) line.doing = `killed ${victim}: ${weapon.method}`
      if (c.i === D && t === td) {
        line.doing = `walked in and found ${victim} dead`
        line.found = true
      }
      return line
    })
  })

  const account = truth.map((lines, i) =>
    lines.map((l): Line => {
      const sec = cast[i].secret
      const lie = (room: string): Line => ({ t: l.t, room, doing: doing(room), with: [], lie: true })
      if (sec?.step === l.t) return lie(sec.lie!)
      if (i === K && l.t === tm) return lie(C)
      if (i === K && l.t === tw) return lie(lieW)
      return l
    }),
  )

  return { truth, account }
}
