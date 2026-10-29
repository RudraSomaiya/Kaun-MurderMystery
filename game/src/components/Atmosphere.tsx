// Film grain, vignette and the shadow of a slow ceiling fan. Pure CSS/SVG, no canvas.
export function Atmosphere() {
  return (
    <div className="atmosphere" aria-hidden>
      <div className="fan">
        <svg viewBox="-100 -100 200 200">
          {[0, 120, 240].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M0 -6 C 30 -18, 80 -16, 96 -4 C 98 2, 96 6, 90 8 C 70 12, 30 12, 0 6 Z" />
          ))}
          <circle r="10" />
        </svg>
      </div>
      <div className="vignette" />
      <svg className="grain">
        <filter id="grain-f">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-f)" />
      </svg>
    </div>
  )
}

export function Pulse({ bpm }: { bpm: number }) {
  const beat = 'l14 0 l4 -6 l4 6 l6 0 l3 6 l5 -30 l5 38 l4 -14 l8 0 l6 -4 l6 4 l35 0'
  return (
    <div className="pulse" title="Polygraph: it measures nerves, not lies">
      <svg viewBox="0 0 400 50" preserveAspectRatio="none">
        <g className="pulse-run" style={{ animationDuration: `${(4 * 60) / bpm}s` }}>
          <path d={`M0 30 ${beat.repeat(8)}`} />
        </g>
      </svg>
      <span className="bpm">
        <b>{Math.round(bpm)}</b> bpm
      </span>
    </div>
  )
}
