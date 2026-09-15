import { fetchKv, saveKv } from './kv'
import type { ModeTrajet } from './gps'

// Les trajets enregistrés au GPS.
//
// Rangés dans le KV, comme les mesures au repos et pour la même raison : pas de
// table à créer, pas de migration, et un trajet n'a de sens que pour la personne
// qui l'a marché.
//
// ── Ce qu'on ne garde PAS ───────────────────────────────────────────────────
//
// La trace. Aucune coordonnée n'est enregistrée : ni le départ, ni l'arrivée, ni
// le chemin. On garde une distance, une durée et une vitesse.
//
// Ce n'est pas un oubli, c'est le choix qui coûte le moins cher à se tromper.
// Une trace, c'est l'adresse du domicile, celle du travail, et l'heure à
// laquelle la maison est vide — dans une base de données qu'on partage avec
// deux autres personnes. Pour ce que l'application en fait — des kilomètres et
// une dépense —, la trace n'apporte rien. Le jour où une carte servirait
// vraiment, ce sera une décision prise exprès, pas un effet de bord.

export interface Trajet {
  /** Date ISO du départ — sert aussi d'identifiant. */
  date: string
  mode: ModeTrajet
  metres: number
  /** Secondes de déplacement réellement mesuré — hors arrêts. */
  secondes: number
  /** Durée totale de l'enregistrement, arrêts compris. */
  dureeS: number
  vitesseMoyenneKmh: number | null
  /** Points reçus et segments retenus : de quoi juger si la mesure vaut quelque chose. */
  points: number
  segments: number
  /** Identifiant de la séance créée, quand le trajet en a produit une. */
  sessionId?: string
}

export const MODES: Array<{ id: ModeTrajet; icone: string; label: string; aide: string }> = [
  {
    id: 'marche',
    icone: '🚶',
    label: 'Marche',
    aide: 'Rejoint le journal comme une séance : elle compte dans la dépense et dans la charge.',
  },
  {
    id: 'moto',
    icone: '🏍️',
    label: 'Moto',
    aide: 'Reste dans les trajets, et n’entre ni dans la dépense ni dans la charge — on ne brûle rien assis.',
  },
]

export function mode(id: ModeTrajet) {
  return MODES.find((m) => m.id === id) ?? MODES[0]
}

/**
 * En dessous, on n'enregistre rien.
 *
 * Cinquante mètres et cinq segments. Un essai de trente secondes pour voir si
 * le bouton marche ne doit pas laisser une ligne dans l'historique — et un
 * trajet de dix mètres ne dit rien de plus que le bruit du récepteur.
 */
export const METRES_MIN = 50
export const SEGMENTS_MIN = 5

export function vautLaPeine(metres: number, segments: number): boolean {
  return metres >= METRES_MIN && segments >= SEGMENTS_MIN
}

/** Combien de trajets on garde. Deux cents : de quoi tenir une année. */
export const TRAJETS_GARDES = 200

const CLE = 'trajets_gps'

export async function loadTrajets(userId: string): Promise<Trajet[]> {
  const v = await fetchKv<Trajet[]>(userId, CLE, [])
  const brut = Array.isArray(v) ? v : []
  return brut
    .filter((t): t is Trajet => !!t && typeof t === 'object' && typeof t.date === 'string' && typeof t.metres === 'number')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, TRAJETS_GARDES)
}

export async function saveTrajet(userId: string, t: Trajet, connus: Trajet[]): Promise<Trajet[]> {
  const next = [t, ...connus.filter((x) => x.date !== t.date)]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, TRAJETS_GARDES)
  await saveKv(userId, CLE, next)
  return next
}

export async function oublierTrajet(userId: string, date: string, connus: Trajet[]): Promise<Trajet[]> {
  const next = connus.filter((t) => t.date !== date)
  await saveKv(userId, CLE, next)
  return next
}

/** Le nom que porte la séance créée par une marche. */
export function titreSeance(t: Trajet): string {
  const km = t.metres >= 1000 ? `${(Math.round(t.metres / 100) / 10).toFixed(1).replace('.', ',')} km` : `${t.metres} m`
  return `Marche — ${km}`
}
