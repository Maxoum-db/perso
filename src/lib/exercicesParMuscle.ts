import { EXERCISE_LIBRARY } from '../data/exercises'
import { parseGroupEntries } from './muscu'
import { regionsForGroup, type MuscleRegion } from './muscles'

// Quels exercices visent un muscle donné, du plus ciblé au plus périphérique.
//
// Sert au clic sur le mannequin — un muscle resté froid doit pouvoir répondre
// « voilà comment me travailler » — et à la carte des points faibles béhourd,
// qui propose le premier de la liste.

export interface ExoPourMuscle {
  name: string
  /** Part de l'exercice consacrée à ce muscle (1 = moteur principal). */
  intensite: number
  sets: number
  reps: string
  notes?: string
  /** Nombre de muscles visés au total : plus il est bas, plus l'exercice est ciblé. */
  etendue: number
}

/**
 * Exercices visant ce muscle, triés par intensité puis par ciblage — à
 * intensité égale, un exercice qui ne vise que lui passe devant un
 * polyarticulaire qui l'emmène en passant.
 *
 * Les activités (nage, course, béhourd) et la récupération active sont
 * écartées : on cherche quoi FAIRE en salle, pas quoi cocher.
 */
export function exercicesPourMuscle(region: MuscleRegion, limite = 8): ExoPourMuscle[] {
  const out: ExoPourMuscle[] = []
  for (const exo of EXERCISE_LIBRARY) {
    if (exo.kind) continue
    const entrees = parseGroupEntries(exo.groups)
    let intensite = 0
    const muscles = new Set<MuscleRegion>()
    for (const g of entrees) {
      const regions = regionsForGroup(g.name)
      for (const r of regions) muscles.add(r)
      if (regions.includes(region)) intensite = Math.max(intensite, g.intensity)
    }
    // Sous 0,5, l'exercice ne fait qu'effleurer le muscle : le proposer serait
    // trompeur pour quelqu'un qui cherche précisément à le réveiller.
    if (intensite < 0.5) continue
    out.push({
      name: exo.name,
      intensite,
      sets: exo.sets,
      reps: exo.reps,
      notes: exo.notes,
      etendue: muscles.size,
    })
  }
  return out
    .sort((a, b) => b.intensite - a.intensite || a.etendue - b.etendue || a.name.localeCompare(b.name, 'fr'))
    .slice(0, limite)
}
