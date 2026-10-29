import { useMemo } from 'react'
import { makeRng, type Character } from '../../../engine/src'

const SKIN = ['#f0c8a2', '#dfaa7e', '#c98d61', '#ab7249', '#8b5a3a', '#6c432c']
const CLOTH = ['#8b1e3f', '#1f4e5f', '#b8862b', '#2f5d3a', '#4b2e83', '#a8452a', '#e6dfd0', '#1c1b1d', '#b8436f', '#355c7d']
const HAIR = ['#151110', '#1f1612', '#2b1d16', '#3a2a1f']

type Look = ReturnType<typeof design>

function design(c: Character) {
  const r = makeRng(`face:${c.name}:${c.arch.id}`)
  const role = c.arch.role.toLowerCase()
  const old = c.age >= 55
  const f = c.gender === 'f'
  return {
    f,
    skin: r.pick(SKIN),
    cloth: r.pick(CLOTH),
    cloth2: r.pick(CLOTH),
    hair: old && r.chance(0.75) ? r.pick(['#8f8a84', '#a7a29b', '#6f6a64']) : r.pick(HAIR),
    faceW: r.int(48, 57),
    faceH: r.int(60, 68),
    jaw: r.int(0, 2),
    style: f ? r.pick(old ? ['bun', 'bun', 'long'] : ['long', 'bun', 'braid', 'bob', 'pixie']) : r.pick(old ? ['receding', 'short', 'side'] : ['short', 'side', 'curly', 'spiky']),
    stache: !f && (old || r.chance(0.45)) ? r.pick(['thin', 'full', 'handlebar']) : null,
    beard: !f && r.chance(0.3) ? r.pick(['stubble', 'full']) : null,
    bindi: f && r.chance(0.55),
    stud: f && r.chance(0.5),
    jhumka: f && r.chance(0.6),
    glasses: /professor|phd|lawyer|topper|writer|pandit|warden|planner/.test(role) ? r.chance(0.8) : r.chance(0.15),
    shades: /superstar|influencer|crypto|star kid/.test(role),
    headphones: /\bdj\b/.test(role),
    tilak: /pandit/.test(role),
    cap: /guard/.test(role),
    neck: f ? r.pick(['saree', 'kurta', 'round']) : r.pick(['kurta', 'collar', 'round']),
    brow: r.int(3, 5),
    mouth: r.pick(['flat', 'smile', 'smirk']),
    eyeGap: r.int(19, 23),
  }
}

function HairBack({ l }: { l: Look }) {
  if (l.style === 'long') return <path d="M44 100 Q40 40 100 34 Q160 40 156 100 L160 200 Q100 214 40 200 Z" fill={l.hair} />
  if (l.style === 'braid') return <path d="M140 120 Q160 160 150 214 L138 214 Q146 160 128 128 Z" fill={l.hair} />
  if (l.style === 'bun') return <circle cx="100" cy="40" r="20" fill={l.hair} />
  return null
}

function HairFront({ l }: { l: Look }) {
  const h = l.hair
  switch (l.style) {
    case 'long':
    case 'braid':
    case 'bun':
      return <path d="M50 96 Q48 44 100 40 Q152 44 150 96 Q136 62 103 58 L100 66 L97 58 Q64 62 50 96 Z" fill={h} />
    case 'bob':
      return <path d="M46 130 Q38 42 100 38 Q162 42 154 130 L142 132 Q144 76 100 62 Q56 76 58 132 Z" fill={h} />
    case 'pixie':
      return <path d="M50 92 Q50 40 104 40 Q152 44 150 88 Q128 60 84 70 Q62 74 50 92 Z" fill={h} />
    case 'side':
      return <path d="M48 92 Q46 40 104 40 Q154 42 152 90 Q146 64 120 60 Q86 54 62 72 Q54 80 48 92 Z" fill={h} />
    case 'curly':
      return (
        <g fill={h}>
          {[56, 70, 84, 100, 116, 130, 144].map((x, k) => (
            <circle key={x} cx={x} cy={k % 2 ? 50 : 58} r="15" />
          ))}
        </g>
      )
    case 'spiky':
      return <path d="M48 86 L52 52 L64 60 L70 38 L84 52 L96 32 L106 50 L120 34 L128 54 L142 44 L146 62 L152 86 Q130 64 100 62 Q70 64 48 86 Z" fill={h} />
    case 'receding':
      return (
        <g fill={h}>
          <path d="M46 104 Q44 70 58 60 L62 92 Z" />
          <path d="M154 104 Q156 70 142 60 L138 92 Z" />
        </g>
      )
    default:
      return <path d="M48 88 Q46 40 100 40 Q154 40 152 88 Q140 62 100 60 Q60 62 48 88 Z" fill={h} />
  }
}

