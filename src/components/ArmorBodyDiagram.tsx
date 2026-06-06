import type { ArmorPiece } from '../data/behourd'

// Silhouette SVG simplifiée : chaque zone se colore selon le statut de la pièce
// correspondante (possédée = vert, en commande = ambre, à acquérir = gris).

type Status = 'owned' | 'pre_order' | 'none'

const COLORS: Record<Status, string> = {
  owned: '#10B981',
  pre_order: '#F59E0B',
  none: '#D1D5DB',
}

function statusFor(pieces: ArmorPiece[], match: (slot: string) => boolean): Status {
  const p = pieces.find((x) => match(x.slot.toLowerCase()))
  if (!p) return 'none'
  if (p.owned) return 'owned'
  if (p.pre_order) return 'pre_order'
  return 'none'
}

export function ArmorBodyDiagram({ armorPieces }: { armorPieces: ArmorPiece[] }) {
  const head = statusFor(armorPieces, (s) => s.includes('heaume'))
  const torso = statusFor(armorPieces, (s) => s.includes('brigantine') && !s.includes('skirt'))
  const pelvis = statusFor(armorPieces, (s) => s.includes('skirt') || s.includes('belt'))
  const arms = statusFor(armorPieces, (s) => s.includes('arms') || s.includes('bras'))
  const legs = statusFor(armorPieces, (s) => s.includes('legs') || s.includes('jambes'))
  const feet = statusFor(armorPieces, (s) => s.includes('boots') || s.includes('chaussures'))

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center">
      <svg width="120" height="240" viewBox="0 0 120 240" aria-label="Silhouette armure">
        {/* Tête */}
        <circle cx="60" cy="26" r="18" fill={COLORS[head]} stroke="#fff" strokeWidth="2" />
        {/* Torse */}
        <rect x="38" y="48" width="44" height="56" rx="10" fill={COLORS[torso]} stroke="#fff" strokeWidth="2" />
        {/* Bras gauche/droit */}
        <rect x="20" y="50" width="16" height="60" rx="8" fill={COLORS[arms]} stroke="#fff" strokeWidth="2" />
        <rect x="84" y="50" width="16" height="60" rx="8" fill={COLORS[arms]} stroke="#fff" strokeWidth="2" />
        {/* Bassin / jupe */}
        <rect x="40" y="104" width="40" height="26" rx="6" fill={COLORS[pelvis]} stroke="#fff" strokeWidth="2" />
        {/* Jambes */}
        <rect x="42" y="130" width="16" height="70" rx="7" fill={COLORS[legs]} stroke="#fff" strokeWidth="2" />
        <rect x="62" y="130" width="16" height="70" rx="7" fill={COLORS[legs]} stroke="#fff" strokeWidth="2" />
        {/* Pieds */}
        <rect x="40" y="200" width="20" height="14" rx="4" fill={COLORS[feet]} stroke="#fff" strokeWidth="2" />
        <rect x="60" y="200" width="20" height="14" rx="4" fill={COLORS[feet]} stroke="#fff" strokeWidth="2" />
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs sm:flex-col">
        <Legend color={COLORS.owned} label="Possédé" />
        <Legend color={COLORS.pre_order} label="En commande" />
        <Legend color={COLORS.none} label="À acquérir" />
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
