import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { content } from '../../../content'
import { newSeed, settingOf } from '../App'

export function Title({ onStart, resume, engine }: { onStart: (seed: string) => void; resume?: () => void; engine: ReactNode }) {
  const [code, setCode] = useState('')
  const valid = /^[A-Z]{3}-[A-Z0-9]{5}$/.test(code) && !!settingOf(code)

  return (
    <div className="title-screen">
      <div className="title-top">
        <span className="kicker">Crime Branch · Night Desk</span>
        {engine}
      </div>

      <div>
        <div className="title-hero">
          <h1 className="wordmark" aria-label="Kaun?">
            {['कौ', 'न', '?'].map((ch, k) => (
              <motion.span key={ch} className={ch === '?' ? 'q' : ''} initial={{ y: -80, opacity: 0, rotate: -8 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ delay: 0.15 + k * 0.14, type: 'spring', stiffness: 220, damping: 14 }}>
                {ch}
              </motion.span>
            ))}
          </h1>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            <div className="kicker subline">Kaun? · Who did it?</div>
            <p className="tagline">
              Every night, a new murder. Six suspects who remember it differently. <em>One of them is lying about where they were.</em>
            </p>
          </motion.div>
        </div>

        <div className="posters">
          {content.settings.map((s, k) => (
            <motion.button
              key={s.id}
              className={`poster ${s.id}`}
              onClick={() => onStart(newSeed(s.id))}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + k * 0.08 }}
              whileHover={{ y: -8, rotate: k % 2 ? 1.2 : -1.2 }}
            >
              <span className="num">NO. 0{k + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.place.split(',').slice(-2).join(',').trim()}</p>
              <span className="open">Open the case →</span>
            </motion.button>
          ))}
          <motion.button className="poster surprise" onClick={() => onStart(newSeed())} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 + content.settings.length * 0.08 }} whileHover={{ y: -8 }}>
            <span className="bigq">?</span>
            <h3>Surprise me</h3>
            <p>Any place, any night</p>
            <span className="open">Roll the dice →</span>
          </motion.button>
        </div>
      </div>

      <div className="title-foot">
        <p className="fineprint">
          Every case is simulated from scratch: where everyone went, who saw whom, who heard what. The suspects are voiced by a small language model running on your own GPU, trained to keep their secrets and keep their lies straight.
        </p>
        <div className="seed-form">
          {resume && (
            <button className="btn" onClick={resume}>
              Resume case
            </button>
          )}
          <input placeholder="SHA-7Q2MX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().trim())} aria-label="Case number" />
          <button className="btn" disabled={!valid} onClick={() => onStart(code)}>
            Open case no.
          </button>
        </div>
      </div>
    </div>
  )
}
