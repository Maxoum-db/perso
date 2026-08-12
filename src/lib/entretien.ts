import { kcalNet, sessionCalories } from './calories'
import {
  FACTEUR_NEAT,
  KCAL_PAR_KG,
  depenseParHeure,
  metabolismeDeBase,
  penteHebdo,
  poidsHistorique,
  type Profil,
} from './profil'
import type { MuscuSession } from './muscu'
import type { Weighin } from './workouts'

// L'apport d'entretien, mois par mois.
//
// La carte Balance sait déjà le déduire pour la période en cours : dépense
// estimée, plus l'écart que trahit la pente de la courbe de poids. Mais elle ne
// le déduit que pour MAINTENANT, et le recalcule à chaque affichage. Rien ne
// garde trace de ce que valait cet entretien il y a trois mois.
//
// C'est dommage, parce que c'est la seule mesure de fond disponible ici. Elle
// répond à une question que ni la balance ni le mètre ne posent : est-ce que je
// mange plus qu'avant à poids égal — donc est-ce que le moteur a grossi ?
//
// La règle est la même que celle du bilan, appelée sur une autre fenêtre. Pas
// une seconde formule : la même, sur un mois donné.
//
//     entretien = dépense de base + sport net + (pente × 7700 / 7)
//
// Une mise en garde qui compte, et elle est écrite à l'écran : la pente d'un
// seul mois est bruitée. Quatre à huit pesées, ±0,15 kg/semaine d'incertitude,
// c'est ±165 kcal/jour. Un point isolé ne veut donc pas dire grand-chose ; ce
// qui se lit, c'est la SUITE des points.

/**
 * En dessous, la pente du mois est trop bruitée pour porter une conclusion.
 *
 * Huit pesées, c'est deux par semaine. En dessous, l'incertitude de la pente
 * dépasse largement ce qu'on cherche à lire : un mois à quatre pesées peut
 * afficher 600 kcal d'écart avec son voisin sans que rien n'ait changé.
 */
export const PESEES_FIABLES = 8

export interface MoisEntretien {
  /** Premier jour du mois, en ISO. */
  debut: string
  /** « août 2026 ». */
  label: string
  /** Apport d'entretien déduit, kcal/jour. Null si le mois est trop maigre. */
  entretien: number | null
  /** Dépense estimée du mois, kcal/jour. */
  depense: number | null
  /** Pente du poids sur le mois, kg/semaine. */
  pente: number | null
  /** Poids moyen retenu pour le métabolisme de base. */
  poidsKg: number | null
  /** Nombre de pesées dans le mois — c'est lui qui dit si on peut croire le point. */
  pesees: number
  /** Assez de pesées pour que le point porte une conclusion. */
  fiable: boolean
}

/** Premier jour du mois d'une date ISO. */
function debutDeMois(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

const iso = (d: Date) => d.toLocaleDateString('en-CA')

/**
 * Un point par mois civil, du plus ancien au plus récent.
 *
 * Mois CIVILS et non fenêtres glissantes : deux fenêtres qui se chevauchent
 * partagent leurs pesées, donc leurs points se ressemblent par construction et
 * la courbe paraît lisse alors qu'elle ne l'est pas. Un mois civil est un
 * échantillon indépendant du suivant — ce qui rend la suite bruitée, mais
 * honnête.
 */
export function entretienParMois(
  sessions: MuscuSession[],
  weighins: Weighin[],
  profil: Profil,
  mois = 6,
): MoisEntretien[] {
  const poidsDuJour = poidsHistorique(weighins)
  const out: MoisEntretien[] = []
  const courant = debutDeMois(new Date())

  for (let i = mois - 1; i >= 0; i--) {
    const debut = new Date(courant.getFullYear(), courant.getMonth() - i, 1)
    const fin = new Date(courant.getFullYear(), courant.getMonth() - i + 1, 0)
    const debutStr = iso(debut)
    const finStr = iso(fin)
    const label = debut.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    const duMois = weighins.filter((w) => w.date >= debutStr && w.date <= finStr)
    // Le poids de référence du mois : celui du milieu, pas celui d'un bout.
    // Prendre la première pesée d'un mois de perte surestime le métabolisme
    // tout le mois, prendre la dernière le sous-estime.
    const poidsKg = poidsDuJour(iso(new Date((debut.getTime() + fin.getTime()) / 2)))
    const pente = penteHebdo(
      duMois.map((w) => ({ date: w.date, value: w.weight_kg })),
      // Fenêtre comptée depuis aujourd'hui : on lui donne de quoi couvrir tout
      // le mois visé, le filtrage par dates a déjà été fait au-dessus.
      Math.ceil((Date.now() - debut.getTime()) / 86400000) + 1,
    )
    const bmr = poidsKg ? metabolismeDeBase(profil, poidsKg) : null

    let depense: number | null = null
    if (bmr !== null) {
      // Le mois en cours n'est pas fini : diviser sa dépense par trente et un
      // jours quand on est le 12 la ferait paraître trois fois plus basse
      // qu'elle n'est, et l'entretien du mois courant s'effondrerait chaque
      // début de mois pour remonter tout seul ensuite.
      const jours = finStr > iso(new Date()) ? new Date().getDate() : fin.getDate()
      const parHeure = depenseParHeure(bmr)
      // On somme séance par séance plutôt que d'appeler `bilanCalories` : ce
      // bilan-là est ancré sur AUJOURD'HUI, ses cases partent du jour même et
      // remontent — un mois passé tomberait entièrement hors de sa fenêtre et
      // rendrait zéro. Les définitions employées, elles, sont bien les siennes :
      // même coût de séance, même dépense nette.
      const sport = sessions
        .filter((s) => s.date >= debutStr && s.date <= finStr)
        .reduce((n, s) => n + kcalNet(sessionCalories(s, poidsDuJour), parHeure), 0)
      depense = Math.round(bmr * FACTEUR_NEAT) + Math.round(sport / Math.max(1, jours))
    }

    out.push({
      debut: debutStr,
      label,
      poidsKg,
      pesees: duMois.length,
      fiable: duMois.length >= PESEES_FIABLES,
      pente,
      depense,
      entretien:
        depense !== null && pente !== null ? Math.round(depense + (pente * KCAL_PAR_KG) / 7) : null,
    })
  }
  return out
}

/**
 * Ce que la suite raconte : la dérive de l'entretien entre le premier et le
 * dernier mois FIABLES, en kcal/jour.
 *
 * Fiables, et pas seulement exploitables : c'est un chiffre de titre, et un
 * titre construit sur deux mois à quatre pesées annonce des dérives de six
 * cents kilocalories qui n'existent pas. Mieux vaut ne rien dire que dire ça.
 *
 * Null tant qu'il n'y a pas deux mois à comparer — un seul point n'est pas une
 * tendance, et l'annoncer comme telle serait pire que se taire.
 */
export function deriveEntretien(mois: MoisEntretien[]): { delta: number; de: string; a: string } | null {
  const utiles = mois.filter((m) => m.entretien !== null && m.fiable)
  if (utiles.length < 2) return null
  const premier = utiles[0]
  const dernier = utiles[utiles.length - 1]
  return { delta: dernier.entretien! - premier.entretien!, de: premier.label, a: dernier.label }
}
