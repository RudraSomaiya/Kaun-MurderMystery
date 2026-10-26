import { buildCast } from './cast'
import { buildLines } from './memory'
import { hash, makeRng } from './rng'
import { simulate } from './simulate'
import { solve } from './solvable'
import type { Case, Content } from './types'

export * from './types'
export { clock, adjacency } from './simulate'
export { solve } from './solvable'
export { makeRng, hash } from './rng'

export const caseId = (seed: string) => hash(seed).toString(36).toUpperCase().padStart(7, '0').slice(0, 6)

export function generateCase(content: Content, seed: string, settingId?: string): Case {
  const setting = settingId ? content.settings.find((s) => s.id === settingId) : makeRng(seed).pick(content.settings)
  if (!setting) throw new Error(`unknown setting ${settingId}`)
  for (let k = 0; k < 20; k++) {
    const rng = makeRng(`${seed}/${k}`)
    const { cast, victim, killer } = buildCast(rng, setting, content)
    const sim = simulate(rng, setting, cast, victim, killer)
    const { truth, account } = buildLines(rng, setting, cast, sim)
    const c: Case = {
      id: caseId(seed),
      seed,
      setting,
      cast,
      victim,
      killer,
      steps: sim.T,
      pos: sim.pos,
      murder: { step: sim.tm, room: sim.R, weapon: sim.weapon, pickup: sim.tw, sound: sim.sound },
      discovery: { step: sim.td, by: sim.D },
      truth,
      account,
    }
    if (solve(c).ok) return c
  }
  throw new Error(`no solvable case for seed ${seed}`)
}
export { systemPrompt, caseFacts, lineText } from './prompt'
