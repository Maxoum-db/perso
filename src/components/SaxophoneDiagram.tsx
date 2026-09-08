import { SAX_KEYS, saxKey, type SaxKey } from '../lib/saxophone'

// Schéma du saxophone : pas un dessin réaliste, une carte des clés — celles de
// la main gauche à gauche du corps, celles de la main droite à droite,
// exactement comme les tables de doigtés papier les présentent. Le corps
// (col, tube, pavillon) n'est qu'un repère visuel entre les deux colonnes.

const ACTIF = '#8fae7a' // sage
const INACTIF = '#d8d2c8'

interface Pos {
  x: number
  y: number
}

const POSITIONS: Record<SaxKey, Pos> = {
  octave: { x: 52, y: 52 },
  palmD: { x: 46, y: 86 },
  palmEb: { x: 46, y: 105 },
  palmF: { x: 46, y: 124 },
  bis: { x: 46, y: 150 },
  gauche1: { x: 46, y: 174 },
  gauche2: { x: 46, y: 197 },
  gauche3: { x: 46, y: 220 },
  gsharp: { x: 46, y: 292 },
  lowCsharp: { x: 46, y: 313 },
  lowB: { x: 46, y: 334 },
  lowBb: { x: 46, y: 355 },
  sideE: { x: 194, y: 150 },
  droite1: { x: 194, y: 234 },
  droite2: { x: 194, y: 257 },
  droite3: { x: 194, y: 280 },
  lowC: { x: 194, y: 344 },
  lowEb: { x: 194, y: 365 },
}

/** Corps du saxophone : col, tube, pavillon — un repère, pas un portrait. */
function Corps() {
  return (
    <g fill="none" stroke="#a89a8d" strokeWidth="2">
      {/* Bec et col */}
      <ellipse cx="88" cy="24" rx="10" ry="6" fill="#efe9df" transform="rotate(-30 88 24)" />
      <path d="M94,29 Q120,45 122,64" fill="none" />
      {/* Corps */}
      <rect x="97" y="60" width="46" height="240" rx="20" fill="#efe9df" />
      {/* Pavillon */}
      <path
        d="M100,282 Q86,320 86,344 Q86,368 120,368 Q154,368 154,344 Q154,320 140,282 Z"
        fill="#efe9df"
      />
    </g>
  )
}

function KeyDot({ id, actif }: { id: SaxKey; actif: boolean }) {
  const p = POSITIONS[id]
  const meta = saxKey(id)
  const cote = p.x < 120 ? 'gauche' : 'droite'
  const ancre = p.x < 120 ? 'end' : 'start'
  const labelX = cote === 'gauche' ? p.x - 13 : p.x + 13
  return (
    <g>
      {/* Trait reliant la clé au corps — juste un repère visuel. */}
      <line x1={p.x} y1={p.y} x2={cote === 'gauche' ? 120 : 118} y2={p.y} stroke="#c9c4bd" strokeWidth="1" />
      <circle cx={p.x} cy={p.y} r="10" fill={actif ? ACTIF : INACTIF} stroke={actif ? '#5f7a4c' : '#a89a8d'} strokeWidth="1.5">
        <title>{meta.aide}</title>
      </circle>
      <text x={labelX} y={p.y + 3.5} textAnchor={ancre} fontSize="10" fontWeight="700" fill={actif ? '#3f5432' : '#8a8074'}>
        {meta.label}
      </text>
    </g>
  )
}

export function SaxophoneDiagram({ keys }: { keys: SaxKey[] }) {
  const actives = new Set(keys)
  return (
    <div className="space-y-2">
      <svg viewBox="0 0 240 390" className="mx-auto w-full max-w-xs" aria-label="Doigté sur le saxophone">
        <Corps />
        {SAX_KEYS.map((k) => (
          <KeyDot key={k.id} id={k.id} actif={actives.has(k.id)} />
        ))}
      </svg>
      <div className="flex justify-center gap-4 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ACTIF }} /> à presser
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: INACTIF }} /> relâchée
        </span>
      </div>
    </div>
  )
}
