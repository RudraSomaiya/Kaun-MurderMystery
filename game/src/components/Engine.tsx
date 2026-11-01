import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { customModelAvailable, hasWebGPU, load, PRESETS, useStatus, WEB_MODELS, type Config } from '../llm'

const label = (cfg: Config) => (cfg.kind === 'webllm' ? (WEB_MODELS.find((m) => m.id === cfg.model)?.label ?? cfg.model) : `${cfg.model} · server`)

export function EnginePill({ cfg, setCfg }: { cfg: Config; setCfg: (c: Config) => void }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const st = useStatus()
  const gpu = hasWebGPU()
  useEffect(() => {
    customModelAvailable().then(setCustom)
  }, [])
  const dot = cfg.kind === 'openai' ? 'ready' : st.model === cfg.model ? st.state : 'idle'

  return (
    <div style={{ position: 'relative' }}>
      <button className="engine-pill" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`dot ${dot}`} />
        <span>
          <span className="kicker" style={{ marginRight: 8 }}>
            Suspects
          </span>
          <span className="engine-label">{label(cfg)}</span>
        </span>
        <span className="mini">change</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="engine-pop panel" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <div className="kicker">Who voices the suspects</div>
            <div className="seg">
              <button className={cfg.kind === 'webllm' ? 'on' : ''} disabled={!gpu} onClick={() => setCfg({ kind: 'webllm', model: custom ? WEB_MODELS[0].id : WEB_MODELS[1].id })}>
                In this browser
              </button>
              <button className={cfg.kind === 'openai' ? 'on' : ''} onClick={() => setCfg(PRESETS[0].cfg)}>
                Local server
              </button>
            </div>
            {!gpu && <div className="fineprint">This browser has no WebGPU. Use Chrome or Edge, or point the game at a local server such as Ollama.</div>}
            {cfg.kind === 'webllm' ? (
              <>
                <label>
                  Model (downloaded once, then cached)
                  <select value={cfg.model} onChange={(e) => setCfg({ kind: 'webllm', model: e.target.value })}>
                    {WEB_MODELS.map((m) => (
                      <option key={m.id} value={m.id} disabled={!!m.path && !custom}>
                        {m.label} · {m.size}
                        {m.path && !custom ? ' (not published yet)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn" onClick={() => load(cfg.model).catch(() => {})} disabled={st.state === 'loading'}>
                  {st.model === cfg.model && st.state === 'ready' ? 'Loaded' : 'Load now'}
                </button>
                {st.state === 'error' && st.model === cfg.model && <div className="err">{st.text}</div>}
              </>
            ) : (
              <>
                <div className="chips">
                  {PRESETS.map((p) => (
                    <button key={p.label} className="chip" onClick={() => setCfg(p.cfg)}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <label>
                  Base URL (OpenAI-compatible)
                  <input value={cfg.baseURL} onChange={(e) => setCfg({ ...cfg, baseURL: e.target.value })} />
                </label>
                <label>
                  Model
                  <input value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} />
                </label>
                <label>
                  API key (optional, stays in this browser)
                  <input type="password" value={cfg.key} onChange={(e) => setCfg({ ...cfg, key: e.target.value })} />
                </label>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function LoadingCard() {
  const st = useStatus()
  return (
    <AnimatePresence>
      {st.state === 'loading' && (
        <motion.div className="loading-card panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
          <div className="row">
            <span>Bringing the suspects in…</span>
            <span>{Math.round(st.progress * 100)}%</span>
          </div>
          <div className="progress">
            <i style={{ width: `${st.progress * 100}%` }} />
          </div>
          <small>{st.text}</small>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