function Neckline({ l }: { l: Look }) {
  if (l.neck === 'saree')
    return (
      <g>
        <path d="M18 240 Q24 186 70 172 L100 186 L130 172 Q176 186 182 240 Z" fill={l.cloth} />
        <path d="M130 172 Q150 178 160 196 L76 240 L52 240 Z" fill={l.cloth2} opacity="0.92" />
        <path d="M128 176 L62 240" stroke="#e8c26a" strokeWidth="3" opacity="0.7" />
      </g>
    )
  if (l.neck === 'kurta')
    return (
      <g>
        <path d="M18 240 Q24 186 72 172 L100 180 L128 172 Q176 186 182 240 Z" fill={l.cloth} />
        <path d="M92 176 L92 214 M108 176 L108 214" stroke="rgba(0,0,0,.25)" strokeWidth="2" />
        <rect x="88" y="170" width="24" height="9" rx="2" fill={l.cloth} stroke="rgba(0,0,0,.3)" />
        {[188, 200, 212].map((y) => (
          <circle key={y} cx="100" cy={y} r="2" fill="#e8c26a" />
        ))}
      </g>
    )
  if (l.neck === 'collar')
    return (
      <g>
        <path d="M18 240 Q24 186 72 172 L100 200 L128 172 Q176 186 182 240 Z" fill={l.cloth} />
        <path d="M74 170 L100 202 L86 208 L66 178 Z M126 170 L100 202 L114 208 L134 178 Z" fill="#efe8dc" />
      </g>
    )
  return <path d="M18 240 Q24 186 74 172 Q100 188 126 172 Q176 186 182 240 Z" fill={l.cloth} />
}

