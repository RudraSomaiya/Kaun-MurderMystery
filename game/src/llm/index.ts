import type { AppConfig, MLCEngineInterface } from '@mlc-ai/web-llm'
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
type Status = { state: 'idle' | 'loading' | 'ready' | 'error'; progress: number; text: string; model: string; gpu: string }
let status: Status = { state: 'idle', progress: 0, text: '', model: '', gpu: '' }

// On laptops with two GPUs, Windows gives browsers the integrated one, and pages can't ask for the other.
// The Qwen3.5 kernels break there: the device is lost, or every logit is NaN and the reply is "!!!!!!".
export const gpuHelp = () =>
  `The model broke on this GPU (${status.gpu || 'unknown'}). On laptops this is usually the integrated chip. ` +
  'Fix: Windows Settings → System → Display → Graphics → pick your browser → High performance, then restart the browser. ' +
  'If you are already on the dedicated GPU, clear this site’s data to re-download the model, or use a local server (top right).'
// Chromium 137's WebGPU miscompiles these kernels into NaNs; 156 is fine. The exact cutoff in between is unknown.
const chromium = Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? 0)
const junkHelp = () =>
  chromium && chromium < 150
    ? `The model produced junk because this browser is out of date (Chromium ${chromium}); older WebGPU versions break it. Update your browser (tested on version 156), then reload.`
    : `The model produced junk on ${status.gpu || 'this GPU'}. I cleared its download: ask again and it will download fresh (~430 MB). ` +
      'If it happens again, your browser is on the integrated GPU: Windows Settings → System → Display → Graphics → your browser → High performance.'
// a lost device surfaces under several names, depending on which call notices first
const gpuBroke = (m: string) => /device|instance reference|already been disposed|OperationError|ModelNotLoaded/i.test(m)
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
let appConfig: AppConfig | undefined
let loading: Promise<MLCEngineInterface> | null = null

export function load(model: string) {
  if (status.model === model && loading) return loading
  set({ state: 'loading', progress: 0, text: 'Opening the case files…', model })
  loading = (async () => {
    const a = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' })
    set({ gpu: a ? [a.info.vendor, a.info.architecture].filter(Boolean).join(' ') : '' })
    const webllm = await import('@mlc-ai/web-llm')
    const base = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === BASE)!
    const ours = WEB_MODELS.flatMap((m) => (m.path ? [{ ...base, model_id: m.id, model: new URL(m.path, location.href).href }] : []))
    appConfig = { ...webllm.prebuiltAppConfig, model_list: [...webllm.prebuiltAppConfig.model_list, ...ours] }
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
    const msg = String(e?.message ?? e)
    set({ state: 'error', text: gpuBroke(msg) ? gpuHelp() : msg })
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
    try {
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
        if (/([^\p{L}\s])\1{9}/u.test(full)) {
          // NaN logits decode as token 0, "!", forever. Besides a bad GPU, the cause can be a stale
          // download (WebLLM caches by URL and never rechecks), so drop it and fetch fresh next time.
          e.interruptGenerate()
          const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm')
          await deleteModelAllInfoInCache(cfg.model, appConfig).catch(() => {})
          loading = null
          set({ state: 'idle', model: '' })
          throw new Error(junkHelp())
        }
      }
    } catch (err) {
      const msg = String((err as Error)?.message ?? err)
      throw new Error(gpuBroke(msg) ? gpuHelp() : msg)
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
