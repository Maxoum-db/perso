import { parseGroupEntries, serializeGroups } from '../lib/muscu'

// Béhourd, kickboxing, grappling : pas d'exercice précis, pas de série, pas de
// charge — mais des zones qui prennent cher. Ce sélecteur sert à le déclarer en
// trois taps, pour que le mannequin et le générateur en tiennent compte.

/** Zones proposées, dans l'ordre où on les ressent après un combat. */
const ZONES = [
  'Cou',
  'Épaules',
  'Bras',
  'Avant-bras',
  'Dos',
  'Pectoraux',
  'Abdos/Core',
  'Obliques',
  'Lombaires',
  'Fessiers',
  'Quadriceps',
  'Ischios',
  'Mollets',
  'Cardio',
] as const

/** Trois niveaux d'effort, du plus dur au plus léger. */
const NIVEAUX: Array<{ valeur: number; label: string; marque: string }> = [
  { valeur: 1, label: 'à fond', marque: '●' },
  { valeur: 0.7, label: 'soutenu', marque: '◐' },
  { valeur: 0.4, label: 'léger', marque: '○' },
]

/** Cycle au tap : rien → à fond → soutenu → léger → rien. */
function suivant(actuel: number | undefined): number | null {
  if (actuel === undefined) return 1
  if (actuel > 0.85) return 0.7
  if (actuel > 0.55) return 0.4
  return null
}

export function RessentiPicker({ value, onChange }: { value: string; onChange: (groups: string) => void }) {
  const entrees = new Map(parseGroupEntries(value).map((e) => [e.name, e.intensity]))

  function toggle(zone: string) {
    const next = suivant(entrees.get(zone))
    const copie = new Map(entrees)
    if (next === null) copie.delete(zone)
    else copie.set(zone, next)
    onChange(serializeGroups([...copie].map(([name, intensity]) => ({ name, intensity }))))
  }

  const style = (v: number | undefined) => {
    if (v === undefined) return 'bg-bg text-muted'
    if (v > 0.85) return 'bg-clay text-white'
    if (v > 0.55) return 'bg-clay/60 text-white'
    return 'bg-clay/30 text-ink'
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {ZONES.map((z) => {
          const v = entrees.get(z)
          return (
            <button
              key={z}
              onClick={() => toggle(z)}
              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${style(v)}`}
            >
              {z}
              {v !== undefined ? ` ${NIVEAUX.find((n) => Math.abs(n.valeur - v) < 0.1)?.marque ?? ''}` : ''}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        {NIVEAUX.map((n) => (
          <span key={n.valeur}>
            {n.marque} {n.label}
          </span>
        ))}
        <span className="opacity-70">— tape plusieurs fois pour changer de niveau</span>
      </div>
    </div>
  )
}
