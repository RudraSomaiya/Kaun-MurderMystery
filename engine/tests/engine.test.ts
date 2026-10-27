import assert from 'node:assert/strict'
import { test } from 'node:test'
import { content } from '../../content'
import { generateCase, solve } from '../src'

test('1000 random seeds each give a case with exactly one findable killer', () => {
  for (let n = 0; n < 1000; n++) {
    const c = generateCase(content, `seed-${n}`)
    const r = solve(c)
    assert.ok(r.ok, `seed-${n}: ${r.why}`)
    assert.equal(r.accused, c.killer)
  }
})

test('same seed, same case', () => {
  assert.deepEqual(generateCase(content, 'chai'), generateCase(content, 'chai'))
})

test('nobody but the discoverer enters the murder room after the murder', () => {
  for (let n = 0; n < 200; n++) {
    const c = generateCase(content, `x${n}`)
    for (let t = c.murder.step + 1; t < c.steps; t++)
      for (const p of c.cast)
        if (p.i !== c.victim && !(p.i === c.discovery.by && t === c.discovery.step))
          assert.notEqual(c.pos[p.i][t], c.murder.room, `x${n}: ${p.first} at step ${t}`)
  }
})

test('settings reference only rooms that exist, and rooms do not overlap', () => {
  for (const s of content.settings) {
    const ids = new Set(s.rooms.map((r) => r.id))
    const refs = [...s.archetypes.flatMap((a) => a.haunts), ...s.weapons.map((w) => w.room), ...s.events.map((e) => e.room)]
    for (const r of refs) assert.ok(ids.has(r), `${s.id}: unknown room ${r}`)
    for (const a of s.rooms)
      for (const b of s.rooms)
        if (a !== b) {
          const xo = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
          const yo = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
          assert.ok(xo <= 0 || yo <= 0, `${s.id}: ${a.id} overlaps ${b.id}`)
        }
    assert.ok(s.archetypes.filter((a) => a.victim).length >= 3, `${s.id}: needs victims`)
  }
})

test('every setting comes up and stays solvable', () => {
  for (const s of content.settings) for (let n = 0; n < 250; n++) assert.ok(solve(generateCase(content, `${s.id}${n}`, s.id)).ok)
})
