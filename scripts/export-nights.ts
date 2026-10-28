// Writes simulated cases as JSONL for the Python side (teacher data, training, evals).
// usage: npm run nights -- <split> <count>     e.g. npm run nights -- train 3000
import { mkdirSync, writeFileSync } from 'node:fs'
import { content } from '../content'
import { clock, generateCase, systemPrompt, type Case, type Line } from '../engine/src'

const [split = 'train', count = '100'] = process.argv.slice(2)

const facts = (c: Case, i: number) => {
  const room = (id: string) => c.setting.rooms.find((r) => r.id === id)!.name
  const time = (t: number) => clock(c.setting.start, t)
  const line = (l: Line) => ({
    t: l.t,
    time: time(l.t),
    room: room(l.room),
    with: l.with.map((j) => c.cast[j].first),
    ...(l.heard ? { heard: true } : {}),
    ...(l.lie ? { lie: true } : {}),
  })
  const me = c.cast[i]
  // what other suspects truly saw of this person: ammunition for confrontations
  const seenBy = c.cast.flatMap((o) =>
    o.i === i || o.i === c.victim ? [] : c.truth[o.i].filter((l) => l.with.includes(i)).map((l) => ({ by: o.first, time: time(l.t), room: room(l.room) })),
  )
  return {
    times: Array.from({ length: c.steps }, (_, t) => time(t)),
    rooms: c.setting.rooms.map((r) => r.name),
    people: c.cast.map((p) => p.first),
    suspects: c.cast.filter((p) => p.i !== c.victim && p.i !== i).map((p) => ({ name: p.first, role: p.arch.role, motive: !!p.motive })),
    account: c.account[i].map(line),
    truth: c.truth[i].map(line),
    seenBy,
    murder: { time: time(c.murder.step), room: room(c.murder.room), victim: c.cast[c.victim].first, weapon: c.murder.weapon.name },
    found: { time: time(c.discovery.step), by: c.cast[c.discovery.by].first },
    secret: me.secret ? { text: me.secret.text, reveal: me.secret.reveal, time: me.secret.step !== undefined ? time(me.secret.step) : null, room: me.secret.room ? room(me.secret.room) : null } : null,
    motive: me.motive ?? null,
    knows: me.knows,
  }
}

mkdirSync('data/nights', { recursive: true })
const out: string[] = []
for (let n = 0; n < Number(count); n++) {
  const c = generateCase(content, `${split}-${n}`)
  for (const p of c.cast) {
    if (p.i === c.victim) continue
    out.push(JSON.stringify({ id: `${split}-${n}-${p.i}`, seed: c.seed, setting: c.setting.id, i: p.i, name: p.first, killer: p.i === c.killer, system: systemPrompt(c, p.i), facts: facts(c, p.i) }))
  }
}
writeFileSync(`data/nights/${split}.jsonl`, out.join('\n') + '\n')
console.log(`${split}: ${count} cases, ${out.length} suspects`)
