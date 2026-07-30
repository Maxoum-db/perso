import { groupLoads, type GroupLoad, type MuscuSession } from './muscu'
import { applyCourbatures, type Courbatures } from './soreness'
import { applySommeil, type Nuits } from './sommeil'

/**
 * La charge de récupération de chaque groupe, tout compris.
 *
 * Trois corrections s'empilent sur le calcul automatique, et elles doivent
 * s'empiler DANS CET ORDRE partout :
 *
 *   1. `groupLoads` — les jours écoulés, pondérés par la part du muscle dans
 *      l'exercice et par l'intensité déclarée de la séance ;
 *   2. `applySommeil` — les nuits depuis la séance, qui repose le plafond orange
 *      après coup (un bon sommeil n'efface pas la journée qui vient de passer) ;
 *   3. `applyCourbatures` — ton ressenti déclaré à la main, qui a le dernier mot
 *      parce que c'est le seul des trois qui vienne de toi.
 *
 * Une seule définition : la chaîne vivait recopiée à deux endroits de la page,
 * et le seul précédent de règle dupliquée dans ce module — le « 0 = pas de
 * déclaration » des courbatures — avait fini par diverger d'un côté sans qu'on
 * le voie. On ne recommence pas.
 */
export function chargesCourantes(
  sessions: MuscuSession[],
  courbatures: Courbatures,
  nuits: Nuits,
): Record<string, GroupLoad> {
  return applyCourbatures(applySommeil(groupLoads(sessions), nuits), courbatures)
}
