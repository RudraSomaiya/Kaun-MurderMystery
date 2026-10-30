import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { clock, systemPrompt, type Case } from '../../../engine/src'
import type { Game, SetGame } from '../App'
import { Pulse } from '../components/Atmosphere'
import { Portrait } from '../components/Portrait'
import { reply, type Config, type Msg } from '../llm'
import { nerve, parseClaims } from '../read'

export function Interrogation({ c, game, setGame, cfg, who, setWho }: { c: Case; game: Game; setGame: SetGame; cfg: Config; who: number; setWho: (i: number) => void }) {
  const me = c.cast[who]
  const turns = game.chats[who] ?? []
  const suspects = c.cast.filter((p) => p.i !== c.victim)
  const victim = c.cast[c.victim]
  const times = Array.from({ length: c.steps }, (_, t) => clock(c.setting.start, t))

  const [draft, setDraft] = useState('')
  const [live, setLive] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [t, setT] = useState(Math.max(0, c.steps - 3))
  const [other, setOther] = useState(suspects.find((p) => p.i !== who)!.i)
  const [pin, setPin] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const stop = useRef<AbortController | null>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns.length, live])
  useEffect(() => () => stop.current?.abort(), [who])
  useEffect(() => {
    if (other === who) setOther(suspects.find((p) => p.i !== who)!.i)
  }, [who])

  const stress = game.nerves[who] ?? 0
  const pins = game.pins.filter((p) => p.who !== who)

  async function ask(q: string) {
    q = q.trim()
    if (!q || busy) return
    setBusy(true)
    setErr('')
    setDraft('')
    setLive('')
    const history: Msg[] = turns.slice(-8).flatMap((x) => [
      { role: 'user' as const, content: x.q },
      { role: 'assistant' as const, content: x.a },
    ])
    const msgs: Msg[] = [{ role: 'system', content: systemPrompt(c, who) }, ...history, { role: 'user', content: q }]
    setGame((g) => ({
      ...g,
      nerves: { ...g.nerves, [who]: Math.min(1.2, (g.nerves[who] ?? 0) * 0.72 + nerve(c, who, q)) },
      chats: { ...g.chats, [who]: [...(g.chats[who] ?? []), { q, a: '' }] },
    }))
    stop.current = new AbortController()
    try {
      const a = await reply(cfg, msgs, me.first, setLive, stop.current.signal)
      setGame((g) => {
        const list = [...(g.chats[who] ?? [])]
        list[list.length - 1] = { q, a: a || '…', claims: parseClaims(c, who, a) }
        return { ...g, chats: { ...g.chats, [who]: list } }
      })
    } catch (e) {
      setErr(`The suspect didn't answer: ${(e as Error).message}`)
      setGame((g) => ({ ...g, chats: { ...g.chats, [who]: (g.chats[who] ?? []).slice(0, -1) } }))
      setDraft(q)
    } finally {
      setBusy(false)
      setLive('')
    }
  }

  const togglePin = (text: string) =>
    setGame((g) => {
      const id = `${who}:${text.slice(0, 40)}`
      return { ...g, pins: g.pins.some((p) => p.id === id) ? g.pins.filter((p) => p.id !== id) : [...g.pins, { id, who, text }] }
    })
  const pinned = (text: string) => game.pins.some((p) => p.id === `${who}:${text.slice(0, 40)}`)
  const roomName = (id: string) => c.setting.rooms.find((r) => r.id === id)!.name

  return (
    <div className="interro">
      <aside className="cell">
        <span className="bulb" />
        <Portrait c={me} stress={stress} />
        <div>
          <h2>{me.name}</h2>
          <p className="role">
            {me.age}, {me.arch.role}
          </p>
          <div className="meta">
            {me.family && <span className="tag">{me.family}</span>}
            <span className="tag">{turns.length} questions</span>
          </div>
          <Pulse bpm={68 + stress * 70} />
        </div>
      </aside>

      <section>
        <div className="strip">
          {suspects.map((p) => (
            <button key={p.i} className={p.i === who ? 'on' : ''} onClick={() => setWho(p.i)} disabled={busy}>
              <Portrait c={p} />
              {p.first}
            </button>
          ))}
        </div>

        <div className="panel">
          <div className="transcript" aria-live="polite">
            {!turns.length && (
              <div className="empty">
                <h3>{me.first} sits down across from you.</h3>
                <p>Ask anything. Pin what matters. Times, rooms and who-was-with-whom go into your notebook automatically.</p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {turns.map((x, k) => {
                const isLive = k === turns.length - 1 && !x.a
                const text = isLive ? live : x.a
                return (
                  <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'contents' }}>
                    <div className="q">
                      <p>{x.q}</p>
                    </div>
                    <div className="a">
                      <Portrait c={me} stress={stress} />
                      <div>
                        <div className="who">{me.first}</div>
                        <p className={`said ${isLive ? 'typing' : ''}`}>{text}</p>
                        {!isLive && (
                          <>
                            {!!x.claims?.length && (
                              <div className="claimlets">
                                {x.claims.map((cl, j) => (
                                  <span key={j} className="claimlet">
                                    noted: {times[cl.t]} · {roomName(cl.room)}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="tools">
                              <button className={`mini ${pinned(x.a) ? 'on' : ''}`} onClick={() => togglePin(x.a)}>
                                {pinned(x.a) ? 'pinned' : 'pin to board'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div ref={end} />
          </div>

          <div className="ask">
            <div className="chips">
              <button className="chip" onClick={() => ask('Walk me through your evening.')} disabled={busy}>
                Walk me through your evening
              </button>
              <span className="chip">
                <button className="mini" style={{ border: 0, padding: 0, color: 'inherit', font: 'inherit' }} onClick={() => ask(`Where were you at ${times[t]}?`)} disabled={busy}>
                  Where were you at
                </button>{' '}
                <select value={t} onChange={(e) => setT(+e.target.value)} aria-label="time">
                  {times.map((x, k) => (
                    <option key={k} value={k}>
                      {x}
                    </option>
                  ))}
                </select>
                ?
              </span>
              <button className="chip" onClick={() => ask(`Who else was there with you at ${times[t]}?`)} disabled={busy}>
                Who was with you at {times[t]}?
              </button>
              <button className="chip" onClick={() => ask('Did you hear anything strange tonight?')} disabled={busy}>
                Hear anything?
              </button>
              <button className="chip" onClick={() => ask(`How well did you know ${victim.first}?`)} disabled={busy}>
                About {victim.first}
              </button>
              <button className="chip" onClick={() => ask(`Did you see ${c.murder.weapon.name} at any point tonight?`)} disabled={busy}>
                The weapon
              </button>
              <span className="chip">
                <button className="mini" style={{ border: 0, padding: 0, color: 'inherit', font: 'inherit' }} onClick={() => ask(`What do you make of ${c.cast[other].first}?`)} disabled={busy}>
                  What about
                </button>{' '}
                <select value={other} onChange={(e) => setOther(+e.target.value)} aria-label="suspect">
                  {suspects
                    .filter((p) => p.i !== who)
                    .map((p) => (
                      <option key={p.i} value={p.i}>
                        {p.first}
                      </option>
                    ))}
                </select>
                ?
              </span>
              {pins.length > 0 && (
                <span className="chip">
                  Confront with{' '}
                  <select value={pin} onChange={(e) => setPin(e.target.value)} aria-label="pinned statement">
                    <option value="">a pinned statement…</option>
                    {pins.map((p) => (
                      <option key={p.id} value={p.id}>
                        {c.cast[p.who].first}: {p.text.slice(0, 50)}…
                      </option>
                    ))}
                  </select>
                  <button
                    className="mini"
                    disabled={!pin || busy}
                    onClick={() => {
                      const p = pins.find((x) => x.id === pin)!
                      ask(`${c.cast[p.who].first} told me: "${p.text}" Explain that.`)
                      setPin('')
                    }}
                  >
                    go
                  </button>
                </span>
              )}
            </div>
            <div className="ask-row">
              <textarea
                value={draft}
                placeholder={`Ask ${me.first} anything…`}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    ask(draft)
                  }
                }}
                rows={1}
              />
              {busy ? (
                <button className="btn" onClick={() => stop.current?.abort()}>
                  Stop
                </button>
              ) : (
                <button className="btn red" onClick={() => ask(draft)} disabled={!draft.trim()}>
                  Ask
                </button>
              )}
            </div>
            {err && <div className="err">{err}</div>}
          </div>
        </div>
      </section>
    </div>
  )
}
