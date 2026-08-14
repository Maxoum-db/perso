import { fetchKv, readKvCache, saveKv } from './kv'
import type { QcmItem } from './qcmBridge'

// Ce que tu sais et ce que tu rates, question par question.
//
// ── Ce qui n'allait pas ─────────────────────────────────────────────────────
//
// La Notion du jour posait une question à choix multiple, la corrigeait, et
// n'en gardait qu'un compteur : « 12 répondues, 9 bonnes, dont 4 en apiculture ».
// L'identifiant de la question était disponible au moment du clic, et jeté.
//
// Le tirage, lui, était uniforme sur les 1091 questions, avec pour seule
// mémoire les 60 dernières VUES — sans égard au résultat. À une question par
// jour, une question RATÉE revenait donc en moyenne dans neuf cent soixante-dix
// jours. Deux ans et huit mois, exactement comme une question sue par cœur.
//
// C'était le seul endroit de l'application où un vrai signal juste/faux était
// produit, et le seul endroit où il n'était pas exploité.
//
// ── Ce qu'on garde ──────────────────────────────────────────────────────────
//
// Trois nombres par question vue, pas un de plus : combien de fois vue, combien
// de fois ratée, et quand pour la dernière fois. De quoi calculer un poids de
// tirage et un taux de réussite, sans construire un second moteur de répétition
// espacée à côté du FSRS du Quiz — celui-là existe, il est bon, et il travaille
// sur des cartes, pas sur des QCM.
//
// ── Où ça vit ───────────────────────────────────────────────────────────────
//
// Dans `perso_kv`, comme les courbatures et l'armure. C'était dans le
// localStorage, donc par appareil : une question répondue sur l'ordinateur
// restait inconnue du téléphone, et un nettoyage de cache effaçait tout. Pour
// la section dont l'horizon est un examen en 2028, c'était le suivi le plus
// fragile de l'application. L'ancien contenu local est repris au premier
// chargement plutôt que perdu.

export const CLE_MEMOIRE = 'rustique_qcm_memoire_v1'

/** Ancien stockage local, reversé une fois puis ignoré. */
const ANCIEN_STATS = 'perso_qcm_stats_v1'
const ANCIEN_HISTORIQUE = 'perso_qcm_recent_history_v1'

export interface EtatQuestion {
  /** Vues (répondues). */
  v: number
  /** Ratées. */
  r: number
  /** Dernière réponse, en jours depuis l'époque — court, et suffisant au jour près. */
  j: number
}

export type Memoire = Record<string, EtatQuestion>

export function jourActuel(maintenant = Date.now()): number {
  return Math.floor(maintenant / 86400000)
}

// ── Lecture / écriture ──────────────────────────────────────────────────────

/**
 * Reprend l'ancien suivi local.
 *
 * Les compteurs agrégés ne disent pas QUELLE question a été ratée — cette
 * information n'a jamais été écrite, elle est définitivement perdue. On ne
 * peut donc reprendre que l'historique des questions vues, en les marquant
 * comme vues et jamais ratées. C'est optimiste, et c'est le seul choix
 * honnête : inventer des échecs fausserait le tirage dans l'autre sens.
 */
function reprendreAncien(): Memoire {
  const out: Memoire = {}
  try {
    const brut = localStorage.getItem(ANCIEN_HISTORIQUE)
    if (brut) {
      const j = jourActuel()
      for (const id of JSON.parse(brut) as string[]) {
        if (typeof id === 'string' && id) out[id] = { v: 1, r: 0, j }
      }
    }
  } catch {
    // Historique illisible : on repart d'une mémoire vide, sans bruit.
  }
  return out
}

export function memoireEnCache(): Memoire {
  const m = readKvCache<Memoire>(CLE_MEMOIRE, {})
  return m && typeof m === 'object' ? m : {}
}

export async function chargerMemoire(userId: string): Promise<Memoire> {
  const distante = await fetchKv<Memoire>(userId, CLE_MEMOIRE, {})
  if (distante && Object.keys(distante).length > 0) return distante
  const ancienne = reprendreAncien()
  if (Object.keys(ancienne).length > 0) {
    await saveKv(userId, CLE_MEMOIRE, ancienne)
    try {
      localStorage.removeItem(ANCIEN_HISTORIQUE)
      localStorage.removeItem(ANCIEN_STATS)
    } catch {
      // Suppression impossible : sans gravité, la reprise ne se fait qu'une fois
      // puisque la mémoire distante n'est plus vide.
    }
  }
  return ancienne
}

/**
 * Enregistre une réponse et rend la mémoire mise à jour.
 *
 * Rend une NOUVELLE table plutôt que de modifier la précédente : l'appelant est
 * un composant React, et une mutation en place ne redessinerait pas l'écran.
 * L'écriture réseau part derrière, sans être attendue — répondre à une question
 * ne doit jamais faire patienter.
 */
export function noterReponse(memoire: Memoire, id: string, correct: boolean, maintenant = Date.now()): Memoire {
  const cur = memoire[id] ?? { v: 0, r: 0, j: 0 }
  return {
    ...memoire,
    [id]: { v: cur.v + 1, r: cur.r + (correct ? 0 : 1), j: jourActuel(maintenant) },
  }
}

