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
