import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { adjacency, clock, stepOf, systemPrompt, type Case } from '../../../engine/src'
import type { Game, SetGame } from '../App'
import { FloorPlan, tags, type Mark } from '../components/FloorPlan'
import { Portrait } from '../components/Portrait'

export function Accuse({ c, game, setGame, onNew, onReplay }: { c: Case; game: Game; setGame: SetGame; onNew: () => void; onReplay: () => void }) {
  const [pick, setPick] = useState<number | null>(null)
  const [t, setT] = useState<number | ''>('')
  const [room, setRoom] = useState('')
  const suspects = c.cast.filter((p) => p.i !== c.victim)
  const times = Array.from({ length: c.steps }, (_, k) => clock(c.setting.start, k))

  if (game.accused) return <Reveal c={c} game={game} onNew={onNew} onReplay={onReplay} />

  return (
    <div className="accuse">
      <div className="kicker">The arrest</div>
      <h2>Who killed {c.cast[c.victim].first}?</h2>
      <p className="fineprint">You get one arrest. Name the killer. For the full solve, also say when and where it happened.</p>
      <div className="lineup" style={{ marginTop: 18 }}>
        {suspects.map((p) => (
          <button key={p.i} className={`suspect ${pick === p.i ? 'picked' : ''}`} onClick={() => setPick(p.i)} aria-pressed={pick === p.i}>
            <Portrait c={p} stress={pick === p.i ? 0.9 : 0} />
            <div className="placard">
              <b>{p.name}</b>
              <small>{p.arch.role}</small>
            </div>
          </button>
        ))}
      </div>
      <div className="panel accuse-bar">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label>
            When
            <select value={t} onChange={(e) => setT(e.target.value === '' ? '' : +e.target.value)}>
              <option value="">not sure</option>
              {times.map((x, k) => (
                <option key={k} value={k}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label>
            Where
            <select value={room} onChange={(e) => setRoom(e.target.value)}>
              <option value="">not sure</option>
              {c.setting.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn red" disabled={pick === null} onClick={() => pick !== null && setGame((g) => ({ ...g, accused: { who: pick, t: t === '' ? undefined : t, room: room || undefined } }))}>
          {pick === null ? 'Pick a suspect' : `Arrest ${c.cast[pick].first}`}
        </button>
      </div>
    </div>
  )
}

function narrate(c: Case) {
  const s = c.setting
  const name = (i: number) => c.cast[i].first
  const rn = (id: string) => s.rooms.find((r) => r.id === id)!.name
  const adj = adjacency(s.rooms)
  const K = name(c.killer)
  const V = name(c.victim)
  const done = new Set<number>()
  return Array.from({ length: c.steps }, (_, t) => {
    const lines: { text: string; kill?: boolean }[] = []
    for (const e of s.events) if (stepOf(s.start, e.from) === t) lines.push({ text: `${e.what[0].toUpperCase()}${e.what.slice(1)} start${/s$/.test(e.what.split(' ')[1] ?? '') ? '' : 's'} in the ${rn(e.room)}.` })
    for (const p of c.cast) {
      const sec = p.secret
      if (!sec || sec.step !== t || done.has(p.i)) continue
      done.add(p.i)
      if (sec.with !== undefined) {
        done.add(sec.with)
        lines.push({ text: `${p.first} and ${name(sec.with)} slip away to the ${rn(sec.room!)} together.` })
      } else lines.push({ text: `${p.first} sneaks off to the ${rn(sec.room!)}.` })
    }
    if (t === c.murder.pickup) lines.push({ text: `${K} goes into the ${rn(c.murder.weapon.room)} and quietly takes ${c.murder.weapon.name}.`, kill: true })
    if (t === c.murder.step) {
      const heard = c.cast.filter((p) => p.i !== c.victim && adj[c.murder.room].includes(c.pos[p.i][t])).map((p) => p.first)
      lines.push({ text: `${K} is alone with ${V} in the ${rn(c.murder.room)}. ${V} is ${c.murder.weapon.method}.`, kill: true })
      if (heard.length) lines.push({ text: `Next door, ${heard.join(' and ')} hear ${c.murder.sound}.` })
    }
    if (t === c.discovery.step) lines.push({ text: `${name(c.discovery.by)} walks into the ${rn(c.murder.room)} and finds ${V}.`, kill: true })
    if (!lines.length) {
      const count = new Map<string, number>()
      c.cast.forEach((p) => count.set(c.pos[p.i][t], (count.get(c.pos[p.i][t]) ?? 0) + 1))
      const [top, n] = [...count].sort((a, b) => b[1] - a[1])[0]
      lines.push({ text: n > 2 ? `The ${rn(top)} is the busiest room: ${n} people.` : 'People drift between rooms.' })
    }
    return { t, lines }
  })
}

function Reveal({ c, game, onNew, onReplay }: { c: Case; game: Game; onNew: () => void; onReplay: () => void }) {
  const acc = game.accused!
  const right = acc.who === c.killer
  const full = right && acc.t === c.murder.step && acc.room === c.murder.room
  const k = c.cast[c.killer]
  const v = c.cast[c.victim]
  const rn = (id: string) => c.setting.rooms.find((r) => r.id === id)!.name
  const time = (t: number) => clock(c.setting.start, t)
  const asked = Object.values(game.chats).reduce((n, x) => n + x.length, 0)
  const story = useMemo(() => narrate(c), [c])
  const [t, setT] = useState(c.murder.step)
  const [play, setPlay] = useState(false)

  useEffect(() => {
    if (!play) return
    const id = setInterval(() => setT((x) => (x + 1 < c.steps ? x + 1 : (setPlay(false), x))), 1300)
    return () => clearInterval(id)
  }, [play, c.steps])

  const cover = c.account[c.killer][c.murder.step].room
  const witnesses = c.cast.filter((p) => p.i !== c.killer && p.i !== c.victim && c.pos[p.i][c.murder.step] === cover).map((p) => p.first)
  const sawPickup = c.cast.filter((p) => p.i !== c.killer && p.i !== c.victim && c.pos[p.i][c.murder.pickup] === c.murder.weapon.room).map((p) => p.first)

  const tag = tags(c.cast.map((p) => p.name))
  const marks: Mark[] = c.cast.map((p) => ({
    key: `${p.i}`,
    room: c.pos[p.i][t],
    text: p.i === c.victim && t >= c.murder.step ? '†' : tag[p.i],
    tone: p.i === c.killer ? 'red' : p.i === c.victim ? 'dim' : undefined,
  }))

  return (
    <div className="reveal">
      <motion.section className="panel verdict" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
        <Portrait c={k} stress={1} />
        <div>
          <div className="kicker">{right ? `Solved in ${asked} questions` : `You arrested ${c.cast[acc.who].first}`}</div>
          <h2>{right ? (full ? 'Case closed. Every detail.' : 'Case closed.') : 'Wrong arrest.'}</h2>
          <p className="story">
            <b>{k.name}</b> killed {v.first} in the <b>{rn(c.murder.room)}</b> at <b>{time(c.murder.step)}</b>: {v.first} was {c.murder.weapon.method}. {k.motive?.gossip}
          </p>
          <p className="fineprint" style={{ marginTop: 14, maxWidth: 820 }}>
            The giveaway: {k.first} claimed to be in the {rn(cover)} at {time(c.murder.step)}, but {witnesses.join(' and ')} {witnesses.length > 1 ? 'were' : 'was'} there and never saw {k.first}.
            {sawPickup.length > 0 && ` And ${sawPickup.join(' and ')} saw ${k.first} in the ${rn(c.murder.weapon.room)} at ${time(c.murder.pickup)}, just before ${c.murder.weapon.name} went missing.`}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button className="btn red" onClick={onNew}>
              New case
            </button>
            <button className="btn" onClick={onReplay}>
              Play this case again
            </button>
          </div>
        </div>
        <motion.span className={`stamp big-stamp ${right ? 'good' : ''}`} initial={{ scale: 2.4, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 0.9, rotate: -8 }} transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 15 }}>
          {right ? 'Solved' : 'Wrong arrest'}
        </motion.span>
      </motion.section>

      <div className="replay">
        <section className="panel plan-card">
          <div className="kicker" style={{ marginBottom: 12 }}>
            <span>What really happened</span>
            <span>everyone's true position</span>
          </div>
          <FloorPlan s={c.setting} murder={t >= c.murder.step ? c.murder.room : undefined} marks={marks} />
          <div className="scrub">
            <button className="btn" onClick={() => (t + 1 >= c.steps ? (setT(0), setPlay(true)) : setPlay((p) => !p))}>
              {play ? 'Pause' : 'Play'}
            </button>
            <span className="clock">{time(t)}</span>
            <input type="range" min={0} max={c.steps - 1} value={t} onChange={(e) => (setPlay(false), setT(+e.target.value))} aria-label="time" />
          </div>
        </section>
        <section className="panel story-list">
          {story.map((x) => (
            <button key={x.t} className={x.t === t ? 'on' : ''} onClick={() => (setPlay(false), setT(x.t))}>
              <span className="mono">{time(x.t)}</span>
              <span>
                {x.lines.map((l, j) => (
                  <span key={j} className={l.kill ? 'kill' : ''}>
                    {l.text}{' '}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </section>
      </div>

      <div className="kicker" style={{ marginTop: 28 }}>
        What everyone else was hiding
      </div>
      <div className="secrets">
        {c.cast
          .filter((p) => p.i !== c.victim)
          .map((p) => (
            <div key={p.i} className="panel secret">
              <Portrait c={p} />
              <div>
                <b>
                  {p.name}
                  {p.i === c.killer ? ' · the killer' : ''}
                </b>
                {p.secret && <p>{p.secret.text}</p>}
                {p.motive && p.i !== c.killer && <p>And a reason to want {v.first} dead: {p.motive.text}</p>}
                <details className="sheet">
                  <summary>What the model was told</summary>
                  <pre>{systemPrompt(c, p.i)}</pre>
                </details>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