export function enregistrerMemoire(userId: string, memoire: Memoire): void {
  void saveKv(userId, CLE_MEMOIRE, memoire)
}

// ── Poids de tirage ─────────────────────────────────────────────────────────

/**
 * Une question jamais vue : le poids de référence.
 *
 * Tout se compare à lui. Une question ratée doit passer DEVANT une question
 * neuve — sinon, avec mille questions neuves en réserve, elle ne repasserait
 * jamais.
 */
export const POIDS_NEUVE = 1

/** Poids d'une question ratée à chaque fois, revue le jour même. */
export const POIDS_RATEE_MAX = 12

/**
 * Poids de tirage d'une question, d'après ce qu'on en sait.
 *
 * Deux facteurs qui se multiplient :
 *
 *   • la MAÎTRISE — la part de ratés. Tout raté pèse 6, tout juste pèse 0,25 :
 *     une question sue reste tirable (on n'efface rien du pool, l'oubli
 *     existe), mais vingt-quatre fois moins souvent qu'une question ratée ;
 *   • la FRAÎCHEUR — les jours écoulés. À 0 jour on ne remet pas la même
 *     question dans la foulée, quel qu'ait été le résultat ; le poids remonte
 *     ensuite et sature. Une ratée revient utilement sous quelques jours, une
 *     sue met des mois à retrouver un poids ordinaire.
 *
 * Le produit est borné par POIDS_RATEE_MAX : sans plafond, une question ratée
 * dix fois écraserait tout le reste du tirage et la Notion du jour deviendrait
 * un ressassement.
 */
export function poidsQuestion(etat: EtatQuestion | undefined, jour = jourActuel()): number {
  if (!etat || etat.v === 0) return POIDS_NEUVE

  const partRatee = etat.r / etat.v
  // 0,25 (jamais ratée) → 6 (toujours ratée), en exponentielle : le premier
  // raté doit peser tout de suite, pas au bout de quatre.
  const maitrise = 0.25 * Math.pow(24, partRatee)

  const jours = Math.max(0, jour - etat.j)
  // Le lendemain vaut déjà la moitié du plein régime ; on sature vers 10 jours.
  const fraicheur = jours === 0 ? 0.05 : Math.min(1, jours / 10 + 0.4)

  return Math.min(POIDS_RATEE_MAX, Math.max(0.02, maitrise * fraicheur * 2))
}

/**
 * Tire une question au hasard, pondéré par ce qu'on sait d'elle.
 *
 * Roulette proportionnelle, et non « prendre la pire » : un choix déterministe
 * rendrait la même question tant qu'elle n'est pas sue, ce qui est le meilleur
 * moyen de fermer l'application. Le hasard reste, il est simplement biaisé du
 * bon côté.
 */
export function tirerPondere<T extends { id: string }>(items: T[], memoire: Memoire, alea = Math.random): T | null {
  if (items.length === 0) return null
  const jour = jourActuel()
  const poids = items.map((it) => poidsQuestion(memoire[it.id], jour))
  const total = poids.reduce((s, p) => s + p, 0)
  if (total <= 0) return items[Math.floor(alea() * items.length)]
  let seuil = alea() * total
  for (let i = 0; i < items.length; i++) {
    seuil -= poids[i]
    if (seuil <= 0) return items[i]
  }
  return items[items.length - 1]
}

// ── Statistiques dérivées ───────────────────────────────────────────────────
//
// Plus de compteurs stockés à côté : ils se recalculent depuis la mémoire, donc
// ils ne peuvent pas diverger d'elle. C'était le cas — `perso_qcm_stats_v1` et
// `perso_qcm_recent_history_v1` étaient deux fichiers séparés qui décrivaient
// les mêmes clics.

export interface StatsQcm {
  /** Questions distinctes déjà rencontrées. */
  vues: number
  /** Réponses données, toutes questions confondues. */
  reponses: number
  /** Bonnes réponses. */
  bonnes: number
  /** Questions dont la dernière trace est un raté persistant (part de ratés ≥ 50 %). */
  fragiles: number
  parKind: Record<QcmItem['kind'], { vues: number; reponses: number; bonnes: number }>
}

const KINDS: QcmItem['kind'][] = ['fiche', 'module', 'bprea', 'aides']

export function statsQcm(memoire: Memoire, items: QcmItem[] | null): StatsQcm {
  const parKind = Object.fromEntries(KINDS.map((k) => [k, { vues: 0, reponses: 0, bonnes: 0 }])) as StatsQcm['parKind']
  const kindParId = new Map(items?.map((it) => [it.id, it.kind]) ?? [])
  let vues = 0
  let reponses = 0
  let bonnes = 0
  let fragiles = 0

  for (const [id, e] of Object.entries(memoire)) {
    if (e.v <= 0) continue
    vues += 1
    reponses += e.v
    bonnes += e.v - e.r
    if (e.r / e.v >= 0.5) fragiles += 1
    // La banque n'est pas toujours chargée (hors ligne, cache expiré) : la
    // répartition par source est alors incomplète, et les totaux restent justes.
    const k = kindParId.get(id)
    if (k) {
      parKind[k].vues += 1
      parKind[k].reponses += e.v
      parKind[k].bonnes += e.v - e.r
    }
  }

  return { vues, reponses, bonnes, fragiles, parKind }
}
