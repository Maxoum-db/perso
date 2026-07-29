import { parseGroupEntries, serializeGroups } from '../lib/muscu'
import { effortColor } from './MuscleBodyDiagram'

// Béhourd, kickboxing, grappling : pas d'exercice précis, pas de série, pas de
// charge — mais des zones qui prennent cher, à des degrés différents.
//
// L'effort se règle en pourcentage et se colore sur l'échelle du mannequin :
// 100 % vire au marron brûlant, 0 % au vert reposé. Ce qu'on déclare ici a donc
// exactement la couleur que le muscle prendra sur le corps.

/** Zones proposées, dans l'ordre où on les ressent après un combat. */
const ZONES = [
  'Cou',
  'Trapèzes',
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
  'Adducteurs',
  'Mollets',
  'Cardio',
] as const

const DEFAUT = 0.8

export function RessentiPicker({ value, onChange }: { value: string; onChange: (groups: string) => void }) {
  const entrees = new Map(parseGroupEntries(value).map((e) => [e.name, e.intensity]))

  function ecrire(m: Map<string, number>) {
    onChange(serializeGroups([...m].map(([name, intensity]) => ({ name, intensity }))))
  }

  function toggle(zone: string) {
    const copie = new Map(entrees)
    if (copie.has(zone)) copie.delete(zone)
    else copie.set(zone, DEFAUT)
    ecrire(copie)
  }

  function regler(zone: string, pourcent: number) {
    const copie = new Map(entrees)
    // Sous 10 %, la zone n'a pas travaillé : on la retire plutôt que de garder
    // une sollicitation fantôme qui bloquerait le générateur.
    if (pourcent < 10) copie.delete(zone)
    else copie.set(zone, Math.round(pourcent) / 100)
    ecrire(copie)
  }

  const choisies = ZONES.filter((z) => entrees.has(z))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {ZONES.map((z) => {
          const v = entrees.get(z)
          return (
            <button
              key={z}
              onClick={() => toggle(z)}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold transition"
              style={
                v === undefined
                  ? { background: 'rgb(var(--bg))', color: 'rgb(var(--muted))' }
                  : { background: effortColor(v), color: '#fff' }
              }
            >
              {z}
              {v !== undefined ? ` ${Math.round(v * 100)} %` : ''}
            </button>
          )
        })}
      </div>

      {choisies.length > 0 ? (
        <div className="space-y-1.5 border-t border-line/50 pt-2">
          {choisies.map((z) => {
            const v = entrees.get(z) ?? DEFAUT
            return (
              <div key={z} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-[11px] font-semibold text-ink">{z}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(v * 100)}
                  onChange={(e) => regler(z, Number(e.target.value))}
                  className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${effortColor(0)}, ${effortColor(0.5)}, ${effortColor(1)})`,
                    accentColor: effortColor(v),
                  }}
                />
                <span
                  className="w-11 shrink-0 rounded px-1 py-0.5 text-center text-[11px] font-bold text-white"
                  style={{ background: effortColor(v) }}
                >
                  {Math.round(v * 100)} %
                </span>
              </div>
            )
          })}
        </div>
      ) : null}

      <p className="text-[10px] text-muted">
        Vert = zone épargnée · marron = à fond. Sous 10 %, la zone sort du ressenti.
      </p>
    </div>
  )
}
