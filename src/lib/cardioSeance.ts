import { fetchKv, saveKv } from './kv'
import type { BilanCardio, TempsParZone } from './cardio'

// Ce que la séance garde de son cardio.
//
// Rangé par SÉANCE dans le KV, comme l'intensité déclarée et pour la même
// raison : la table des séances n'a pas de colonne pour ça, et on évite une
// migration. La clé est l'identifiant de séance, qui survit à un
// ré-enregistrement — contrairement à celui des lignes d'exercice.

export interface CardioSeance {
  /** Moyenne pondérée par le temps, en battements par minute. */
  moyenne: number
  max: number
  zones: TempsParZone
  /** Nombre de trames reçues : une moyenne sur douze battements ne vaut rien, et ça se voit. */
  mesures: number
  /** Nom du capteur, pour savoir d'où vient le chiffre. */
  capteur?: string
}

export type CardiosSeances = Record<string, CardioSeance>

const CLE = 'muscu_cardio'

export async function loadCardios(userId: string): Promise<CardiosSeances> {
  const v = await fetchKv<CardiosSeances>(userId, CLE, {})
  return v && typeof v === 'object' ? v : {}
}

export async function saveCardio(
  userId: string,
  sessionId: string,
  b: BilanCardio | null,
  capteur: string | null,
  connus: CardiosSeances,
): Promise<CardiosSeances> {
  // Rien de mesuré : on n'écrit pas une entrée vide, et on efface celle qui
  // traînait — une séance ré-enregistrée sans capteur ne doit pas garder la
  // fréquence cardiaque de la fois d'avant.
  const next = { ...connus }
  if (!b || !b.mesures) delete next[sessionId]
  else next[sessionId] = { moyenne: b.moyenne, max: b.max, zones: b.zones, mesures: b.mesures, ...(capteur ? { capteur } : {}) }
  await saveKv(userId, CLE, next)
  return next
}

/** Purge les séances disparues : sans ça le KV garde des mesures orphelines pour toujours. */
export function nettoyerCardios(connus: CardiosSeances, idsVivants: Set<string>): CardiosSeances {
  const out: CardiosSeances = {}
  for (const [id, v] of Object.entries(connus)) if (idsVivants.has(id)) out[id] = v
  return out
}

// ── La mesure au repos ──────────────────────────────────────────────────────
//
// Une seule, la plus récente. Un historique de variabilité aurait du sens, mais
// pas sans protocole : une RMSSD relevée debout après un café et une autre
// relevée au réveil ne se comparent pas, et les aligner sur une courbe ferait
// croire à une évolution là où il n'y a qu'un changement de posture.

export interface MesureRepos {
  /** Date ISO de la mesure. */
  date: string
  bpm: number
  /** RMSSD en millisecondes. `null` si le capteur n'a pas envoyé d'intervalles RR. */
  rmssd: number | null
  /** Nombre d'intervalles retenus — la mesure ne vaut que par eux. */
  intervalles: number
}

const CLE_REPOS = 'muscu_cardio_repos'

export async function loadRepos(userId: string): Promise<MesureRepos | null> {
  const v = await fetchKv<MesureRepos | null>(userId, CLE_REPOS, null)
  return v && typeof v === 'object' && typeof v.bpm === 'number' ? v : null
}

export async function saveRepos(userId: string, m: MesureRepos): Promise<void> {
  await saveKv(userId, CLE_REPOS, m)
}

// ── La fréquence maximale ───────────────────────────────────────────────────

const CLE_FCMAX = 'muscu_fcmax'

/**
 * La max RELEVÉE, quand on en a une.
 *
 * Elle l'emporte sur l'estimation de Tanaka, qui se trompe de ±10 bpm — assez
 * pour décaler toutes les zones d'un cran. Une vraie max se relève en côte ou
 * sur un test de terrain ; en attendant, l'estimation fait l'affaire, et
 * l'écran dit laquelle des deux il emploie.
 */
export async function loadFcMaxRelevee(userId: string): Promise<number | null> {
  const v = await fetchKv<number | null>(userId, CLE_FCMAX, null)
  return typeof v === 'number' && v >= 120 && v <= 230 ? v : null
}

export async function saveFcMaxRelevee(userId: string, v: number | null): Promise<void> {
  await saveKv(userId, CLE_FCMAX, v)
}
