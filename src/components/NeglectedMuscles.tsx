import { PRIORITE_BEHOURD, type Priorite } from '../data/behourdPriority'
import { fmtAnciennete, type GroupLoad } from '../lib/muscu'
import { exercicesPourMuscle } from '../lib/exercicesParMuscle'
import { FOCUS, type FocusId } from '../lib/focus'
import { MUSCLE_LABELS, regionsForGroup, type MuscleRegion } from '../lib/muscles'

// Le mannequin dit ce qui est FRAIS. Cette carte dit ce qui est OUBLIÉ —
// l'autre moitié de l'information, et celle qui coûte cher en béhourd.
//
// L'ordre de priorité vit dans data/behourdPriority.ts : il est partagé avec
// le générateur de séance, qui vise les mêmes muscles en premier.

const SEUIL_JOURS = 10
/** Sur le point faible déclaré, on alerte deux fois plus tôt. */
const SEUIL_FOCUS = 5

/** Le meilleur exercice pour ce muscle, même classement que la fiche du mannequin. */
function exerciceSuggere(region: MuscleRegion): string | null {
  return exercicesPourMuscle(region, 1)[0]?.name ?? null
}

export function NeglectedMuscles({
  loads,
  focus = 'aucun',
}: {
  loads: Record<string, GroupLoad>
  focus?: FocusId
}) {
  const focusRegions = new Set(FOCUS[focus].regions)
  // Ancienneté réelle (pas pondérée) du dernier travail de chaque muscle.
  const joursParMuscle: Partial<Record<MuscleRegion, number>> = {}
  for (const [group, load] of Object.entries(loads)) {
    for (const region of regionsForGroup(group)) {
      const cur = joursParMuscle[region]
      if (cur === undefined || load.days < cur) joursParMuscle[region] = load.days
    }
  }

  // Le point faible déclaré remonte en tête et déclenche plus tôt : c'est le
  // seul endroit où l'ordre béhourd n'a pas le dernier mot.
  const negliges = (Object.entries(PRIORITE_BEHOURD) as Array<[MuscleRegion, Priorite]>)
    .map(([region, prio]) => ({ region, prio, jours: joursParMuscle[region], cible: focusRegions.has(region) }))
    .filter((m) => m.jours === undefined || m.jours >= (m.cible ? SEUIL_FOCUS : SEUIL_JOURS))
    .sort((a, b) => Number(b.cible) - Number(a.cible) || a.prio.rang - b.prio.rang)
    .slice(0, 4)

  if (negliges.length === 0) {
    return (
      <p className="text-center text-[11px] text-muted">
        ✅ Aucun muscle clé du béhourd laissé de côté — tout a été travaillé dans les {SEUIL_JOURS} derniers jours.
      </p>
    )
  }

  return (
    <section className="card space-y-2 p-3">
      <h2 className="text-sm font-bold text-ink">⚔️ Points faibles béhourd</h2>
      <p className="text-[11px] text-muted">
        Muscles importants pour le combat en armure, sans travail depuis au moins {SEUIL_JOURS} jours.
      </p>
      <ul className="space-y-2">
        {negliges.map(({ region, prio, jours, cible }) => {
          const suggestion = prio.exo ?? exerciceSuggere(region)
          return (
            <li key={region} className="rounded-xl2 border border-clay/30 bg-clay/5 p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-ink">
                  {cible ? '🎯 ' : ''}
                  {MUSCLE_LABELS[region]}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-clay">
                  {jours === undefined ? 'jamais' : fmtAnciennete(jours)}
                </span>
              </div>
              <p className="text-[11px] text-muted">{prio.pourquoi}</p>
              {suggestion ? (
                <p className="mt-1 text-[11px] text-copper">→ {suggestion}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
