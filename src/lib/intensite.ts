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
//
// Ce que tu déclares vaut AUSSI pour la récupération. Le barème ne connaissait
// que l'intensité de l'exercice pour un muscle donné — la part de l'exercice qui
// lui revient. Il ignorait donc complètement ce que tu as réellement mis dedans :
// une heure de sangle en cherchant l'équilibre et une heure de sangle à enchaîner
// les traversées chargeaient le bas du dos à l'identique.

export type IntensiteId = 'tranquille' | 'normal' | 'soutenu' | 'fond'

export interface Intensite {
  label: string
  emoji: string
  /** Multiplicateur appliqué au MET de la séance. */
  coef: number
  /**
   * Jours de récupération ajoutés à un moteur principal, au pas de 12 h du
   * mannequin. Négatif = le muscle revient plus tôt.
   *
   * Asymétrique comme la barre de la fiche muscle : une séance à fond coûte un
   * jour de plus, une séance tranquille n'en fait gagner qu'une demi. Se tromper
   * en s'accordant du repos ne coûte rien ; se tromper dans l'autre sens, si.
   */
  recup: number
  aide: string
}

export const INTENSITES: Record<IntensiteId, Intensite> = {
  tranquille: {
    label: 'Tranquille',
    emoji: '🌿',
    coef: 0.7,
    recup: -0.5,
    aide: 'Beaucoup de pauses, de la technique, on ne cherche pas l’effort.',
  },
  normal: {
    label: 'Normal',
    emoji: '🙂',
    coef: 1,
    recup: 0,
    aide: 'Le rythme habituel — c’est la référence du barème.',
  },
  soutenu: {
    label: 'Soutenu',
    emoji: '😤',
    coef: 1.25,
    recup: 0.5,
    aide: 'Peu de temps mort, ça souffle, on enchaîne.',
  },
  fond: {
    label: 'À fond',
    emoji: '🔥',
    coef: 1.5,
    recup: 1,
    aide: 'Séance rare : presque aucun repos, on finit vidé.',
  },
}

export const INTENSITE_IDS = Object.keys(INTENSITES) as IntensiteId[]

/** Coefficient d'un identifiant, 1 pour l'absence de déclaration. */
export function coefIntensite(id: IntensiteId | null | undefined): number {
  return id ? INTENSITES[id].coef : 1
}

/**
 * Jours de récupération que l'intensité déclarée ajoute à un muscle, sa part
 * dans l'exercice comprise.
 *
 * La pondération est linéaire, contrairement à celle des jours écoulés qui est
 * quadratique : un jour entier de plus sur un stabilisateur à 30 % n'aurait
 * aucun sens — c'est le moteur principal qui prend la séance.
 */
export function recupIntensite(id: IntensiteId | null | undefined, partDuMuscle = 1): number {
  return id ? INTENSITES[id].recup * partDuMuscle : 0
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
