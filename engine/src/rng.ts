export type Rng = ReturnType<typeof makeRng>

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// mulberry32
export function makeRng(seed: number | string) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(seed)
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1))
  const pick = <T>(xs: readonly T[]): T => {
    if (!xs.length) throw new Error('pick from empty list')
    return xs[Math.floor(next() * xs.length)]
  }
  const shuffle = <T>(xs: readonly T[]): T[] => {
    const r = [...xs]
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[r[i], r[j]] = [r[j], r[i]]
    }
    return r
  }
  const chance = (p: number) => next() < p
  return { next, int, pick, shuffle, chance }
}
