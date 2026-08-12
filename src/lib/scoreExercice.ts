// La note sur 5 d'un exercice : ce qu'il vaut, et donc sa priorité.
//
// Le générateur classait les exercices sur la RÉCUPÉRATION des muscles qu'ils
// visent. C'est ce qu'il faut pour savoir ce qu'on PEUT faire, et ça ne dit rien
// de ce qu'on DEVRAIT faire : à muscles également frais, une élévation latérale
// et un développé militaire sortaient au même rang, alors que l'un travaille un
// faisceau et l'autre toute l'épaule avec le triceps et la sangle.
//
// La note porte trois choses. Les deux premières viennent de la demande — « les
// exercices les plus complets et les plus efficaces » ; la troisième vient de la
// salle :
//
//   • COMPLET — combien de muscles le mouvement charge réellement. Un muscle ne
//     compte que s'il prend au moins la moitié de l'effort (PART_COMPTABLE) :
//     sinon un étiquetage bavard vaudrait une note.
//   • EFFICACE — la famille de mouvement. Un polyarticulaire (pousser, tirer,
//     charnière, genou, portage) rend plus par série qu'une isolation : plus de
//     charge, plus de masse mobilisée, plus de transfert.
//   • FAISABLE — le matériel, identifié exercice par exercice dans lib/materiel.
//     Le meilleur exercice du monde ne vaut rien s'il demande un traîneau, un
//     harnais de nuque ou un anneau de préhension que la salle n'a pas. Un
//     élastique, une sangle de suspension : une fois sur deux. Le socle toujours
//     présent : barres, haltères, kettlebells, poulies, machines, bancs, barre
//     de traction, barres à dips et tapis.
//
// La note calculée n'est qu'un DÉFAUT. Elle vit dans le catalogue, où elle se
// modifie à la main : c'est la note enregistrée qui l'emporte dès qu'il y en a
// une. Ce que le calcul ignore — « ça me tire sur l'AC droite », « je n'ai pas
// la machine » — n'appartient qu'à celui qui s'entraîne.

import { PART_COMPTABLE, musclesDeLExercice, patternDe } from './composition'
// Le matériel est identifié UNE fois, dans lib/materiel : c'est le même besoin
// qui décide de la note et de l'ordre de la séance. Deux listes d'accessoires
// auraient fini par diverger, et on aurait noté un exercice sur un matériel que
// la séance ne regroupait pas.
import { malusMateriel } from './materiel'

export const SCORE_MIN = 1
export const SCORE_MAX = 5
/** La note d'un exercice sans particularité : ni promu, ni écarté. */
export const SCORE_NEUTRE = 3

/** Familles polyarticulaires : beaucoup de masse, beaucoup de transfert. */
const POLYARTICULAIRES = new Set(['poussee', 'tirage', 'hanche', 'genou', 'portage'])

/**
 * Versions guidées ou assistées d'un gros mouvement : un cran en dessous.
 *
 * La machine tient l'équilibre à la place du corps — c'est justement la part du
 * travail qui ne se voit pas sur la barre. Une traction assistée sortait à 5/5,
 * au même rang qu'une traction ; elles ne valent pas la même chose.
 *
 * Uniquement sur les polyarticulaires : sur une isolation, la machine ne
 * remplace rien qui existait. Des mollets assis à la machine sont des mollets.
 */
const GUIDES = /assist|à la machine|\(machine\)|barre guidée|smith|\bhack\b|presse à cuisses/i

/**
 * Mouvements à UNE articulation que `patternDe` range quand même dans « pousser »
 * ou « tirer ».
 *
 * Ce n'est pas une erreur de `patternDe` : il sert au ratio pousser/tirer de
 * l'épaule, et un écarté tire bien l'épaule vers l'avant. Mais pour la NOTE, ce
 * qui compte est le nombre d'articulations mises en jeu — un écarté n'ouvre que
 * l'épaule, un développé couché ouvre l'épaule et le coude. Sans cette liste, un
 * écarté sortait au même rang qu'un développé couché.
 */
const MONOARTICULAIRES = /écarté|ecarte|pull-over|oiseau|rétraction scapulaire|tirage bras tendus|suspension à la barre|pompe scapulaire|élévation|elevation/i

export function borner(n: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(n)))
}

/** Combien de muscles le mouvement charge pour de bon. */
export function musclesCharges(groupes: string): number {
  let n = 0
  for (const part of musclesDeLExercice(groupes).values()) if (part >= PART_COMPTABLE) n++
  return n
}

/**
 * La note par défaut d'un exercice, déduite de son nom et de son étiquetage.
 *
 * Le barème, en clair :
 *   1,5 de base
 *   + 1,5 polyarticulaire · + 0,5 gainage · + 0 isolation
 *   + 2 à partir de 8 muscles chargés · + 1,5 à 6 · + 1 à 4 · + 0,5 à 2
 *
 * Ce qui donne 5 au soulevé de terre et à la traction, 4 au développé couché et
 * à la traction assistée, 3 à la planche, 2 au curl et aux mollets. C'est la
 * hiérarchie qu'on retrouve dans n'importe quel programme sérieux — et elle sort
 * du calcul, pas d'une liste de 300 notes écrites à la main qui aurait vieilli
 * au premier exercice ajouté.
 *
 * Puis le matériel : ce qu'on ne trouve pas en salle descend d'un ou deux crans,
 * et c'est la seule façon d'atteindre 1/5 par le calcul. « À éviter » ne se
 * déduit pas d'un mouvement — sauf quand on ne peut pas le faire.
 *
 * Le nom compte autant que les muscles : c'est lui qui porte la famille de
 * mouvement (`patternDe`), l'étiquetage ne la dit pas.
 */
export function scoreParDefaut(nom: string, groupes: string): number {
  const famille = patternDe(nom)
  const poly = POLYARTICULAIRES.has(famille) && !MONOARTICULAIRES.test(nom)
  let note = 1.5 + (poly ? 1.5 : famille === 'gainage' ? 0.5 : 0)
  if (poly && GUIDES.test(nom)) note -= 1
  const charges = musclesCharges(groupes)
  if (charges >= 8) note += 2
  else if (charges >= 6) note += 1.5
  else if (charges >= 4) note += 1
  else if (charges >= 2) note += 0.5
  return borner(note - malusMateriel(nom))
}

/**
 * Ce que la note pèse dans le classement du générateur.
 *
 * De 0,7 à 1,3 : assez pour qu'un 5 passe devant un 3 à récupération
 * comparable, pas assez pour qu'un 5 sur un muscle courbaturé passe devant un 2
 * sur un muscle frais. La récupération reste le premier critère — c'est elle qui
 * décide de ce qui est possible, la note ne fait que trier ce qui l'est.
 */
export function poidsScore(score: number): number {
  return 0.55 + 0.15 * Math.max(SCORE_MIN, Math.min(SCORE_MAX, score))
}
