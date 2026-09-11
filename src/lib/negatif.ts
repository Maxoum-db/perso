import { declarationParLigne } from './parLigne'

// « J'ai accompagné la descente. »
//
// Le négatif : au lieu de laisser le poids redescendre, on le freine. Trois
// secondes pour revenir en position basse d'un curl, pour remonter d'un dip,
// pour reposer la barre. C'est une manière de faire, pas un exercice — elle
// s'applique à n'importe quelle ligne, d'où la case plutôt qu'une entrée au
// catalogue.
//
// ── Ce n'est PAS d'autres muscles ───────────────────────────────────────────
//
// C'est la première idée qui vient, et elle est fausse : sur un curl freiné, ce
// n'est pas le triceps qui retient, c'est le BICEPS. Il se laisse allonger sous
// tension au lieu de se raccourcir — on appelle ça une contraction excentrique.
// L'antagoniste ne descend pas la charge ; la gravité s'en charge, et
// l'agoniste freine. Déclarer d'autres muscles sur une ligne au négatif ferait
// donc mentir le mannequin dans les deux sens à la fois : il donnerait pour
// travaillés des muscles qui n'ont rien fait, et pour reposés ceux qui viennent
// de prendre le plus gros de la séance.
//
// ── Ce qui change vraiment : le prix ────────────────────────────────────────
//
// Un muscle freine plus lourd qu'il ne soulève, et surtout la phase excentrique
// est de loin celle qui abîme le plus la fibre — c'est elle qui fait les
// courbatures du surlendemain. Les mêmes muscles, donc, mais plus chers : la
// coche ajoute des jours de récupération là où l'exercice en donnait déjà.
//
// Le miroir exact de la « version douce », qui dit « ça n'a rien coûté ». Ici
// on dit « ça a coûté plus que ce que le barème croit ».
//
// ── Ce que la coche ne touche pas ───────────────────────────────────────────
//
// Ni le tonnage, ni la charge conseillée. Freiner 40 kg, c'est 40 kg : gonfler
// le tonnage fausserait l'historique, et la progression proposerait la fois
// suivante une charge qu'on n'a jamais soulevée.

export type Negatifs = Record<string, true>

const NEGATIF = declarationParLigne<true>('muscu_negatif')

/** La clé KV de cette déclaration — distincte de celle des autres, cf. `lib/parLigne`. */
export const CLE_NEGATIF = NEGATIF.cleKv
export const clefNegatif = NEGATIF.clef
export const loadNegatifs = NEGATIF.load
export const nettoyerNegatifs = NEGATIF.nettoyer

/** Réécrit les lignes déclarées au négatif d'UNE séance. Celles qui n'y sont plus disparaissent. */
export function saveNegatifs(
  userId: string,
  sessionId: string,
  noms: string[],
  connues: Negatifs,
): Promise<Negatifs> {
  return NEGATIF.save(userId, sessionId, noms.map((nom) => ({ nom, valeur: true as const })), connues)
}

/**
 * Jours de récupération ajoutés à un MOTEUR PRINCIPAL par une ligne freinée.
 *
 * Une demi-journée, soit le pas du mannequin, et la moitié de ce que coûte une
 * séance déclarée « à fond » (+1 j). L'ordre de grandeur est celui-là : le
 * négatif accentué fatigue nettement plus, sans être une catégorie d'effort à
 * lui seul — et les deux s'additionnent, une séance à fond faite au négatif
 * coûtant bien 1 j ½ sur son moteur principal.
 *
 * ⚠️ Asymétrie assumée, la même que partout ailleurs dans le module : se
 * tromper en s'accordant du repos ne coûte rien, se tromper dans l'autre sens,
 * si.
 */
export const JOURS_NEGATIF = 0.5

/**
 * Ce que la ligne freinée ajoute à CE muscle-ci, sa part dans l'exercice
 * comprise.
 *
 * Pondération linéaire, comme `recupIntensite` et pour la même raison : une
 * demi-journée entière sur un stabilisateur à 30 % n'aurait aucun sens, c'est
 * le moteur principal qui encaisse le freinage.
 */
export function recupNegatif(negatif: boolean | undefined, partDuMuscle = 1): number {
  return negatif ? JOURS_NEGATIF * partDuMuscle : 0
}
