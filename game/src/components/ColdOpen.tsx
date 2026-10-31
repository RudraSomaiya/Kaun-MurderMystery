import { motion } from 'motion/react'
import { useEffect } from 'react'
import { caseFacts, clock, type Case } from '../../../engine/src'

// A few seconds of black screen and type before the case file opens. Click to skip.
export function ColdOpen({ c, onDone }: { c: Case; onDone: () => void }) {
  const f = caseFacts(c)
  const lines = [
    `${c.setting.place.split(',').slice(-1)[0].trim()} · ${clock(c.setting.start, c.discovery.step)}`,
    c.setting.occasion[0].toUpperCase() + c.setting.occasion.slice(1) + '.',
    `${f.victim.first} was found in the ${f.room}.`,
    'Six people were in the house. One of them did it.',
  ]
  useEffect(() => {
    const id = setTimeout(onDone, 5600)
    return () => clearTimeout(id)
  }, [])

  return (
    <motion.div className="cold-open" onClick={onDone} initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }}>
      {lines.map((l, k) => (
        <motion.p key={k} className={k === 0 ? 'kicker' : k === lines.length - 1 ? 'last' : ''} initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.3 + k * 1.1, duration: 0.7 }}>
          {l}
        </motion.p>
      ))}
      <motion.span className="skip" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1.2 }}>
        click to skip
      </motion.span>
    </motion.div>
  )
}
