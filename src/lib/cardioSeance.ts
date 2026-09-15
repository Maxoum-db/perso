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
  /**
   * D'où vient la mesure, quand ce n'est pas le Bluetooth en direct.
   *
   * `'polar'` : relevée dans Polar Flow, sur une séance que le capteur a
   * enregistrée seul. Ces mesures n'ont PAS de temps par zone — la route qui
   * les rend ne le donne pas — et leur `mesures` vaut zéro, parce qu'aucune
   * trame n'a été reçue ici. Sans ce champ, l'écran écrirait « 0 mesures
   * reçues » sous une moyenne que Polar a calculée sur toute la séance, ce qui
   * la ferait passer pour douteuse alors qu'elle est meilleure que la nôtre.
   */
  origine?: 'polar'
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

/**
 * Range une mesure venue de Polar Flow.
 *
 * Séparé de `saveCardio`, et pas un paramètre de plus : celui-là refuse un
 * bilan sans trame (`if (!b || !b.mesures) delete next[sessionId]`), ce qui est
 * juste pour le Bluetooth — une moyenne sur zéro trame n'y veut rien dire — et
 * faux ici, où le chiffre vient de Polar et vaut précisément parce qu'il n'a pas
 * été calculé chez nous. Deux règles contraires dans une seule fonction auraient
 * demandé un drapeau, et le drapeau se serait trompé un jour.
 */
export async function saveCardioPolar(
  userId: string,
  sessionId: string,
  m: { moyenne: number; max: number },
  capteur: string | null,
  connus: CardiosSeances,
): Promise<CardiosSeances> {
  const next: CardiosSeances = {
    ...connus,
    [sessionId]: {
      moyenne: m.moyenne,
      max: m.max,
      zones: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      mesures: 0,
      origine: 'polar',
      ...(capteur ? { capteur } : {}),
    },
  }
  await saveKv(userId, CLE, next)
  return next
}

/** Purge les séances disparues : sans ça le KV garde des mesures orphelines pour toujours. */
export function nettoyerCardios(connus: CardiosSeances, idsVivants: Set<string>): CardiosSeances {
  const out: CardiosSeances = {}
  for (const [id, v] of Object.entries(connus)) if (idsVivants.has(id)) out[id] = v
  return out
}

// ── Les mesures au repos ────────────────────────────────────────────────────
//
// Un HISTORIQUE, et c'est un changement. Il n'y avait d'abord que la dernière,
// au motif qu'« une RMSSD relevée debout après un café et une autre relevée au
// réveil ne se comparent pas ». C'est vrai, et c'était la mauvaise conclusion :
// sans historique, la mesure ne veut RIEN dire du tout. « Variabilité 20 ms »
// n'est ni bon ni mauvais — la RMSSD varie d'un facteur trois entre deux
// personnes saines, et aucun barème universel n'existe.
//
// Ce qui veut dire quelque chose, c'est l'écart à SA PROPRE base. Il faut donc
// garder les précédentes. Le protocole reste la condition — il est rappelé à
// l'écran à chaque mesure —, mais il se rappelle, il ne s'obtient pas en
// jetant les données.

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

/**
 * Combien de mesures on garde.
 *
 * Soixante : de quoi tenir deux mois à une mesure par jour, et assez pour voir
 * une dérive de fond. Au-delà, on ne compare plus une saison à elle-même.
 */
export const REPOS_GARDES = 60

/**
 * Les mesures au repos, de la plus RÉCENTE à la plus ancienne.
 *
 * Tolère l'ancien format — une mesure seule, avant qu'il y ait un historique —
 * et la rend comme une liste d'un élément. Sans ça, la première mesure de
 * chacun disparaîtrait le jour de la mise à jour.
 */
export async function loadRepos(userId: string): Promise<MesureRepos[]> {
  const v = await fetchKv<MesureRepos[] | MesureRepos | null>(userId, CLE_REPOS, [])
  const brut = Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : []
  return brut
    .filter((m): m is MesureRepos => !!m && typeof m === 'object' && typeof m.bpm === 'number' && typeof m.date === 'string')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, REPOS_GARDES)
}

export async function saveRepos(userId: string, m: MesureRepos, connues: MesureRepos[]): Promise<MesureRepos[]> {
  const next = [m, ...connues].sort((a, b) => b.date.localeCompare(a.date)).slice(0, REPOS_GARDES)
  await saveKv(userId, CLE_REPOS, next)
  return next
}

/** Retire une mesure ratée — bougée, trop courte, prise debout par erreur. */
export async function oublierRepos(userId: string, date: string, connues: MesureRepos[]): Promise<MesureRepos[]> {
  const next = connues.filter((m) => m.date !== date)
  await saveKv(userId, CLE_REPOS, next)
  return next
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
