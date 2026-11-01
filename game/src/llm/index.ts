import type { MLCEngineInterface } from '@mlc-ai/web-llm'
import { useSyncExternalStore } from 'react'

export type Msg = { role: 'system' | 'user' | 'assistant'; content: string }
export type Config = { kind: 'webllm'; model: string } | { kind: 'openai'; baseURL: string; model: string; key: string }

const BASE = 'Qwen3.5-0.8B-q4f16_1-MLC'
export const WEB_MODELS = [
  // weights are served next to the game in dev, or from Hugging Face when VITE_KAUN_MODEL_URL is set
  { id: 'kaun-0.8b', label: 'Kaun 0.8B · fine-tuned (SFT + RL)', size: '≈ 430 MB', path: import.meta.env.VITE_KAUN_MODEL_URL || 'models/kaun-0.8b/resolve/main/' },
  { id: 'kaun-0.8b-sft', label: 'Kaun 0.8B · before RL (SFT only)', size: '≈ 430 MB', path: import.meta.env.VITE_KAUN_SFT_URL || 'models/kaun-0.8b-sft/resolve/main/' },
  { id: BASE, label: 'Qwen3.5 0.8B · base', size: '≈ 430 MB' },
  { id: 'Qwen3.5-2B-q4f16_1-MLC', label: 'Qwen3.5 2B · base', size: '≈ 1.3 GB' },
  { id: 'Qwen3-1.7B-q4f16_1-MLC', label: 'Qwen3 1.7B · base', size: '≈ 1.1 GB' },
]

export const PRESETS: { label: string; cfg: Config }[] = [
  { label: 'Ollama', cfg: { kind: 'openai', baseURL: 'http://localhost:11434/v1', model: 'qwen2.5:7b', key: '' } },
  { label: 'LM Studio', cfg: { kind: 'openai', baseURL: 'http://localhost:1234/v1', model: 'local-model', key: '' } },
  ...(import.meta.env.DEV ? [{ label: 'Groq (dev proxy)', cfg: { kind: 'openai' as const, baseURL: '/groq/openai/v1', model: 'openai/gpt-oss-20b', key: '' } }] : []),
]

// --- loading state, shared with React through useSyncExternalStore
type Status = { state: 'idle' | 'loading' | 'ready' | 'error'; progress: number; text: string; model: string }
let status: Status = { state: 'idle', progress: 0, text: '', model: '' }
const subs = new Set<() => void>()
const set = (s: Partial<Status>) => {
  status = { ...status, ...s }
  subs.forEach((f) => f())
}
export const useStatus = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => status,
  )

export const hasWebGPU = () => typeof navigator !== 'undefined' && 'gpu' in navigator

export async function customModelAvailable(path: string) {
  try {
    const r = await fetch(`${path}mlc-chat-config.json`, { method: 'HEAD' })
    return r.ok && !r.headers.get('content-type')?.includes('html')
  } catch {
    return false
  }
}

let engine: MLCEngineInterface | null = null
let loading: Promise<MLCEngineInterface> | null = null

export function load(model: string) {
  if (status.model === model && loading) return loading
  set({ state: 'loading', progress: 0, text: 'Opening the case files…', model })
  loading = (async () => {
    const webllm = await import('@mlc-ai/web-llm')
    const base = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === BASE)!
    const ours = WEB_MODELS.flatMap((m) => (m.path ? [{ ...base, model_id: m.id, model: new URL(m.path, location.href).href }] : []))
    const appConfig = { ...webllm.prebuiltAppConfig, model_list: [...webllm.prebuiltAppConfig.model_list, ...ours] }
    const initProgressCallback = (p: { progress: number; text: string }) => set({ progress: p.progress, text: p.text })
    // the prebuilt configs ask for a 262k context, i.e. gigabytes of KV cache; one suspect's chat fits in 4k
    const chatOpts = { context_window_size: 4096, prefill_chunk_size: 1024 }
    if (!engine) {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
      engine = await webllm.CreateWebWorkerMLCEngine(worker, model, { appConfig, initProgressCallback }, chatOpts)
    } else {
      engine.setInitProgressCallback(initProgressCallback)
      await engine.reload(model, chatOpts)
    }
    set({ state: 'ready', progress: 1, text: 'Ready' })
    return engine
  })().catch((e) => {
    set({ state: 'error', text: String(e?.message ?? e) })
    loading = null
    throw e
  })
  return loading
}

export function clean(s: string, name: string) {
  return s
    .replace(/<think>[\s\S]*?(<\/think>|$)/g, '')
    .replace(new RegExp(`^\\s*\\**${name}\\**\\s*:\\s*`, 'i'), '')
    .replace(/^\s*["“]|["”]\s*$/g, '')
    .trim()
}

export async function reply(cfg: Config, messages: Msg[], name: string, onText: (s: string) => void, signal?: AbortSignal) {
  let full = ''
  const emit = (d: string) => {
    full += d
    onText(clean(full, name))
  }
  if (cfg.kind === 'webllm') {
    const e = await load(cfg.model)
    const stream = await e.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 160,
      extra_body: { enable_thinking: false },
    })
    for await (const ch of stream) {
      if (signal?.aborted) {
        e.interruptGenerate()
        break
      }
      emit(ch.choices[0]?.delta?.content ?? '')
    }
  } else {
    const r = await fetch(`${cfg.baseURL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {}) },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: cfg.model.includes('gpt-oss') ? 700 : 200,
        ...(cfg.model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
      }),
      signal,
    })
    if (!r.ok || !r.body) throw new Error(`${r.status} ${await r.text()}`)
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader()
    let buf = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += value
      const lines = buf.split('\n')
      buf = lines.pop()!
      for (const l of lines) {
        const d = l.startsWith('data:') ? l.slice(5).trim() : ''
        if (!d || d === '[DONE]') continue
        try {
          emit(JSON.parse(d).choices?.[0]?.delta?.content ?? '')
        } catch {
          // keep-alive or partial line
        }
      }
    }
  }
  return clean(full, name)
}
