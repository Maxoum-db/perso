import { fetchKv, saveKv } from './kv'
import { EXERCISE_LIBRARY } from '../data/exercises'

// « Je l'ai fait en version douce. »
//
// Entre l'étirement pur et la série lourde, il y a tout ce qu'on fait à vide
// pour se remettre en route : le glissé au mur, la rotation externe à
// l'élastique, la suspension à la barre, le deadbug. Ces gestes-là ne fatiguent
// rien — ils rendent de l'amplitude et relancent la circulation —, mais
// enregistrés comme des exercices ordinaires ils COÛTAIENT de la récupération :
// le mannequin voyait une séance d'épaules là où il y avait eu dix minutes de
// mobilité, et le générateur écartait ensuite l'épaule pendant trois jours.
//
// La bibliothèque dit lesquels ont une version douce (`adaptable`), et cette
// déclaration-ci dit lesquels ont ÉTÉ faits comme ça. Les deux sont nécessaires :
// la première est une propriété du mouvement, la seconde une propriété de ta
// séance.
//
// Stockage : pas de colonne dédiée, comme pour l'intensité. Mais la clé ne peut
// pas être l'identifiant de la ligne d'exercice — enregistrer une séance SUPPRIME
// puis réinsère toutes ses lignes, et les identifiants changent à chaque fois. On
// indexe donc par séance + nom d'exercice, qui, eux, survivent.

/** Les exercices dont la bibliothèque dit qu'ils ont une version douce. */
export const ADAPTABLE_NAMES = new Set(
  EXERCISE_LIBRARY.filter((e) => e.adaptable).map((e) => e.name.trim().toLowerCase()),
)

export function estAdaptable(nom: string): boolean {
  return ADAPTABLE_NAMES.has(nom.trim().toLowerCase())
}

/** `séance::exercice` — stable d'un enregistrement à l'autre. */
export function clefDouceur(sessionId: string, nom: string): string {
  return `${sessionId}::${nom.trim().toLowerCase()}`
}

export type Douceurs = Record<string, true>

const KEY = 'muscu_douceur'

export async function loadDouceurs(userId: string): Promise<Douceurs> {
  const v = await fetchKv<Douceurs>(userId, KEY, {})
  return v && typeof v === 'object' ? v : {}
}

/**
 * Réécrit les déclarations d'UNE séance : celles qui ne sont plus dans la liste
 * disparaissent. Passer par la séance entière plutôt que par exercice évite de
 * laisser des clés derrière soi quand on retire une ligne du brouillon.
 */
export async function saveDouceurs(
  userId: string,
  sessionId: string,
  nomsDoux: string[],
  connues: Douceurs,
): Promise<Douceurs> {
  const prefixe = `${sessionId}::`
  const next: Douceurs = {}
  for (const [k, v] of Object.entries(connues)) if (!k.startsWith(prefixe)) next[k] = v
  for (const nom of nomsDoux) if (nom.trim()) next[clefDouceur(sessionId, nom)] = true
  await saveKv(userId, KEY, next)
  return next
}

/** Purge les séances disparues : sans ça le KV grossit sans jamais se vider. */
export function nettoyerDouceurs(connues: Douceurs, idsVivants: Set<string>): Douceurs {
  const out: Douceurs = {}
  for (const [k, v] of Object.entries(connues)) {
    if (idsVivants.has(k.slice(0, k.indexOf('::')))) out[k] = v
  }
  return out
}
