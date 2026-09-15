import { fetchKv, saveKv } from './kv'

// L'écran qui s'assombrit pendant qu'on mesure.
//
// ── Ce que c'est, et ce que ce n'est PAS ────────────────────────────────────
//
// C'est un voile noir par-dessus l'application. L'écran reste ALLUMÉ — il le
// doit : le Bluetooth du navigateur s'arrête dès que la page passe en
// arrière-plan, et c'est justement pour ça que le capteur tient un verrou
// d'écran. Éteindre pour de bon couperait la mesure qu'on est en train de
// prendre.
//
// Aucune interface web ne peut baisser la luminosité du rétroéclairage : il
// n'existe pas d'API pour ça, ni dans la spécification ni dans Chrome. Sur un
// écran OLED, noircir les pixels économiserait vraiment de la batterie ; sur la
// dalle IPS d'un XCover 7, le rétroéclairage reste au même niveau et le gain se
// limite à ce que le processeur graphique ne dessine plus.
//
// Ce que ça apporte réellement, et c'est déjà beaucoup :
//
//   · on ne s'éblouit pas la nuit, et le téléphone cesse de clignoter dans le
//     coin de l'œil pendant deux minutes d'immobilité ;
//   · surtout, plus de touche accidentelle. Un téléphone posé sur le banc
//     pendant une série, c'est un écran vivant sous une serviette — et c'est
//     comme ça qu'on abandonne une séance sans l'avoir voulu.

const CLE = 'cardio_veilleuse'

/**
 * Au bout de combien de temps sans geste on assombrit.
 *
 * Une minute. Assez pour lire un écran et décider, trop court pour qu'on
 * l'oublie — et c'est la valeur demandée.
 */
export const DELAI_S = 60

export async function loadVeilleuse(userId: string): Promise<boolean> {
  return (await fetchKv<boolean>(userId, CLE, false)) === true
}

export async function saveVeilleuse(userId: string, on: boolean): Promise<boolean> {
  await saveKv(userId, CLE, on)
  return on
}

/**
 * Le temps est-il écoulé depuis le dernier geste ?
 *
 * Les deux instants sont passés en paramètre plutôt que lus ici : une fonction
 * qui appelle `Date.now()` elle-même ne se contrôle pas — on ne peut pas lui
 * faire jouer une minute en trois millisecondes.
 */
export function doitSassombrir(dernierGeste: number, maintenant: number, delaiS = DELAI_S): boolean {
  if (!(delaiS > 0)) return false
  return maintenant - dernierGeste >= delaiS * 1000
}

/**
 * Le geste tombe-t-il dans la moitié basse ?
 *
 * C'est la moitié qu'on atteint du pouce sans changer de prise, et c'est
 * surtout celle qu'on ne touche PAS en saisissant le téléphone : on l'attrape
 * par le haut ou par les bords. Un voile qui se lèverait au moindre contact ne
 * servirait à rien dans une poche ou sous une serviette.
 *
 * Une hauteur nulle ou absurde ne rend pas `true` par accident : sans écran
 * mesurable on refuse, et le voile se lève par les autres moyens.
 */
export function moitieBasse(y: number, hauteur: number): boolean {
  if (!(hauteur > 0)) return false
  return y > hauteur / 2
}
