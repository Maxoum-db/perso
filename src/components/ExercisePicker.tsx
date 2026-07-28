import { useMemo, useState } from 'react'
import type { CatalogExercise } from '../lib/muscu'

// Sélecteur d'exercice : champ de recherche par nom (insensible aux accents
// et à la casse) + liste alphabétique. Partagé par l'éditeur de séance et la
// séance en direct.

/** « Développé » → « developpe » : pour chercher sans se soucier des accents. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function ExercisePicker({
  catalog,
  onPick,
  onBlank,
}: {
  catalog: CatalogExercise[]
  onPick: (c: CatalogExercise) => void
  onBlank: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const needle = normalizeName(query.trim())
    if (!needle) return catalog
    return catalog.filter((c) => normalizeName(c.name).includes(needle) || normalizeName(c.muscle_group).includes(needle))
  }, [catalog, query])

  function pick(c: CatalogExercise) {
    onPick(c)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="field"
          type="search"
          placeholder="🔍 Chercher un exercice…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
        <button onClick={onBlank} className="btn-ghost shrink-0 px-3 py-2 text-sm">
          + Vierge
        </button>
      </div>

      {open ? (
        <div className="card max-h-64 overflow-y-auto p-1">
          <div className="flex items-center justify-between px-2 py-1 text-[11px] text-muted">
            <span>
              {results.length} exercice{results.length > 1 ? 's' : ''}
              {query.trim() ? ' trouvé' + (results.length > 1 ? 's' : '') : ' au catalogue'}
            </span>
            <button onClick={() => setOpen(false)} className="font-semibold text-copper">
              Fermer
            </button>
          </div>
          {results.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted">
              Aucun exercice ne correspond. Utilise « + Vierge » pour en créer un.
            </p>
          ) : (
            <ul>
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => pick(c)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-copper/10"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.name}</span>
                    {c.muscle_group ? (
                      <span className="shrink-0 text-[10px] text-muted">{c.muscle_group}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
