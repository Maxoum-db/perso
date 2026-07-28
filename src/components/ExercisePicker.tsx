import { useMemo, useState } from 'react'
import { parseGroups, type CatalogExercise } from '../lib/muscu'

// Sélecteur d'exercice : recherche par nom (insensible aux accents et à la
// casse) ET filtre par groupe musculaire visé, pour retrouver vite un exercice
// dans un catalogue qui dépasse la centaine d'entrées.

/** « Développé » → « developpe » : pour chercher sans se soucier des accents. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Découpe le nom autour du texte cherché, pour surligner la correspondance. */
function highlight(name: string, needle: string) {
  const n = normalizeName(name)
  // Le surlignage suppose un alignement caractère à caractère avec l'original ;
  // sinon (cas exotiques type « œ ») on affiche le nom tel quel.
  if (!needle || n.length !== name.length) return name
  const i = n.indexOf(needle)
  if (i < 0) return name
  return (
    <>
      {name.slice(0, i)}
      <mark className="rounded bg-copper/30 px-0.5 text-ink">{name.slice(i, i + needle.length)}</mark>
      {name.slice(i + needle.length)}
    </>
  )
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
  const [group, setGroup] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  // Groupes réellement présents au catalogue, avec le nombre d'exercices.
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of catalog) {
      for (const g of parseGroups(c.muscle_group)) counts.set(g, (counts.get(g) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr', { sensitivity: 'base' }))
  }, [catalog])

  const needle = normalizeName(query.trim())
  const results = useMemo(() => {
    return catalog.filter((c) => {
      if (group && !parseGroups(c.muscle_group).includes(group)) return false
      if (!needle) return true
      return normalizeName(c.name).includes(needle) || normalizeName(c.muscle_group).includes(needle)
    })
  }, [catalog, needle, group])

  function pick(c: CatalogExercise) {
    onPick(c)
    setQuery('')
    setGroup(null)
    setOpen(false)
  }

  const filtering = Boolean(needle) || group !== null

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
        <div className="card space-y-2 p-2">
          {/* Filtre par groupe musculaire */}
          {groupCounts.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setGroup(null)}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                  group === null ? 'bg-copper text-white' : 'bg-bg text-muted hover:text-ink'
                }`}
              >
                Tous
              </button>
              {groupCounts.map(([g, n]) => (
                <button
                  key={g}
                  onClick={() => setGroup(group === g ? null : g)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                    group === g ? 'bg-copper text-white' : 'bg-bg text-muted hover:text-ink'
                  }`}
                >
                  {g} <span className="opacity-60">{n}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between px-1 text-[11px] text-muted">
            <span>
              {results.length} exercice{results.length > 1 ? 's' : ''}
              {filtering ? (results.length > 1 ? ' trouvés' : ' trouvé') : ' au catalogue'}
            </span>
            <div className="flex gap-3">
              {filtering ? (
                <button
                  onClick={() => {
                    setQuery('')
                    setGroup(null)
                  }}
                  className="hover:text-ink"
                >
                  Réinitialiser
                </button>
              ) : null}
              <button onClick={() => setOpen(false)} className="font-semibold text-copper">
                Fermer
              </button>
            </div>
          </div>

          {results.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted">
              Aucun exercice ne correspond. Utilise « + Vierge » pour en créer un.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {results.map((c) => {
                const gs = parseGroups(c.muscle_group)
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => pick(c)}
                      className="w-full rounded-lg px-2 py-2 text-left transition hover:bg-copper/10"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                          {highlight(c.name, needle)}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted">
                          {c.default_sets}×{c.default_reps}
                        </span>
                      </div>
                      {gs.length > 0 ? (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {gs.map((g) => (
                            <span
                              key={g}
                              className={`rounded px-1 py-0.5 text-[9px] ${
                                g === group ? 'bg-copper/25 text-copper' : 'bg-bg text-muted'
                              }`}
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