export function Portrait({ c, stress = 0, dead = false, className }: { c: Character; stress?: number; dead?: boolean; className?: string }) {
  const l = useMemo(() => design(c), [c])
  const id = `p${c.i}${c.first}`
  const cx = 100
  const cy = 112
  const eyeY = cy - 4
  const look = stress > 0.55 ? (Math.floor(Date.now() / 1500) % 2 ? 3 : -3) : 0
  const browTilt = Math.min(1, stress) * 6
  const mouth =
    stress > 0.6 ? `M${cx - 12} ${cy + 36} Q${cx} ${cy + 30} ${cx + 12} ${cy + 36}`
    : l.mouth === 'smile' ? `M${cx - 13} ${cy + 31} Q${cx} ${cy + 39} ${cx + 13} ${cy + 31}`
    : l.mouth === 'smirk' ? `M${cx - 12} ${cy + 34} Q${cx + 2} ${cy + 36} ${cx + 13} ${cy + 30}`
    : `M${cx - 11} ${cy + 33} L${cx + 11} ${cy + 33}`
  const jaw = [`Q${cx + l.faceW + 4} ${cy + l.faceH}`, `Q${cx + l.faceW} ${cy + l.faceH + 8}`, `Q${cx + l.faceW - 6} ${cy + l.faceH + 14}`][l.jaw]

  return (
    <svg viewBox="0 0 200 240" className={`portrait ${dead ? 'dead' : ''} ${className ?? ''}`} aria-label={`Portrait of ${c.name}`}>
      <defs>
        <linearGradient id={`${id}-light`} x1="0" x2="1">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.42" />
        </linearGradient>
        <clipPath id={`${id}-face`}>
          <path d={`M${cx - l.faceW} ${cy - 10} Q${cx - l.faceW} ${cy - l.faceH} ${cx} ${cy - l.faceH} Q${cx + l.faceW} ${cy - l.faceH} ${cx + l.faceW} ${cy - 10} ${jaw} ${cx} ${cy + l.faceH} Q${cx - l.faceW + 6} ${cy + l.faceH + 6} ${cx - l.faceW} ${cy - 10} Z`} />
        </clipPath>
      </defs>
      <HairBack l={l} />
      <Neckline l={l} />
      <rect x={cx - 16} y={cy + 40} width="32" height="36" fill={l.skin} />
      <rect x={cx - 16} y={cy + 40} width="32" height="36" fill="#000" opacity="0.18" />
      {l.headphones && <path d="M58 178 Q100 206 142 178" stroke="#111" strokeWidth="10" fill="none" />}
      <ellipse cx={cx - l.faceW + 2} cy={cy + 2} rx="8" ry="12" fill={l.skin} />
      <ellipse cx={cx + l.faceW - 2} cy={cy + 2} rx="8" ry="12" fill={l.skin} />
      {l.jhumka && (
        <g fill="#e2b04a">
          <circle cx={cx - l.faceW + 2} cy={cy + 18} r="3" />
          <path d={`M${cx - l.faceW - 4} ${cy + 28} Q${cx - l.faceW + 2} ${cy + 18} ${cx - l.faceW + 8} ${cy + 28} Z`} />
          <circle cx={cx + l.faceW - 2} cy={cy + 18} r="3" />
          <path d={`M${cx + l.faceW - 8} ${cy + 28} Q${cx + l.faceW - 2} ${cy + 18} ${cx + l.faceW + 4} ${cy + 28} Z`} />
        </g>
      )}
      <g clipPath={`url(#${id}-face)`}>
        <rect x="0" y="0" width="200" height="240" fill={l.skin} />
        {l.beard === 'full' && <path d={`M${cx - l.faceW} ${cy + 6} Q${cx} ${cy + 120} ${cx + l.faceW} ${cy + 6} L${cx + l.faceW} ${cy + 90} L${cx - l.faceW} ${cy + 90} Z`} fill={l.hair} opacity="0.92" />}
        {l.beard === 'stubble' && <path d={`M${cx - l.faceW} ${cy + 14} Q${cx} ${cy + 110} ${cx + l.faceW} ${cy + 14} L${cx + l.faceW} ${cy + 90} L${cx - l.faceW} ${cy + 90} Z`} fill={l.hair} opacity="0.28" />}
        <rect x="0" y="0" width="200" height="240" fill={`url(#${id}-light)`} />
      </g>
      <g className="eyes">
        <g className="blink">
          {[-1, 1].map((s) => (
            <g key={s}>
              <ellipse cx={cx + s * l.eyeGap} cy={eyeY} rx="8.5" ry="5.5" fill="#f4efe6" />
              <circle cx={cx + s * l.eyeGap + look} cy={eyeY} r="4" fill="#1b120d" />
              <circle cx={cx + s * l.eyeGap + look + 1.4} cy={eyeY - 1.4} r="1.2" fill="#fff" opacity="0.8" />
            </g>
          ))}
        </g>
        {[-1, 1].map((s) => (
          <path
            key={s}
            d={`M${cx + s * (l.eyeGap - 11)} ${eyeY - 12} L${cx + s * (l.eyeGap + 11)} ${eyeY - 13}`}
            transform={`rotate(${s * -browTilt} ${cx + s * l.eyeGap} ${eyeY - 12})`}
            stroke={l.hair === '#8f8a84' || l.hair === '#a7a29b' ? '#6a645e' : '#1b1310'}
            strokeWidth={l.brow}
            strokeLinecap="round"
          />
        ))}
      </g>
      <path d={`M${cx - 2} ${eyeY + 4} Q${cx - 7} ${cy + 18} ${cx - 4} ${cy + 21} Q${cx} ${cy + 23} ${cx + 5} ${cy + 20}`} stroke="rgba(60,30,20,.55)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {l.stache === 'thin' && <path d={`M${cx - 13} ${cy + 28} Q${cx} ${cy + 22} ${cx + 13} ${cy + 28}`} stroke={l.hair} strokeWidth="4" fill="none" strokeLinecap="round" />}
      {l.stache === 'full' && <path d={`M${cx - 18} ${cy + 31} Q${cx - 10} ${cy + 20} ${cx} ${cy + 25} Q${cx + 10} ${cy + 20} ${cx + 18} ${cy + 31} Q${cx} ${cy + 27} ${cx - 18} ${cy + 31} Z`} fill={l.hair} />}
      {l.stache === 'handlebar' && <path d={`M${cx - 24} ${cy + 24} Q${cx - 22} ${cy + 33} ${cx - 10} ${cy + 27} Q${cx} ${cy + 22} ${cx + 10} ${cy + 27} Q${cx + 22} ${cy + 33} ${cx + 24} ${cy + 24} Q${cx + 20} ${cy + 36} ${cx} ${cy + 29} Q${cx - 20} ${cy + 36} ${cx - 24} ${cy + 24} Z`} fill={l.hair} />}
      <path d={mouth} stroke="#6b2a22" strokeWidth="3" fill="none" strokeLinecap="round" />
      <HairFront l={l} />
      {l.cap && <path d={`M${cx - 54} ${cy - 40} Q${cx} ${cy - 92} ${cx + 54} ${cy - 40} L${cx + 70} ${cy - 34} L${cx - 54} ${cy - 34} Z`} fill="#2b3442" />}
      {l.tilak && <path d={`M${cx - 4} ${eyeY - 34} L${cx - 4} ${eyeY - 18} M${cx + 4} ${eyeY - 34} L${cx + 4} ${eyeY - 18}`} stroke="#e8e0d0" strokeWidth="3" />}
      {l.tilak && <circle cx={cx} cy={eyeY - 20} r="3" fill="#c8261c" />}
      {l.bindi && <circle cx={cx} cy={eyeY - 20} r="3.4" fill="#b3121a" />}
      {l.stud && <circle cx={cx + 8} cy={cy + 19} r="1.8" fill="#f1d27a" />}
      {l.glasses && (
        <g stroke="#15100d" strokeWidth="2.6" fill="rgba(255,255,255,.08)">
          <rect x={cx - l.eyeGap - 13} y={eyeY - 10} width="26" height="19" rx="6" />
          <rect x={cx + l.eyeGap - 13} y={eyeY - 10} width="26" height="19" rx="6" />
          <path d={`M${cx - l.eyeGap + 13} ${eyeY - 2} Q${cx} ${eyeY - 7} ${cx + l.eyeGap - 13} ${eyeY - 2}`} fill="none" />
        </g>
      )}
      {l.shades && (
        <g>
          <path d={`M${cx - l.eyeGap - 15} ${eyeY - 9} L${cx - 4} ${eyeY - 9} L${cx - 6} ${eyeY + 6} Q${cx - l.eyeGap} ${eyeY + 12} ${cx - l.eyeGap - 14} ${eyeY + 2} Z`} fill="#0d0d10" />
          <path d={`M${cx + l.eyeGap + 15} ${eyeY - 9} L${cx + 4} ${eyeY - 9} L${cx + 6} ${eyeY + 6} Q${cx + l.eyeGap} ${eyeY + 12} ${cx + l.eyeGap + 14} ${eyeY + 2} Z`} fill="#0d0d10" />
          <path d={`M${cx - 4} ${eyeY - 8} L${cx + 4} ${eyeY - 8}`} stroke="#0d0d10" strokeWidth="3" />
        </g>
      )}
      {stress > 0.75 && <path d={`M${cx + l.faceW - 14} ${cy - 30} q4 8 0 12 q-4 -4 0 -12`} fill="#bfe3ff" opacity="0.85" className="sweat" />}
    </svg>
  )
}
