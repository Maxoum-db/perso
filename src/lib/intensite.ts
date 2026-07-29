import { fetchKv, saveKv } from './kv'

// Intensité déclarée d'une séance.
//
// Le coefficient de densité sait juger une séance de salle : il compte le
// tonnage et les séries rapportés à la durée. Sur une activité — slackline,
// bloc, béhourd, kickboxing — il n'a rien à mesurer, et la durée saisie est du
// temps de présence, pas du temps d'effort.
//
// Modéliser ça par un rendement décroissant reviendrait à deviner à ta place :
// vingt minutes de sangle, c'est parfois vingt minutes de sangle. Autant te
// laisser le dire. Une intensité déclarée est une donnée ; un plateau calculé
// n'est qu'une hypothèse.
//
// Règle : ce que tu déclares fait foi et REMPLACE le calcul automatique. Sans
// déclaration, on retombe sur la densité pour la salle, et sur rien du tout
// pour les activités.

export type IntensiteId = 'tranquille' | 'normal' | 'soutenu' | 'fond'

export interface Intensite {
  label: string
  emoji: string
  /** Multiplicateur appliqué au MET de la séance. */
  coef: number
  aide: string
}

export const INTENSITES: Record<IntensiteId, Intensite> = {
  tranquille: {
    label: 'Tranquille',
    emoji: '🌿',
    coef: 0.7,
    aide: 'Beaucoup de pauses, de la technique, on ne cherche pas l’effort.',
  },
  normal: {
    label: 'Normal',
    emoji: '🙂',
    coef: 1,
    aide: 'Le rythme habituel — c’est la référence du barème.',
  },
  soutenu: {
    label: 'Soutenu',
    emoji: '😤',
    coef: 1.25,
    aide: 'Peu de temps mort, ça souffle, on enchaîne.',
  },
  fond: {
    label: 'À fond',
    emoji: '🔥',
    coef: 1.5,
    aide: 'Séance rare : presque aucun repos, on finit vidé.',
  },
}

export const INTENSITE_IDS = Object.keys(INTENSITES) as IntensiteId[]

/** Coefficient d'un identifiant, 1 pour l'absence de déclaration. */
export function coefIntensite(id: IntensiteId | null | undefined): number {
  return id ? INTENSITES[id].coef : 1
}

// ── Stockage ────────────────────────────────────────────────────────────────
// Pas de colonne dédiée en base : la table des séances n'en a pas et on évite
// les migrations. Une entrée KV par utilisateur, indexée par identifiant de
// séance, comme les courbatures déclarées.

export type Intensites = Record<string, IntensiteId>

const KEY = 'muscu_intensites'

export async function loadIntensites(userId: string): Promise<Intensites> {
  const v = await fetchKv<Intensites>(userId, KEY, {})
  return v && typeof v === 'object' ? v : {}
}

/**
 * Écrit l'intensité d'une séance. `null` la retire — on ne garde pas une clé
 * pour dire « pas de valeur », le KV se lirait comme une liste de séances
 * déclarées.
 */
export async function saveIntensite(
  userId: string,
  sessionId: string,
  id: IntensiteId | null,
  connues: Intensites,
): Promise<Intensites> {
  const next = { ...connues }
  if (id) next[sessionId] = id
  else delete next[sessionId]
  await saveKv(userId, KEY, next)
  return next
}

/** Purge les séances disparues : sans ça le KV grossit sans jamais se vider. */
export function nettoyerIntensites(connues: Intensites, idsVivants: Set<string>): Intensites {
  const out: Intensites = {}
  for (const [id, v] of Object.entries(connues)) if (idsVivants.has(id)) out[id] = v
  return out
}
