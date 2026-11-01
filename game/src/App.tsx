import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { content } from '../../content'
import { generateCase } from '../../engine/src'
import { Atmosphere } from './components/Atmosphere'
import { ColdOpen } from './components/ColdOpen'
import { EnginePill, LoadingCard } from './components/Engine'
import { customModelAvailable, hasWebGPU, load, PRESETS, WEB_MODELS, type Config } from './llm'
import type { Claim } from './read'
import { Accuse } from './screens/Accuse'
import { Dossier } from './screens/Dossier'
import { Interrogation } from './screens/Interrogation'
import { Notebook } from './screens/Notebook'
import { Title } from './screens/Title'

export type Turn = { q: string; a: string; claims?: Claim[] }
export type Game = {
  seed: string
  chats: Record<number, Turn[]>
  nerves: Record<number, number>
  marks: Record<string, string>
  pins: { id: string; who: number; text: string }[]
  accused?: { who: number; t?: number; room?: string }
}
export type SetGame = (f: (g: Game) => Game) => void

type Tab = 'dossier' | 'interrogate' | 'notebook' | 'accuse'
const TABS: [Tab, string][] = [
  ['dossier', 'Dossier'],
  ['interrogate', 'Interrogate'],
  ['notebook', 'Notebook'],
  ['accuse', 'Accuse'],
]

const read = <T,>(k: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null')
  } catch {
    return null
  }
}
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    // private mode; the game still works, it just won't survive a refresh
  }
}

export const settingOf = (seed: string) => content.settings.find((s) => s.id.slice(0, 3).toUpperCase() === seed.slice(0, 3))?.id

export const newSeed = (setting?: string) => {
  const s = setting ?? content.settings[Math.floor(Math.random() * content.settings.length)].id
  const code = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('')
  return `${s.slice(0, 3).toUpperCase()}-${code}`
}

export default function App() {
  const [game, setGameRaw] = useState<Game | null>(() => read('kaun:game'))
  const [tab, setTab] = useState<Tab | 'title'>(() => (read('kaun:game') ? 'dossier' : 'title'))
  const [who, setWho] = useState<number | null>(null)
  const [intro, setIntro] = useState(false)
  const savedCfg = useRef(read<Config>('kaun:engine'))
  const [cfg, setCfgRaw] = useState<Config>(() => savedCfg.current ?? (hasWebGPU() ? { kind: 'webllm', model: WEB_MODELS.find((m) => !m.path)!.id } : PRESETS[0].cfg))

  const c = useMemo(() => (game ? generateCase(content, game.seed, settingOf(game.seed)) : null), [game?.seed])
  const setGame: SetGame = (f) => setGameRaw((g) => (g ? f(g) : g))
  const setCfg = (x: Config) => {
    setCfgRaw(x)
    write('kaun:engine', x)
  }

  useEffect(() => {
    write('kaun:game', game)
  }, [game])
  useEffect(() => {
    // prefer the fine-tuned model when its weights are being served next to the game
    if (!savedCfg.current && hasWebGPU()) customModelAvailable(WEB_MODELS[0].path!).then((ok) => ok && setCfgRaw({ kind: 'webllm', model: WEB_MODELS[0].id }))
  }, [])
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  const start = (seed: string) => {
    setGameRaw({ seed, chats: {}, nerves: {}, marks: {}, pins: [] })
    setWho(null)
    setTab('dossier')
    setIntro(true)
    if (cfg.kind === 'webllm') load(cfg.model).catch(() => {})
  }
  const interrogate = (i: number) => {
    setWho(i)
    setTab('interrogate')
  }

  return (
    <>
      <Atmosphere />
      {tab === 'title' || !game || !c ? (
        <Title onStart={start} resume={game && c ? () => setTab('dossier') : undefined} engine={<EnginePill cfg={cfg} setCfg={setCfg} />} />
      ) : (
        <div className="shell">
          <header className="topbar">
            <div className="brand">
              <button onClick={() => setTab('title')} title="Back to the title screen">
                कौन?
              </button>
              <span className="kicker">Case {game.seed}</span>
              <span className="case-title">{c.setting.title}</span>
            </div>
            <nav className="tabs">
              {TABS.map(([id, label]) => (
                <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                  {tab === id && <motion.span layoutId="tab" className="tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="topbar-right">
              <EnginePill cfg={cfg} setCfg={setCfg} />
            </div>
          </header>
          <motion.main key={tab} className="page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {tab === 'dossier' && <Dossier c={c} game={game} onPick={interrogate} />}
            {tab === 'interrogate' && <Interrogation c={c} game={game} setGame={setGame} cfg={cfg} who={who ?? c.cast.find((p) => p.i !== c.victim)!.i} setWho={setWho} />}
            {tab === 'notebook' && <Notebook c={c} game={game} setGame={setGame} onPick={interrogate} />}
            {tab === 'accuse' && <Accuse c={c} game={game} setGame={setGame} onNew={() => start(newSeed())} onReplay={() => start(game.seed)} />}
          </motion.main>
        </div>
      )}
      <AnimatePresence>{intro && c && <ColdOpen c={c} onDone={() => setIntro(false)} />}</AnimatePresence>
      <LoadingCard />
    </>
  )
}
