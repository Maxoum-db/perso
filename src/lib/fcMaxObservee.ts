import type { CardiosSeances } from './cardioSeance'

// La fréquence maximale, relevée sur le terrain plutôt qu'estimée.
//
// ── Pourquoi c'est le réglage qui compte le plus ────────────────────────────
//
// Tout en dépend : les cinq zones, le seuil sous lequel on refuse de convertir
// la fréquence en calories, la charge de la semaine. Et elle est ESTIMÉE par
// défaut, avec la formule de Tanaka, dont l'écart-type est de ±10 bpm — assez
// pour décaler chaque zone d'un cran entier. Quelqu'un dont la vraie maximale
// est 198 et à qui l'on en suppose 188 croit travailler au seuil alors qu'il
// est en endurance.
//
// Or la vraie valeur passe régulièrement sous le nez de l'application : chaque
// séance garde son maximum. Il suffisait de regarder.
//
// ── Pourquoi on PROPOSE, et qu'on n'applique jamais ─────────────────────────
//
// Un capteur optique produit des artefacts. Un brassard qui glisse, un appui
// sur la sangle, et une trame part à 210 sans que le cœur ait bougé. Le maximum
// d'une séance est le maximum d'UNE trame : il suffit d'une aberrante.
//
// On ne peut pas distinguer l'artefact de l'effort par le calcul — les deux
// sont un nombre élevé au milieu de nombres plus bas. Mais la personne, elle,
// se souvient si elle a tout donné en côte ce jour-là. On lui montre donc la
// séance, sa date et son nombre de trames, et c'est elle qui tranche.

/** Les bornes d'une fréquence maximale humaine — les mêmes que la saisie manuelle. */
export const FCMAX_MIN = 120
export const FCMAX_MAX = 230

export interface Proposition {
  /** La valeur observée, qui deviendrait la nouvelle maximale. */
  bpm: number
  /** L'identifiant de la séance où elle a été atteinte. */
  sessionId: string
  /** Nombre de trames de cette séance — ce qui dit si le chiffre est solide. */
  mesures: number
  /** De combien elle dépasse la valeur actuellement retenue. */
  gain: number
}

/**
 * Cherche une fréquence observée qui dépasse celle retenue.
 *
 * `null` quand il n'y a rien à proposer : aucune séance mesurée, aucune qui
 * dépasse, ou une valeur hors des bornes humaines. Trois situations qui ne se
 * distinguent pas à l'écran — dans les trois cas il n'y a rien à afficher — et
 * qui ne se confondent pas dans le code, où seule la dernière est une anomalie.
 */
export function chercherFcMax(cardios: CardiosSeances, retenue: number | null): Proposition | null {
  let meilleure: Proposition | null = null
  for (const [sessionId, c] of Object.entries(cardios)) {
    const bpm = c.max
    if (typeof bpm !== 'number' || !Number.isFinite(bpm)) continue
    // Hors bornes : ce n'est pas un record, c'est une trame folle. On l'écarte
    // sans rien dire plutôt que de proposer 247 bpm à quelqu'un.
    if (bpm < FCMAX_MIN || bpm > FCMAX_MAX) continue
    // Rien à proposer si ça ne dépasse pas ce qui est déjà retenu. Le `>` est
    // strict : reproposer la valeur en place ferait clignoter un bandeau que
    // l'on ne peut pas faire taire.
    if (retenue !== null && bpm <= retenue) continue
    if (meilleure && bpm <= meilleure.bpm) continue
    meilleure = { bpm, sessionId, mesures: c.mesures, gain: retenue === null ? 0 : bpm - retenue }
  }
  return meilleure
}

/**
 * Ce que le changement déplacerait, en bpm, sur la frontière d'une zone.
 *
 * Sert à dire pourquoi ça vaut la peine : « tes zones se décalent de 4 bpm »
 * est concret, « ta maximale change » ne l'est pas.
 */
export function decalageZone(ancienne: number, nouvelle: number, partZone: number): number {
  return Math.round((nouvelle - ancienne) * partZone)
}
