import { estRessenti, type MuscuSession } from './muscu'
import { clefReference } from '../data/exercises'

// Combien de fois tu as fait chaque exercice, et ce que le générateur en déduit.
//
// Deux besoins opposés, et c'est tout l'intérêt :
//
//   • REVENIR sur les mêmes mouvements. Une charge ne progresse que si on la
//     compare à elle-même ; un générateur qui propose un exercice différent
//     chaque fois produit une séance jouable mais aucune progression lisible, et
//     une colonne de « ? kg » là où la charge conseillée sert le plus.
//
//   • TOURNER quand même. Au bout d'une dizaine de séances sur le même
//     mouvement, le gain marginal s'épuise, les mêmes angles s'entretiennent et
//     les mêmes tendons prennent tout. Il faut alors dériver — mais doucement,
//     pas d'un coup, sinon on repart à zéro sur la charge du jour au lendemain.
//
// D'où une courbe qui monte puis redescend, au lieu d'un bonus constant.

/**
 * Fenêtre de comptage, en jours.
 *
 * On ne compte pas depuis toujours : un exercice fait trente fois il y a deux
 * ans serait pénalisé à vie alors qu'il est redevenu neuf. Quatre mois laissent
 * largement le temps d'atteindre la dizaine à une ou deux séances par semaine,
 * et oublient le reste.
 */
export const FENETRE_JOURS = 120

/**
 * Séances au-delà desquelles on commence à tourner.
 *
 * Dix, comme demandé. C'est aussi l'ordre de grandeur où un cycle de force
 * cesse de produire : au-delà, on entretient plus qu'on ne progresse.
 */
export const SEUIL_ROTATION = 10

/**
 * Bonus au sommet, atteint à `SEUIL_ROTATION` séances.
 *
 * La montée n'est plus linéaire, et c'est le point : les premiers retours
 * comptent bien plus que les derniers. À +0,05 par séance, un exercice fait UNE
 * fois valait 1,05 — trois centièmes d'écart avec un mouvement jamais vu, soit
 * rien du tout. Or c'est exactement là que le retour est le plus utile : la
 * double progression de `lib/charge` a besoin de DEUX passages pour dire quoi
 * que ce soit, et de trois pour détecter un palier. Un générateur qui met dix
 * séances à préférer un mouvement connu ne produit jamais ces trois passages.
 *
 * En racine, le premier retour vaut +16 % au lieu de +5 % — trois fois plus de
 * poids là où le catalogue est encore neuf, et le même sommet à l'arrivée, donc
 * rien ne change pour un exercice déjà rodé.
 */
const SOMMET = 0.5

/**
 * Perte par séance au-delà du seuil.
 *
 * Presque deux fois la montée : la descente doit être perceptible, sinon la
 * rotation n'arrive jamais. À ce rythme il faut six séances de plus pour que
 * l'exercice repasse sous un mouvement neuf — c'est la « dérive douce », pas une
 * bascule.
 */
const DESCENTE = 0.09

/** Plancher : même sur-utilisé, un exercice reste jouable si rien ne le remplace. */
const PLANCHER = 0.6

export type Familiarites = Map<string, number>

/**
 * Clé de comparaison d'un nom d'exercice.
 *
 * `clefReference` et non `toLowerCase()` : le compteur mesure « combien de fois
 * ce MOUVEMENT », et un exercice renommé au catalogue en cours de route repartait
 * de zéro — c'est-à-dire qu'il perdait précisément le crédit que ce module
 * existe pour lui donner.
 */
export function clefExo(nom: string): string {
  return clefReference(nom)
}

/**
 * Combien de fois chaque exercice a été fait dans la fenêtre.
 *
 * Une séance compte pour UNE, même si l'exercice y apparaît deux fois : ce qu'on
 * mesure est le nombre de séances passées dessus, pas le nombre de lignes.
 */
export function familiarites(sessions: MuscuSession[], now = Date.now()): Familiarites {
  const limite = new Date(now - FENETRE_JOURS * 86400000).toLocaleDateString('en-CA')
  const out: Familiarites = new Map()
  for (const s of sessions) {
    if (s.date < limite) continue
    const vus = new Set<string>()
    for (const e of s.exercises) {
      if (estRessenti(e.name)) continue
      const k = clefExo(e.name)
      if (vus.has(k)) continue
      vus.add(k)
      out.set(k, (out.get(k) ?? 0) + 1)
    }
  }
  return out
}

/**
 * Multiplicateur de score d'un exercice selon le nombre de séances déjà faites.
 *
 * ```
 *  0 séance  → 1,00   jamais fait : neutre, on ne le favorise ni ne l'écarte
 *  1         → 1,16   le premier retour est le plus précieux : il ouvre la
 *                     comparaison de charge, qui n'existe pas à un passage
 *  2         → 1,22   la double progression a de quoi mordre
 *  3         → 1,27   un palier devient détectable
 *  5         → 1,35
 * 10         → 1,50   sommet : c'est là qu'on progresse le mieux
 * 12         → 1,32   la dérive commence
 * 16         → 0,96   il passe sous un mouvement neuf — la rotation a lieu
 * 20         → 0,60   plancher
 * ```
 */
export function poidsFamiliarite(n: number): number {
  if (n <= 0) return 1
  const sommet = 1 + SOMMET
  // En racine : concave, donc le gain marginal décroît. Les trois premiers
  // passages — ceux dont la progression de charge a besoin — pèsent plus de la
  // moitié du bonus total.
  if (n <= SEUIL_ROTATION) return 1 + SOMMET * Math.sqrt(n / SEUIL_ROTATION)
  return Math.max(PLANCHER, sommet - DESCENTE * (n - SEUIL_ROTATION))
}

/** Vrai quand l'exercice a passé le seuil et commence à être remplacé. */
export function enRotation(n: number): boolean {
  return n > SEUIL_ROTATION
}

/** « nouveau », « 7e séance », « on tourne (14) » — ce qu'on affiche à côté. */
export function fmtFamiliarite(n: number): string {
  if (n <= 0) return 'nouveau'
  if (enRotation(n)) return `on tourne · ${n}ᵉ`
  return n === 1 ? '1re séance' : `${n}ᵉ séance`
}
