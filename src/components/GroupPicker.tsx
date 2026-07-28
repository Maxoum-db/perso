import { useState } from 'react'
import { joinGroups, parseGroups } from '../lib/muscu'

// Sélecteur de groupes musculaires à choix multiple : un exercice peut viser
// plusieurs groupes (ex. « Pectoraux, Triceps »). La valeur reste une simple
// chaîne séparée par des virgules, stockée telle quelle.

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
  const selected = parseGroups(value)

  // Les groupes déjà choisis mais absents de la liste perso restent proposés.
  const options = [...groups, ...selected.filter((s) => !groups.includes(s))]

  function toggle(g: string) {
    const next = selected.includes(g) ? selected.filter((x) => x !== g) : [...selected, g]
    onChange(joinGroups(next))
  }

  return (
    <div className={`min-w-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field flex w-full items-center gap-1 text-left"
        title="Choisir un ou plusieurs groupes musculaires"
      >
        <span className={`min-w-0 flex-1 truncate ${selected.length ? 'text-ink' : 'text-muted'}`}>
          {selected.length ? selected.join(', ') : 'Groupes visés…'}
        </span>
        <span className="shrink-0 text-muted">{open ? '▾' : '▸'}</span>
      </button>

      {open ? (
        <div className="mt-1 rounded-xl2 border border-line bg-bg p-2">
          <div className="flex flex-wrap gap-1">
            {options.map((g) => {
              const on = selected.includes(g)
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggle(g)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                    on ? 'bg-copper text-white' : 'bg-card text-muted hover:text-ink'
                  }`}
                >
                  {on ? '✓ ' : ''}
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
