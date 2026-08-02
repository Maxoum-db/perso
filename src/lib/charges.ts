import { PAS_HEURES, groupLoads, type GroupLoad, type MuscuSession } from './muscu'
import { rattacherCourbatures, type Courbatures } from './soreness'
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
 *   3. `rattacherCourbatures` — ton ressenti déclaré à la main, qui a le dernier
 *      mot parce que c'est le seul des trois qui vienne de toi. Il n'est pas
 *      APPLIQUÉ ici mais rattaché : une déclaration porte sur un muscle, une
 *      charge sur un libellé de groupe, et un libellé couvre jusqu'à
 *      trente-huit muscles. C'est `reposParMuscle` qui la consomme, là où les
 *      muscles existent — sinon une courbature déclarée au cou aurait continué
 *      de reculer tout ce qu'une marche du fermier touche.
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
  maintenant = Date.now(),
): Record<string, GroupLoad> {
  const jour = new Date(maintenant).toLocaleDateString('en-CA')
  return rattacherCourbatures(applySommeil(groupLoads(sessions, maintenant), nuits, jour), courbatures)
}

// ── Projection ──────────────────────────────────────────────────────────────

/**
 * Les horizons proposés au mannequin.
 *
 * Des multiples de 12 h, et pas un réglage libre : l'horloge de récupération
 * avance par sections de 12 h (`PAS_HEURES`), donc « +6 h » afficherait
 * exactement la même image qu'aujourd'hui et donnerait l'impression que le
 * bouton ne marche pas. Chaque cran d'ici change vraiment quelque chose.
 */
export const HORIZONS: Array<{ id: string; court: string; heures: number; phrase: string }> = [
  { id: 'now', court: 'Auj.', heures: 0, phrase: "aujourd'hui" },
  { id: 'h12', court: '+12 h', heures: PAS_HEURES, phrase: 'dans 12 h' },
  { id: 'j1', court: '+1 j', heures: 24, phrase: 'demain' },
  { id: 'j2', court: '+2 j', heures: 48, phrase: 'après-demain' },
]

/**
 * La récupération telle qu'elle sera dans `heures` heures, si rien ne change.
 *
 * « Si rien ne change » est à prendre au pied de la lettre, et c'est voulu :
 *
 *   • aucune séance n'est ajoutée — c'est justement la question posée, « qu'est-ce
 *     qui sera prêt si je ne fais rien d'ici là » ;
 *   • les nuits à venir ne sont pas renseignées, donc neutres. Le modèle ne
 *     devine pas un bon sommeil : la projection n'avance que par l'horloge. Bien
 *     dormi, tu seras un peu en avance sur ce qu'elle annonce, jamais en retard ;
 *   • les courbatures déclarées restent posées. Elles ont reculé le muscle d'un
 *     nombre de jours dans le barème, et ce recul ne s'évapore pas avec le temps
 *     qui passe — il se résorbe à la même vitesse que le reste.
 *
 * Le calcul est celui de `chargesCourantes`, l'horloge simplement avancée : une
 * projection qui recopierait la chaîne des corrections finirait par en oublier
 * une, et le mannequin projeté mentirait sans qu'on puisse le voir.
 */
export function chargesProjetees(
  sessions: MuscuSession[],
  courbatures: Courbatures,
  nuits: Nuits,
  heures: number,
  maintenant = Date.now(),
): Record<string, GroupLoad> {
  return chargesCourantes(sessions, courbatures, nuits, maintenant + heures * 3600000)
}
