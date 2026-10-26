import type { Case } from './types'

// Plays the detective with perfect recall of every suspect's account.
// 1. time of death = the one step where someone heard the sound
// 2. the killer = the only suspect nobody can place at that step
// 3. and someone in the room they claim says they were not there
export function solve(c: Case) {
  const suspects = c.cast.filter((x) => x.i !== c.victim).map((x) => x.i)
  const heard = new Set(suspects.flatMap((s) => c.account[s].filter((l) => l.heard).map((l) => l.t)))
  if (heard.size !== 1) return { ok: false, why: `heard at ${heard.size} steps` }
  const [t] = heard

  const at = (s: number) => c.account[s][t]
  const alibied = (s: number) => suspects.some((o) => o !== s && at(o).room === at(s).room && at(o).with.includes(s))
  const loose = suspects.filter((s) => !alibied(s))
  if (loose.length !== 1) return { ok: false, why: `${loose.length} suspects without alibi` }

  const [k] = loose
  const contradicted = suspects.some((o) => o !== k && at(o).room === at(k).room && !at(o).with.includes(k))
  if (!contradicted) return { ok: false, why: 'cover story never contradicted' }
  return { ok: k === c.killer, why: k === c.killer ? '' : 'solver accused the wrong person', accused: k, tod: t }
}
