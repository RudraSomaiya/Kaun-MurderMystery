import { motion } from 'motion/react'
import { caseFacts, clock, type Case } from '../../../engine/src'
import type { Game } from '../App'
import { FloorPlan } from '../components/FloorPlan'
import { Portrait } from '../components/Portrait'

export function Dossier({ c, game, onPick }: { c: Case; game: Game; onPick: (i: number) => void }) {
  const f = caseFacts(c)
  const v = c.cast[c.victim]
  const by = c.cast[c.discovery.by]
  const suspects = c.cast.filter((p) => p.i !== c.victim)

  return (
    <>
      <div className="dossier">
        <motion.section className="folder" initial={{ rotate: -1.5, y: 20, opacity: 0 }} animate={{ rotate: 0, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 16 }}>
          <span className="stamp">Confidential</span>
          <div className="kicker">Case file · {c.setting.place}</div>
          <h2>{c.setting.title}</h2>
          <p className="blurb">{c.setting.blurb}</p>
          <div className="victim">
            <figure className="polaroid" style={{ margin: 0 }}>
              <div className="frame">
                <Portrait c={v} dead />
              </div>
              <figcaption>{v.name}</figcaption>
              <span className="stamp">Deceased</span>
            </figure>
            <dl className="facts">
              <div>
                <dt>Victim</dt>
                <dd>
                  {v.name}, {v.age}, {v.arch.role}.
                </dd>
              </div>
              <div>
                <dt>Found</dt>
                <dd>
                  In the {f.room} at {clock(c.setting.start, c.discovery.step)}, by {by.name}.
                </dd>
              </div>
              <div>
                <dt>At the scene</dt>
                <dd>{c.murder.weapon.found}</dd>
              </div>
              <div>
                <dt>Time of death</dt>
                <dd className="unknown">Unknown. Somebody heard something.</dd>
              </div>
            </dl>
          </div>
        </motion.section>

        <motion.section className="panel plan-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <div className="kicker" style={{ marginBottom: 12 }}>
            <span>Floor plan</span>
            <span>{c.setting.occasion}</span>
          </div>
          <FloorPlan s={c.setting} murder={c.murder.room} />
          <p className="fineprint" style={{ marginTop: 12 }}>
            Rooms that share a wall can hear each other. Hatched rooms are out of the way: good for secrets, good for murder. The evening started at {c.setting.start}.
          </p>
        </motion.section>
      </div>

      <section className="lineup-wrap">
        <div className="lineup-head">
          <div>
            <div className="kicker">The line-up</div>
            <h3>Six people were in the house. Pick one to question.</h3>
          </div>
        </div>
        <div className="lineup">
          {suspects.map((p, k) => (
            <motion.button key={p.i} className="suspect" onClick={() => onPick(p.i)} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + k * 0.06 }}>
              <Portrait c={p} />
              <div className="placard">
                {(game.chats[p.i]?.length ?? 0) > 0 && <span className="asked">{game.chats[p.i].length} Q</span>}
                <b>{p.name}</b>
                <small>{p.arch.role}</small>
              </div>
            </motion.button>
          ))}
        </div>
      </section>
    </>
  )
}
