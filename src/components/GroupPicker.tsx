import { useState } from 'react'
import { parseGroupEntries, serializeGroups, type GroupEntry } from '../lib/muscu'

// Sélecteur de groupes musculaires à choix multiple, avec intensité :
// un appui fait défiler « non travaillé → principal → secondaire → non ».
// Le coefficient sert au mannequin de récupération (un muscle secondaire
// récupère plus vite qu'un moteur principal).

const SECONDARY = 0.5

export function GroupPicker({
  value,
  groups,
  onChange,
  className = '',
}: {
  value: string
  groups: string[]
  onChange: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const entries = parseGroupEntries(value)
  const byName = new Map(entries.map((e) => [e.name, e.intensity]))

  // Les groupes déjà choisis mais absents de la liste perso restent proposés.
  const options = [...groups, ...entries.map((e) => e.name).filter((n) => !groups.includes(n))]

  function cycle(name: string) {
    const current = byName.get(name)
    let next: GroupEntry[]
    if (current === undefined) {
      next = [...entries, { name, intensity: 1 }]
    } else if (current >= 1) {
      next = entries.map((e) => (e.name === name ? { ...e, intensity: SECONDARY } : e))
    } else {
      next = entries.filter((e) => e.name !== name)
    }
    onChange(serializeGroups(next))
  }

  const summary = entries.map((e) => (e.intensity >= 1 ? e.name : `${e.name} (2ᵈ)`)).join(', ')

  return (
    <div className={`min-w-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field flex w-full items-center gap-1 text-left"
        title="Choisir les groupes musculaires et leur intensité"
      >
        <span className={`min-w-0 flex-1 truncate ${entries.length ? 'text-ink' : 'text-muted'}`}>
          {entries.length ? summary : 'Groupes visés…'}
        </span>
        <span className="shrink-0 text-muted">{open ? '▾' : '▸'}</span>
      </button>

      {open ? (
        <div className="mt-1 rounded-xl2 border border-line bg-bg p-2">
          <p className="mb-1.5 text-[10px] text-muted">
            1 appui = <b className="text-copper">principal</b> · 2 appuis ={' '}
            <b className="text-copper/70">secondaire</b> · 3 appuis = retiré
          </p>
          <div className="flex flex-wrap gap-1">
            {options.map((g) => {
              const intensity = byName.get(g)
              const primary = intensity !== undefined && intensity >= 1
              const secondary = intensity !== undefined && intensity < 1
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => cycle(g)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                    primary
                      ? 'bg-copper text-white'
                      : secondary
                        ? 'bg-copper/25 text-copper ring-1 ring-copper/50'
                        : 'bg-card text-muted hover:text-ink'
                  }`}
                >
                  {primary ? '● ' : secondary ? '◐ ' : ''}
                  {g}
                </button>
              )
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px]">
            <button type="button" onClick={() => onChange('')} className="text-muted hover:text-clay">
              Tout effacer
            </button>
            <button type="button" onClick={() => setOpen(false)} className="font-semibold text-copper">
              Terminé
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
