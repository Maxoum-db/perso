// REMODELER une séance en cours, quand le matériel n'est pas là.
//
// Le rack est pris, la poulie occupée, le banc squatté par quelqu'un qui
// répond à ses messages. La séance composée le matin devient infaisable à
// 19 h 12, et jusqu'ici la seule sortie était de la refaire à la main.
//
// On décoche l'outil manquant, on remodèle : chaque exercice qui en dépend est
// remplacé par son ÉQUIVALENT — le mouvement le plus proche qu'on puisse faire
// avec ce qui reste.
//
// Deux règles inviolables :
//
//   • ce qui est DÉJÀ FAIT ne bouge pas. Une série cochée est un fait ; la
//     remplacer réécrirait l'historique, et le mannequin lirait une séance qui
//     n'a pas eu lieu ;
//   • à défaut d'équivalent, on RETIRE la ligne et on le dit. Laisser un
//     exercice qu'on ne peut pas faire, c'est laisser croire qu'on l'a oublié.

import { musclesDeLExercice, patternDe } from './composition'
import { faisable, type MonMateriel } from './monMateriel'
import { outilDe } from './materiel'
import type { MuscleRegion } from './muscles'
import type { CatalogExercise } from './muscu'

/**
 * À quel point deux exercices travaillent la même chose, entre 0 et 1.
 *
 * Jaccard pondéré : on compare les parts muscle par muscle, pas les listes.
 * Deux mouvements qui visent le pectoral à 1 et 0,3 ne sont pas « d'accord sur
 * le pectoral » — l'un en fait son sujet, l'autre l'effleure.
 */
export function similarite(groupesA: string, groupesB: string): number {
  const a = musclesDeLExercice(groupesA)
  const b = musclesDeLExercice(groupesB)
  const regions = new Set<MuscleRegion>([...a.keys(), ...b.keys()])
  let commun = 0
  let total = 0
  for (const r of regions) {
    const x = a.get(r) ?? 0
    const y = b.get(r) ?? 0
    commun += Math.min(x, y)
    total += Math.max(x, y)
  }
  return total > 0 ? commun / total : 0
}

/** En dessous, ce n'est plus un équivalent : c'est un autre exercice. */
export const SIMILARITE_MIN = 0.45

/** Ce que vaut la même famille de mouvement, à muscles comparables. */
const BONUS_FAMILLE = 0.15

export interface Candidat {
  exo: CatalogExercise
  similarite: number
  /** Note de rapprochement, famille et qualité comprises. */
  score: number
}

/**
 * Le meilleur remplaçant d'un exercice, parmi ce qu'on peut faire.
 *
 * On classe sur la proximité musculaire d'abord — c'est ce qu'on cherche à
 * conserver —, puis sur la famille de mouvement (un tirage remplace un tirage),
 * puis sur la note du catalogue. Sans le troisième critère, deux équivalents
 * également proches se départageaient par l'ordre alphabétique.
 */
export function candidatsEquivalents(
  exo: { name: string; muscle_group: string },
  catalog: CatalogExercise[],
  outils: MonMateriel,
  exclus: Set<string> = new Set(),
): Candidat[] {
  const famille = patternDe(exo.name)
  const clef = exo.name.trim().toLowerCase()
  return catalog
    .filter((c) => {
      if (c.name.trim().toLowerCase() === clef) return false
      if (exclus.has(c.name.trim().toLowerCase())) return false
      return faisable(c.name, outils)
    })
    .map((c) => {
      const sim = similarite(exo.muscle_group, c.muscle_group)
      return {
        exo: c,
        similarite: sim,
        score: sim + (patternDe(c.name) === famille ? BONUS_FAMILLE : 0) + (c.score ?? 3) / 100,
      }
    })
    .filter((c) => c.similarite >= SIMILARITE_MIN)
    .sort((a, b) => b.score - a.score)
}

export function equivalentDe(
  exo: { name: string; muscle_group: string },
  catalog: CatalogExercise[],
  outils: MonMateriel,
  exclus: Set<string> = new Set(),
): CatalogExercise | null {
  return candidatsEquivalents(exo, catalog, outils, exclus)[0]?.exo ?? null
}

export interface LigneRemodelable {
  name: string
  muscle_group: string
  /** Séries déjà cochées : au-dessus de zéro, la ligne est intouchable. */
  faites: number
}

export type Sort = 'garde' | 'remplace' | 'retire'

export interface Changement {
  avant: string
  apres: string | null
  sort: Sort
  /** L'outil qui manquait, quand c'est la raison du changement. */
  outil?: string
}

export interface Remodelage<T> {
  lignes: T[]
  changements: Changement[]
}

/**
 * Remodèle une liste d'exercices sous la contrainte du matériel présent.
 *
 * `remplacer` reçoit la ligne d'origine et son remplaçant : c'est l'appelant
 * qui sait fabriquer sa propre ligne (charge conseillée, cases de séries,
 * notes). Ce module ne connaît que les exercices.
 */
export function remodeler<T extends LigneRemodelable>(
  lignes: T[],
  catalog: CatalogExercise[],
  outils: MonMateriel,
  remplacer: (ligne: T, par: CatalogExercise) => T,
): Remodelage<T> {
  const changements: Changement[] = []
  const sortie: T[] = []
  // Ce qui est déjà dans la séance ne peut pas y entrer une seconde fois.
  const pris = new Set(lignes.map((l) => l.name.trim().toLowerCase()))

  for (const l of lignes) {
    if (faisable(l.name, outils)) {
      sortie.push(l)
      continue
    }
    const outil = outilDe(l.name)
    // Une série cochée est un fait. On la garde, et on le dit.
    if (l.faites > 0) {
      sortie.push(l)
      changements.push({ avant: l.name, apres: null, sort: 'garde', outil })
      continue
    }
    const par = equivalentDe(l, catalog, outils, pris)
    if (!par) {
      changements.push({ avant: l.name, apres: null, sort: 'retire', outil })
      continue
    }
    pris.add(par.name.trim().toLowerCase())
    sortie.push(remplacer(l, par))
    changements.push({ avant: l.name, apres: par.name, sort: 'remplace', outil })
  }
  return { lignes: sortie, changements }
}
