import type { Rng } from './rng'
import type { Character, Content, Setting } from './types'

export const fill = (s: string, vars: Record<string, string>) =>
  s.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m)

const fits = (x: { settings?: string[] }, id: string) => !x.settings || x.settings.includes(id)

export function buildCast(rng: Rng, setting: Setting, content: Content, size = 7) {
  const victimArch = rng.pick(setting.archetypes.filter((a) => a.victim))
  const others = rng.shuffle(setting.archetypes.filter((a) => a !== victimArch)).slice(0, size - 1)
  const archs = [victimArch, ...others]

  const families = rng.shuffle(content.names.last).slice(0, 2)
  const used = new Set<string>()
  const cast: Character[] = archs.map((arch, i) => {
    let first = ''
    do first = rng.pick(content.names[arch.gender])
    while (used.has(first))
    used.add(first)
    const last = arch.family !== undefined ? families[arch.family] : rng.pick(content.names.last)
    return {
      i,
      first,
      name: `${first} ${last}`,
      gender: arch.gender,
      age: rng.int(arch.age[0], arch.age[1]),
      arch,
      family: arch.family !== undefined ? setting.families?.[arch.family] : undefined,
      knows: [],
    }
  })

  const victim = 0
  const suspects = cast.slice(1)
  const killer = rng.pick(suspects).i
  const victimName = cast[victim].first

  // the killer always has a motive, plus one or two red herrings
  const holders = [killer, ...rng.shuffle(suspects.filter((c) => c.i !== killer)).slice(0, rng.int(1, 2)).map((c) => c.i)]
  const motives = rng.shuffle(content.motives.filter((m) => fits(m, setting.id)))
  holders.forEach((h, k) => {
    const m = motives[k]
    const c = cast[h]
    const gossip = fill(m.gossip, { self: c.first, victim: victimName })
    c.motive = { id: m.id, text: fill(m.text, { victim: victimName }), gossip, reveal: m.reveal }
    for (const o of rng.shuffle(suspects.filter((x) => x.i !== h)).slice(0, rng.int(1, 2))) o.knows.push(gossip)
  })

  // secrets: everyone hides something. The killer only gets non-location secrets
  // so the only lies about the murder window are the killer's.
  const pool = rng.shuffle(content.secrets.filter((s) => fits(s, setting.id)))
  const takeSecret = (ok: (k: string) => boolean) => {
    const idx = pool.findIndex((s) => ok(s.kind))
    return idx < 0 ? undefined : pool.splice(idx, 1)[0]
  }
  for (const c of rng.shuffle(suspects)) {
    if (c.secret) continue
    const free = suspects.filter((o) => o.i !== c.i && o.i !== killer && !o.secret)
    const t = takeSecret((k) => (c.i === killer ? k === 'info' : k !== 'meet' || free.length > 0))
    if (!t) continue
    c.secret = { id: t.id, kind: t.kind, text: t.text, reveal: t.reveal }
    if (t.kind === 'meet') {
      const p = rng.pick(free)
      c.secret.with = p.i
      p.secret = { ...c.secret, with: c.i }
    }
  }

  return { cast, victim, killer }
}
