import { useState } from 'react'
import { clock, type Case } from '../../../engine/src'
import type { Game, SetGame } from '../App'
import { FloorPlan, tags, type Mark } from '../components/FloorPlan'
import { Portrait } from '../components/Portrait'

export const ROOM_COLORS = ['#f0a81c', '#3a9a8f', '#ef6f5e', '#8fb3ff', '#c792ea', '#7ccf6b', '#ff9e64', '#e0c3a0', '#5ec4d6', '#f78fb3']

export function Notebook({ c, game, setGame, onPick }: { c: Case; game: Game; setGame: SetGame; onPick: (i: number) => void }) {
  const [col, setCol] = useState(c.discovery.step)
  const suspects = c.cast.filter((p) => p.i !== c.victim)
  const times = Array.from({ length: c.steps }, (_, t) => clock(c.setting.start, t))
  const color = (id: string) => ROOM_COLORS[c.setting.rooms.findIndex((r) => r.id === id) % ROOM_COLORS.length]
  const short = (id: string) => c.setting.rooms.find((r) => r.id === id)!.name.replace(/^(The|Old|Second-floor) /, '').split(' ')[0]

  // what each suspect has claimed, newest claim wins
  const claimed = new Map<string, string>()
  for (const p of suspects) for (const turn of game.chats[p.i] ?? []) for (const cl of turn.claims ?? []) claimed.set(`${cl.who}:${cl.t}`, cl.room)
  const roomAt = (i: number, t: number) => game.marks[`${i}:${t}`] ?? claimed.get(`${i}:${t}`)

  const tag = tags(c.cast.map((p) => p.name))
  const marks: Mark[] = suspects.flatMap((p) => {
    const r = roomAt(p.i, col)
    return r ? [{ key: `${p.i}`, room: r, text: tag[p.i], tone: game.marks[`${p.i}:${col}`] ? 'dim' : 'gold' } as Mark] : []
  })

  const setMark = (i: number, t: number, room: string) =>
    setGame((g) => {
      const m = { ...g.marks }
      if (room) m[`${i}:${t}`] = room
      else delete m[`${i}:${t}`]
      return { ...g, marks: m }
    })

  return (
    <>
      <div className="notebook">
        <section className="panel grid-wrap">
          <div className="kicker" style={{ marginBottom: 10 }}>
            Who says they were where · click a cell to write your own note
          </div>
          <table className="tl">
            <thead>
              <tr>
                <th />
                {times.map((x, t) => (
                  <th key={t} className={`col ${t === col ? 'on' : ''} ${t === c.discovery.step ? 'found' : ''}`} onClick={() => setCol(t)} title={t === c.discovery.step ? 'Body found' : undefined}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suspects.map((p) => (
                <tr key={p.i}>
                  <td className="namecell">
                    <button className="who" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => onPick(p.i)}>
                      <Portrait c={p} />
                      {p.first}
                    </button>
                  </td>
                  {times.map((_, t) => {
                    const mine = game.marks[`${p.i}:${t}`]
                    const said = claimed.get(`${p.i}:${t}`)
                    return (
                      <td key={t}>
                        <div className={`slot ${t === col ? 'on' : ''}`}>
                          {said && (
                            <span className="rm" style={{ background: color(said) }} title="They said so">
                              {short(said)}
                            </span>
                          )}
                          {mine && mine !== said && (
                            <span className="rm mine" style={{ background: color(mine) }} title="Your note">
                              {short(mine)}?
                            </span>
                          )}
                          <select value={mine ?? ''} onChange={(e) => setMark(p.i, t, e.target.value)} onFocus={() => setCol(t)} aria-label={`${p.first} at ${times[t]}`}>
                            <option value="">(no note)</option>
                            {c.setting.rooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="legend">
            {c.setting.rooms.map((r) => (
              <span key={r.id}>
                <i style={{ background: color(r.id) }} />
                {r.name}
              </span>
            ))}
          </div>
        </section>

        <section className="panel plan-card">
          <div className="kicker" style={{ marginBottom: 12 }}>
            <span>The house at {times[col]}</span>
            <span>{col === c.discovery.step ? 'body found' : 'by their own account'}</span>
          </div>
          <FloorPlan s={c.setting} murder={c.murder.room} marks={marks} />
        </section>
      </div>

      <section className="board">
        <div className="board-head">
          <h3>Evidence board</h3>
          <span className="kicker">{game.pins.length} pinned</span>
        </div>
        <div className="pins">
          {!game.pins.length && <div className="none">Pin statements during questioning. Then throw them back at other suspects.</div>}
          {game.pins.map((p) => (
            <article key={p.id} className="pin">
              “{p.text}”
              <footer>
                <span>{c.cast[p.who].name}</span>
                <button onClick={() => setGame((g) => ({ ...g, pins: g.pins.filter((x) => x.id !== p.id) }))}>unpin</button>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
