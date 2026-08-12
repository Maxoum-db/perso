import { useMemo, useState } from 'react'
import { parseGroups, type CatalogExercise } from '../lib/muscu'
import { OUTILS, outilDe, type OutilId } from '../lib/materiel'
import { faisable } from '../lib/monMateriel'
import { useMonMateriel } from '../lib/useMonMateriel'

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
  // Une quarantaine de groupes : déplié, le filtre pousse les résultats hors
  // de l'écran. Il reste donc fermé tant qu'on ne le demande pas.
  const [groupsOpen, setGroupsOpen] = useState(false)

  // MON matériel : ce dont je dispose là où je m'entraîne. Enregistré par
  // compte, parce que c'est le garage qu'on décrit, pas la session en cours —
  // on ne recoche pas ses six haltères à chaque ouverture de l'application.
  //
  // Liste vide = tout, c'est-à-dire la salle. Le filtre ne s'active donc jamais
  // tout seul : sans ça, un premier chargement viderait le catalogue.
  //
  // Le magasin est PARTAGÉ (lib/useMonMateriel) : le bouton « proposer des
  // exercices » de la séance type lit exactement la même liste. Deux états
  // locaux avaient divergé aussitôt — la recherche montrait des haltères
  // pendant que la proposition sortait une poulie.
  const { outils, choisir } = useMonMateriel()
  const [outilsOpen, setOutilsOpen] = useState(false)
  const basculerOutil = (o: OutilId) =>
    choisir(outils.includes(o) ? outils.filter((x) => x !== o) : [...outils, o])
  const toutLeMateriel = () => choisir([])

  // Outils réellement présents au catalogue, avec le nombre d'exercices. On ne
  // propose pas de cocher un traîneau si aucun exercice n'en demande.
  const outilCounts = useMemo(() => {
    const counts = new Map<OutilId, number>()
    for (const c of catalog) counts.set(outilDe(c.name), (counts.get(outilDe(c.name)) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [catalog])

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
      if (!faisable(c.name, outils)) return false
      if (group && !parseGroups(c.muscle_group).includes(group)) return false
      if (!needle) return true
      return normalizeName(c.name).includes(needle) || normalizeName(c.muscle_group).includes(needle)
    })
  }, [catalog, needle, group, outils])

  function pick(c: CatalogExercise) {
    onPick(c)
    setQuery('')
    setGroup(null)
    setGroupsOpen(false)
    setOpen(false)
  }

  const filtering = Boolean(needle) || group !== null || outils.length > 0

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

      {/* MON MATÉRIEL, juste sous la recherche.
          Le seul filtre qui décrit le LIEU et non l'exercice : chez soi, on n'a
          pas de poulie, et la moitié du catalogue ne sert à rien. Il vit ici
          plutôt que dans les réglages parce que c'est ici qu'on choisit, et
          qu'un filtre qu'on ne voit pas est un filtre qu'on oublie d'avoir
          activé. */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setOutilsOpen((o) => !o)}
            className="flex items-center gap-1 rounded-lg bg-bg px-2 py-1 text-[11px] font-semibold text-muted transition hover:text-ink"
          >
            <span className="text-[9px]">{outilsOpen ? '▾' : '▸'}</span>
            🧰 Mon matériel
          </button>
          {outils.length === 0 ? (
            <span className="text-[11px] text-muted">tout (salle)</span>
          ) : (
            <>
              {outils.map((o) => (
                <button
                  key={o}
                  onClick={() => basculerOutil(o)}
                  className="flex items-center gap-1 rounded-lg bg-copper px-2 py-1 text-[11px] font-semibold text-white"
                  title="Retirer de mon matériel"
                >
                  {OUTILS[o].emoji} {OUTILS[o].label} ✕
                </button>
              ))}
              <button onClick={toutLeMateriel} className="text-[11px] text-muted hover:text-copper">
                tout afficher
              </button>
            </>
          )}
        </div>

        {outilsOpen ? (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={toutLeMateriel}
              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                outils.length === 0 ? 'bg-copper text-white' : 'bg-bg text-muted hover:text-ink'
              }`}
            >
              Tout (salle)
            </button>
            {outilCounts.map(([o, n]) => (
              <button
                key={o}
                onClick={() => basculerOutil(o)}
                title={`${n} exercice${n > 1 ? 's' : ''}`}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                  outils.includes(o) ? 'bg-copper text-white' : 'bg-bg text-muted hover:text-ink'
                }`}
              >
                {OUTILS[o].emoji} {OUTILS[o].label} <span className="opacity-60">{n}</span>
              </button>
            ))}
            <p className="w-full text-[10px] text-muted">
              Le poids du corps est toujours proposé : il n'y a rien à posséder.
            </p>
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="card space-y-2 p-2">
          {/* Filtre par groupe musculaire, replié par défaut */}
          {groupCounts.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGroupsOpen((o) => !o)}
                  className="flex items-center gap-1 rounded-lg bg-bg px-2 py-1 text-[11px] font-semibold text-muted transition hover:text-ink"
                >
                  <span className="text-[9px]">{groupsOpen ? '▾' : '▸'}</span>
                  🎯 Muscle visé
                </button>
                {group ? (
                  <button
                    onClick={() => setGroup(null)}
                    className="flex items-center gap-1 rounded-lg bg-copper px-2 py-1 text-[11px] font-semibold text-white"
                    title="Retirer le filtre"
                  >
                    {group} ✕
                  </button>
                ) : (
                  <span className="text-[11px] text-muted">tous les muscles</span>
                )}
              </div>

              {groupsOpen ? (
                <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
                  <button
                    onClick={() => {
                      setGroup(null)
                      setGroupsOpen(false)
                    }}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                      group === null ? 'bg-copper text-white' : 'bg-bg text-muted hover:text-ink'
                    }`}
                  >
                    Tous
                  </button>
                  {groupCounts.map(([g, n]) => (
                    <button
                      key={g}
                      onClick={() => {
                        setGroup(group === g ? null : g)
                        setGroupsOpen(false)
                      }}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                        group === g ? 'bg-copper text-white' : 'bg-bg text-muted hover:text-ink'
                      }`}
                    >
                      {g} <span className="opacity-60">{n}</span>
                    </button>
                  ))}
                </div>
              ) : null}
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
                    setGroupsOpen(false)
                    toutLeMateriel()
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
                          {/* Où ça se fait, avant même de choisir : c'est ce qui
                              décide si on l'ajoute à la séance de ce soir. */}
                          <span title={OUTILS[outilDe(c.name)].label}>
                            {OUTILS[outilDe(c.name)].emoji} {OUTILS[outilDe(c.name)].label}
                          </span>{' '}
                          · {c.default_sets}×{c.default_reps}
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
