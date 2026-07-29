import { useState } from 'react'
import type { ArmorPiece } from '../data/behourd'

// Silhouette d'armure : chaque zone se colore selon l'état des pièces qui la
// couvrent, et s'ouvre au clic pour changer cet état.
//
//   🔴 non reçu   — pas encore livrée (ou pas encore achetée)
//   🟠 à réparer  — en ta possession mais hors service
//   🟢 OK         — prête à combattre

export type PieceState = 'missing' | 'repair' | 'ok'

const COLORS: Record<PieceState | 'empty', string> = {
  missing: '#EF4444',
  repair: '#F59E0B',
  ok: '#10B981',
  empty: '#C9C4BD',
}

export const STATE_LABELS: Record<PieceState, string> = {
  missing: 'Non reçu',
  repair: 'À réparer',
  ok: 'OK',
}

/** État d'une pièce : la réparation ne concerne que ce qu'on possède déjà. */
export function pieceState(p: ArmorPiece): PieceState {
  if (!p.owned) return 'missing'
  return p.needs_repair ? 'repair' : 'ok'
}

interface Zone {
  id: string
  label: string
  match: (slot: string) => boolean
}

// Une pièce peut couvrir deux zones (les jambes incluent les sabatons) : c'est
// voulu, elle apparaît alors dans les deux volets.
const ZONES: Zone[] = [
  { id: 'head', label: 'Tête', match: (s) => s.includes('heaume') || s.includes('casque') },
  {
    id: 'torso',
    label: 'Torse',
    match: (s) =>
      (s.includes('brigantine') && !s.includes('skirt') && !s.includes('jupe')) ||
      s.includes('cuirasse') ||
      s.includes('gambeson'),
  },
  { id: 'arms', label: 'Bras & mains', match: (s) => s.includes('arms') || s.includes('bras') || s.includes('gantelet') },
  {
    id: 'pelvis',
    label: 'Bassin',
    match: (s) => s.includes('skirt') || s.includes('jupe') || s.includes('belt') || s.includes('ceinture'),
  },
  { id: 'legs', label: 'Jambes', match: (s) => s.includes('legs') || s.includes('jambes') },
  {
    id: 'feet',
    label: 'Pieds',
    match: (s) => s.includes('boots') || s.includes('chaussures') || s.includes('sabaton'),
  },
]

/** Indices des pièces couvrant une zone. */
function piecesDe(pieces: ArmorPiece[], zone: Zone): number[] {
  return pieces.map((p, i) => (zone.match(p.slot.toLowerCase()) ? i : -1)).filter((i) => i >= 0)
}

/** Couleur d'une zone : le pire état l'emporte — c'est ce qui bloque le combat. */
function etatZone(pieces: ArmorPiece[], idx: number[]): PieceState | 'empty' {
  if (idx.length === 0) return 'empty'
  const etats = idx.map((i) => pieceState(pieces[i]))
  if (etats.includes('missing')) return 'missing'
  if (etats.includes('repair')) return 'repair'
  return 'ok'
}

export function ArmorBodyDiagram({
  armorPieces,
  onSetState,
}: {
  armorPieces: ArmorPiece[]
  onSetState: (index: number, state: PieceState) => void
}) {
  const [zoneOuverte, setZoneOuverte] = useState<Zone | null>(null)

  const fill = (id: string) => {
    const zone = ZONES.find((z) => z.id === id)!
    return COLORS[etatZone(armorPieces, piecesDe(armorPieces, zone))]
  }
  const pick = (id: string) => () => setZoneOuverte(ZONES.find((z) => z.id === id) ?? null)
  const zoneProps = (id: string) => ({
    fill: fill(id),
    onClick: pick(id),
    style: { cursor: 'pointer' },
    stroke: '#fff',
    strokeWidth: 2,
  })

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center">
      <svg width="120" height="240" viewBox="0 0 120 240" aria-label="Silhouette armure">
        <circle cx="60" cy="26" r="18" {...zoneProps('head')} />
        <rect x="38" y="48" width="44" height="56" rx="10" {...zoneProps('torso')} />
        <rect x="20" y="50" width="16" height="60" rx="8" {...zoneProps('arms')} />
        <rect x="84" y="50" width="16" height="60" rx="8" {...zoneProps('arms')} />
        <rect x="40" y="104" width="40" height="26" rx="6" {...zoneProps('pelvis')} />
        <rect x="42" y="130" width="16" height="70" rx="7" {...zoneProps('legs')} />
        <rect x="62" y="130" width="16" height="70" rx="7" {...zoneProps('legs')} />
        <rect x="40" y="200" width="20" height="14" rx="4" {...zoneProps('feet')} />
        <rect x="60" y="200" width="20" height="14" rx="4" {...zoneProps('feet')} />
      </svg>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs sm:flex-col">
        <Legend color={COLORS.missing} label="Non reçu" />
        <Legend color={COLORS.repair} label="À réparer" />
        <Legend color={COLORS.ok} label="OK" />
        <span className="text-[10px] italic text-muted">Touche une zone pour changer son état.</span>
      </div>

      {zoneOuverte ? (
        <ZoneSheet
          zone={zoneOuverte}
          pieces={armorPieces}
          indices={piecesDe(armorPieces, zoneOuverte)}
          onSetState={onSetState}
          onClose={() => setZoneOuverte(null)}
        />
      ) : null}
    </div>
  )
}

function ZoneSheet({
  zone,
  pieces,
  indices,
  onSetState,
  onClose,
}: {
  zone: Zone
  pieces: ArmorPiece[]
  indices: number[]
  onSetState: (index: number, state: PieceState) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm rounded-b-none p-5 sm:rounded-xl2" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-extrabold text-ink">🛡️ {zone.label}</h2>
          <button onClick={onClose} className="shrink-0 text-muted hover:text-ink">
            ✕
          </button>
        </div>

        {indices.length === 0 ? (
          <p className="text-xs text-muted">Aucune pièce d'armure ne couvre cette zone pour l'instant.</p>
        ) : (
          <ul className="space-y-3">
            {indices.map((i) => {
              const p = pieces[i]
              const etat = pieceState(p)
              return (
                <li key={i}>
                  <div className="mb-1 flex items-center gap-2">
                    <span>{p.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{p.slot}</span>
                    <span className="shrink-0 text-[10px] text-muted">{p.weight_actual_kg ?? p.typical_weight_kg} kg</span>
                  </div>
                  <div className="flex gap-1.5">
                    {(['missing', 'repair', 'ok'] as PieceState[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => onSetState(i, s)}
                        className="flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition"
                        style={{
                          background: etat === s ? COLORS[s] : 'rgba(255,255,255,.05)',
                          color: etat === s ? '#fff' : 'rgb(var(--muted))',
                        }}
                      >
                        {STATE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                  {p.needs_repair && p.repair_notes ? (
                    <p className="mt-1 text-[11px] italic text-clay">🔧 {p.repair_notes}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span className="inline-block h-3 w-3 rounded" style={{ background: color }} />
      {label}
    </span>
  )
}
