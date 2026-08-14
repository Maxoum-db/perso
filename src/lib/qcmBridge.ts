import { tirerPondere, type Memoire } from './qcmMemoire'

// Pont vers le QCM du Hub Prométhée : fichier statique public (voir
// hub-promethee/scripts/export_qcm_json.mjs), régénéré à chaque déploiement
// du Hub — pas de migration de base de données, pas de schéma Supabase
// partagé touché. La Notion du jour de l'accueil pioche dedans : vrai choix
// multiple (4 options), correction immédiate + explication.

export interface QcmItem {
  id: string
  kind: 'fiche' | 'module' | 'bprea' | 'aides'
  srcId: string
  srcLabel: string
  q: string
  options: string[]
  correct: number
  explication: string
  source: string | null
}

const QCM_EXPORT_URL = 'https://hub-promethee.vercel.app/qcm_export.json'
const CACHE_KEY = 'perso_qcm_export_cache_v1'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12h — le contenu ne bouge qu'aux déploiements du Hub

interface CacheShape {
  fetchedAt: number
  items: QcmItem[]
}

function readCache(): QcmItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheShape
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null
    return parsed.items.length ? parsed.items : null
  } catch {
    return null
  }
}

function writeCache(items: QcmItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), items } satisfies CacheShape))
  } catch {
    // Quota localStorage dépassé (~1,2 Mo) : tant pis, on retentera un fetch réseau la prochaine fois.
  }
}

export async function fetchQcmBank(): Promise<QcmItem[] | null> {
  const cached = readCache()
  if (cached) return cached
  try {
    const res = await fetch(QCM_EXPORT_URL)
    if (!res.ok) return null
    const data = (await res.json()) as { items?: QcmItem[] }
    const items = data.items ?? []
    if (items.length) writeCache(items)
    return items.length ? items : null
  } catch {
    return null
  }
}

/**
 * La prochaine question à poser.
 *
 * Le tirage était UNIFORME, avec pour seule mémoire une liste des soixante
 * dernières questions vues. Il ne distinguait donc pas une question ratée d'une
 * question sue par cœur : à une question par jour sur mille quatre-vingt-onze,
 * une question ratée revenait en moyenne au bout de deux ans et huit mois.
 *
 * Le poids vient maintenant de `lib/qcmMemoire`, qui garde le résultat de chaque
 * réponse. `exclure` reste, pour les questions déjà répondues DEPUIS L'OUVERTURE
 * de l'accueil : celles-là ne doivent pas revenir dans la minute, et le poids du
 * jour ne le garantit pas à lui seul — il l'abaisse fortement, il ne l'annule
 * pas.
 */
export function prochaineQcm<T extends { id: string }>(
  items: T[],
  memoire: Memoire,
  exclure: ReadonlySet<string> = new Set(),
): T | null {
  const restants = exclure.size ? items.filter((it) => !exclure.has(it.id)) : items
  // Tout exclu (une session très longue) : on retombe sur le pool complet plutôt
  // que de ne plus rien proposer.
  const pool = restants.length > 0 ? restants : items
  return tirerPondere(pool, memoire)
}

/** @param exclure Questions déjà répondues depuis l'ouverture de l'accueil. */
export async function fetchNotionDuJourQcm(
  memoire: Memoire,
  exclure: ReadonlySet<string> = new Set(),
): Promise<QcmItem | null> {
  const items = await fetchQcmBank()
  if (!items) return null
  return prochaineQcm(items, memoire, exclure)
}

/**
 * Le paquet de cartes qui traite le même sujet que cette question — s'il existe.
 *
 * ── Ce qui relie les deux systèmes, et ce qui ne les relie pas ──────────────
 *
 * Le QCM et les cartes FSRS sortent du même Hub, mais rien ne les apparie
 * QUESTION PAR QUESTION : les identifiants du QCM valent « fiche:f-altieri-1:3 »
 * (source + rang), ceux des cartes « card-1782652704785-13535 ». Une mauvaise
 * réponse ne peut donc pas désigner une carte précise, et un appariement par
 * texte serait une devinette qu'on ne saurait pas vérifier.
 *
 * En revanche la SOURCE se recoupe : les paquets s'appellent
 * `deck-fiche-<srcId>` et `deck-mod-<srcId>` — mêmes identifiants de fiche et de
 * module que le QCM. On renvoie donc vers le paquet du sujet, ce qui est de
 * toute façon le bon geste : réviser la fiche, pas la seule carte qui
 * reformulerait la question ratée.
 *
 * Et on n'écrit RIEN dans le FSRS au passage. Noter une carte reste délibéré
 * (même principe que `lib/notionsLues`) : transformer un clic sur la mauvaise
 * option en note « À revoir » sur treize cartes qu'on n'a pas ouvertes
 * fausserait un planning que personne n'a demandé à fausser.
 *
 * Toutes les sources ne se recoupent pas — l'examen BPREA et le catalogue
 * d'aides n'ont pas de paquet en face, et certaines fiches du QCM n'ont jamais
 * été versées en cartes. La fonction rend alors une liste vide, et l'écran
 * n'affiche rien de plus.
 */
export function paquetsDeLaQuestion(item: QcmItem, deckIds: ReadonlySet<string>): string[] {
  const src = item.srcId?.trim()
  if (!src) return []
  const candidats =
    item.kind === 'module'
      ? [`deck-mod-${src}`]
      : item.kind === 'fiche'
        ? [`deck-fiche-${src}`, `deck-qcm-${src}`]
        : [] // bprea, aides : pas de paquet de cartes en face
  return candidats.filter((id) => deckIds.has(id))
}

export const QCM_KIND_LABELS: Record<QcmItem['kind'], string> = {
  fiche: '📖 Bibliothèque',
  module: '🎓 Module BPREA',
  bprea: '📝 Examen BPREA',
  aides: '🎯 Aides & Subventions',
}
