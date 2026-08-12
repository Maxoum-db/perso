// « À quelle allure je l'ai fait ? »
//
// Sur un exercice chiffré, la charge dit l'effort : cent kilos au développé
// couché ne sont pas quarante, et le facteur d'effort (lib/effort) le sait. Sur
// un exercice mesuré en TEMPS ou en DISTANCE — rameur, gainage, marche du
// fermier, traîneau —, il n'y a rien à comparer : le facteur vaut 1, et vingt
// minutes de rameur en récupération pesaient exactement autant que vingt
// minutes à fond.
//
// L'allure est ce qui manquait. Elle emploie la MÊME échelle que l'intensité de
// séance — tranquille, normal, soutenu, à fond — parce que c'est la même
// question posée plus près : « qu'est-ce que tu as mis dedans ? ». Deux échelles
// pour une seule question auraient fini par ne plus vouloir dire la même chose.
//
// Elle l'emporte sur l'intensité de la séance POUR CET EXERCICE-LÀ, et sur lui
// seul : la plus précise gagne. Une séance tranquille où l'on s'arrache sur le
// rameur, ça existe, et c'est même le cas courant d'une fin de séance.
//
// Stockage : comme les versions douces, et pour la même raison — enregistrer
// une séance SUPPRIME puis réinsère toutes ses lignes, donc les identifiants de
// ligne changent à chaque fois. On indexe par séance + nom d'exercice, qui, eux,
// survivent.

import { fetchKv, saveKv } from './kv'
import type { IntensiteId } from './intensite'

/** `séance::exercice` — stable d'un enregistrement à l'autre. */
export function clefAllure(sessionId: string, nom: string): string {
  return `${sessionId}::${nom.trim().toLowerCase()}`
}

export type Allures = Record<string, IntensiteId>

const KEY = 'muscu_allures'

export async function loadAllures(userId: string): Promise<Allures> {
  const v = await fetchKv<Allures>(userId, KEY, {})
  return v && typeof v === 'object' ? v : {}
}

/**
 * Enregistre les allures d'une séance, et rend la table complète.
 *
 * On REMPLACE les entrées de cette séance plutôt que de fusionner : une allure
 * retirée doit disparaître, et un exercice remplacé en cours de séance ne doit
 * pas laisser la sienne derrière lui.
 */
export async function saveAllures(
  userId: string,
  sessionId: string,
  parExercice: Array<{ nom: string; allure: IntensiteId }>,
  actuelles: Allures,
): Promise<Allures> {
  const prefixe = `${sessionId}::`
  const suivantes: Allures = Object.fromEntries(
    Object.entries(actuelles).filter(([k]) => !k.startsWith(prefixe)),
  )
  for (const { nom, allure } of parExercice) suivantes[clefAllure(sessionId, nom)] = allure
  await saveKv(userId, KEY, suivantes)
  return suivantes
}

/** Retire les allures des séances qui n'existent plus. */
export function nettoyerAllures(allures: Allures, sessionIds: Set<string>): Allures {
  return Object.fromEntries(
    Object.entries(allures).filter(([k]) => sessionIds.has(k.split('::')[0])),
  )
}
