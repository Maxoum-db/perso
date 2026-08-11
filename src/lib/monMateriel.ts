// MON matériel : ce dont je dispose là où je m'entraîne aujourd'hui.
//
// Le catalogue décrit ce qu'un exercice DEMANDE (lib/materiel). Ce module dit ce
// qu'on A. Les deux ensemble répondent à la seule question qui compte quand on
// s'entraîne chez soi : qu'est-ce que je peux faire, ce soir, avec ce qui est
// dans le garage ?
//
// La liste vide veut dire « tout » — c'est la salle, et c'est le cas par défaut.
// Un filtre qui s'activerait tout seul en n'ayant rien coché ferait disparaître
// le catalogue entier au premier chargement.
//
// Stockage : une entrée KV par utilisateur, comme l'intensité, les versions
// douces et les séances décochées. Pas de colonne dédiée, pas de migration.

import { fetchKv, saveKv } from './kv'
import { outilDe, type OutilId } from './materiel'

const KEY = 'muscu_materiel'

export type MonMateriel = OutilId[]

export async function loadMateriel(userId: string): Promise<MonMateriel> {
  const v = await fetchKv<MonMateriel>(userId, KEY, [])
  return Array.isArray(v) ? v.filter((o) => typeof o === 'string') : []
}

export async function saveMateriel(userId: string, outils: MonMateriel): Promise<MonMateriel> {
  await saveKv(userId, KEY, outils)
  return outils
}

/**
 * Le poids du corps est toujours disponible : il n'y a rien à posséder.
 *
 * Sans cette règle, cocher « haltères » chez soi faisait disparaître les pompes,
 * le gainage et le pont cervical — c'est-à-dire exactement ce qu'on fait quand
 * on n'a presque rien.
 */
export const TOUJOURS: OutilId[] = ['corps']

/** Cet exercice est-il faisable avec ce qu'on a ? Liste vide = tout est là. */
export function faisable(nom: string, outils: MonMateriel): boolean {
  if (outils.length === 0) return true
  const o = outilDe(nom)
  return TOUJOURS.includes(o) || outils.includes(o)
}

/** Ne garder que ce qui est faisable. */
export function filtrerParMateriel<T extends { name: string }>(
  exercices: T[],
  outils: MonMateriel,
): T[] {
  return outils.length === 0 ? exercices : exercices.filter((e) => faisable(e.name, outils))
}
