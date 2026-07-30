import { ancienneteEnJours, estRessenti, parseGroupEntries, type MuscuSession } from './muscu'
import { RECUPERATION_NAMES } from '../data/exercises'
import { regionsForGroup, type MuscleRegion } from './muscles'

// Ce qui est arrivé en dernier à chaque muscle.
//
// La couleur dit OÙ EN EST un muscle ; elle ne dit pas POURQUOI. Entre un
// développé couché et vingt minutes de sangle, le pectoral peut afficher la
// même teinte sans que ça veuille dire la même chose. Deux lignes suffisent à
// lever le doute : ce qui l'a chargé en dernier, et ce qui l'a soulagé depuis.

export interface DernierExo {
  /** Ce qu'on affiche : l'exercice, ou la séance quand il n'y a qu'un ressenti. */
  nom: string
  date: string
  /** Ancienneté en jours, au même pas de 12 h que le reste du module. */
  jours: number
  /** Part de l'exercice consacrée à ce muscle (1 = moteur principal). */
  intensite: number
  /** Nom de la séance, pour resituer l'exercice dans son contexte. */
  seance: string
}

export interface HistoriqueMuscle {
  /** Dernier exercice qui l'a chargé. */
  travail?: DernierExo
  /** Dernière récupération active qui l'a soulagé. */
  recup?: DernierExo
}

/**
 * Pour chaque muscle, le dernier travail et la dernière récup.
 *
 * On balaie les séances de la plus récente à la plus ancienne et on garde la
 * première trouvée : inutile de tout collecter pour n'en afficher qu'une.
 */
export function historiqueParMuscle(
  sessions: MuscuSession[],
  now = Date.now(),
): Partial<Record<MuscleRegion, HistoriqueMuscle>> {
  const out: Partial<Record<MuscleRegion, HistoriqueMuscle>> = {}
  const aujourdhui = new Date(now).toLocaleDateString('en-CA')

  // Du plus récent au plus ancien : le premier vu est le bon.
  const triees = [...sessions]
    .filter((s) => s.date <= aujourdhui)
    .sort((a, b) => b.date.localeCompare(a.date))

  for (const s of triees) {
    const jours = ancienneteEnJours(s, now)
    for (const e of s.exercises) {
      const estRecup = RECUPERATION_NAMES.has(e.name.trim().toLowerCase())
      // Une ligne de ressenti n'a pas de nom d'exercice utile — « Ressenti de
      // séance » ne dit rien. C'est la séance elle-même qui porte le sens :
      // « Béhourd — sparring » vaut mieux que « Ressenti de séance ».
      const nom = estRessenti(e.name) ? s.name : e.name
      for (const g of parseGroupEntries(e.muscle_group)) {
        for (const region of regionsForGroup(g.name)) {
          const cur = out[region] ?? {}
          const champ = estRecup ? 'recup' : 'travail'
          if (cur[champ]) continue
          cur[champ] = { nom, date: s.date, jours, intensite: g.intensity, seance: s.name }
          out[region] = cur
        }
      }
    }
  }
  return out
}
