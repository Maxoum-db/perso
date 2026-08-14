import { supabase } from './supabase'

// Rustique : deuxième cerveau qui pioche dans les données du Hub Prométhée
// (apiculture, distillation, BPREA, recettes) via les mêmes Edge Functions
// que le Brassage — aucune connexion séparée, aucune donnée écrite ici.

export type HubStatus = 'ok' | 'not_configured' | 'error'

export type RustiqueAskResult =
  | { status: 'ok'; answer: string }
  | { status: 'not_configured'; message?: string }
  | { status: 'error'; message?: string }

export async function askRustique(question: string): Promise<RustiqueAskResult> {
  try {
    const { data, error } = await supabase.functions.invoke('rustique-ask', { body: { question } })
    if (error) {
      const ctx = (error as { context?: Response }).context
      if (ctx?.status === 503) return { status: 'not_configured' }
      return { status: 'error', message: error.message }
    }
    if (data?.error) return { status: 'error', message: data.error }
    return { status: 'ok', answer: (data?.answer as string) ?? '' }
  } catch (e) {
    return { status: 'error', message: (e as Error).message }
  }
}

// ── Quiz (learn_decks/learn_cards du hub, révision FSRS réelle) ────────────
// Les paquets sont regroupés par thème (les 8 phases du programme
// d'auto-formation du hub) pour réviser large sur un sujet plutôt que
// paquet par paquet — cf. commentaire THEMES dans l'Edge Function.

export interface RustiqueTheme {
  id: string
  title: string
  color: string
  order: number
}

export interface RustiqueDeck {
  id: string
  title: string
  scope: string | null
  theme: RustiqueTheme
  cardCount: number
  /**
   * Cartes RÉELLEMENT échues — celles dont l'échéance FSRS est passée.
   *
   * Comptait auparavant les cartes jamais présentées avec les cartes échues, ce
   * qui donnait 944 « à réviser » pour 5 vraies échéances. Un compteur qui ne
   * peut pas descendre à zéro n'alerte de rien.
   */
  dueCount: number
  /** Cartes jamais présentées. Absent si l'Edge Function n'est pas à jour. */
  newCount?: number
}

export interface RustiqueDecksResult {
  status: HubStatus
  decks: RustiqueDeck[]
  message?: string
}

export interface RustiqueThemeGroup {
  theme: RustiqueTheme
  decks: RustiqueDeck[]
  cardCount: number
  dueCount: number
  newCount: number
}

/** Regroupe les paquets par thème (utilisé par Apprentissage et Quiz). */
export function groupDecksByTheme(decks: RustiqueDeck[]): RustiqueThemeGroup[] {
  const byId = new Map<string, RustiqueThemeGroup>()
  for (const d of decks) {
    const g = byId.get(d.theme.id) ?? { theme: d.theme, decks: [], cardCount: 0, dueCount: 0, newCount: 0 }
    g.decks.push(d)
    g.cardCount += d.cardCount
    g.dueCount += d.dueCount
    g.newCount += d.newCount ?? 0
    byId.set(d.theme.id, g)
  }
  return [...byId.values()].sort((a, b) => a.theme.order - b.theme.order)
}

export interface RustiqueReviewState {
  card_id: string
  due: string
  state: number
}

export interface RustiqueCard {
  id: string
  deck_id: string
  deckTitle: string | null
  front: string
  back: string
  type: string
  review: RustiqueReviewState | null
}

export interface RustiqueCardsResult {
  status: HubStatus
  cards: RustiqueCard[]
  message?: string
}

async function invokeQuiz<T>(payload: Record<string, unknown>): Promise<{ status: HubStatus; data: T | null; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('hub-rustique-quiz', { body: payload })
    if (error) {
      const ctx = (error as { context?: Response }).context
      if (ctx?.status === 503) return { status: 'not_configured', data: null }
      return { status: 'error', data: null, message: error.message }
    }
    if (data?.error) return { status: 'error', data: null, message: data.error }
    return { status: 'ok', data: data as T }
  } catch (e) {
    return { status: 'error', data: null, message: (e as Error).message }
  }
}

export async function listRustiqueDecks(): Promise<RustiqueDecksResult> {
  const res = await invokeQuiz<{ decks: RustiqueDeck[] }>({ action: 'list_decks' })
  if (res.status !== 'ok') return { status: res.status, decks: [], message: res.message }
  return { status: 'ok', decks: res.data?.decks ?? [] }
}

export type PorteeCartes = 'toutes' | 'dues' | 'nouvelles'

function filtre(portee: PorteeCartes) {
  return { due_only: portee === 'dues', new_only: portee === 'nouvelles' }
}

export async function listRustiqueCards(deckId: string, portee: PorteeCartes): Promise<RustiqueCardsResult> {
  const res = await invokeQuiz<{ cards: RustiqueCard[] }>({ action: 'list_cards', deck_id: deckId, ...filtre(portee) })
  if (res.status !== 'ok') return { status: res.status, cards: [], message: res.message }
  return { status: 'ok', cards: res.data?.cards ?? [] }
}

/** Toutes les cartes de tous les paquets d'un thème, en une session. */
export async function listRustiqueThemeCards(themeId: string, portee: PorteeCartes): Promise<RustiqueCardsResult> {
  const res = await invokeQuiz<{ cards: RustiqueCard[] }>({ action: 'list_cards', theme_id: themeId, ...filtre(portee) })
  if (res.status !== 'ok') return { status: res.status, cards: [], message: res.message }
  return { status: 'ok', cards: res.data?.cards ?? [] }
}

export type RustiqueRating = 1 | 2 | 3 | 4

/** Mêmes 4 boutons partout où on note une carte (Quiz, Notion du jour). */
export const RUSTIQUE_RATING_BUTTONS: { rating: RustiqueRating; label: string; className: string }[] = [
  { rating: 1, label: 'À revoir', className: 'bg-clay text-white' },
  { rating: 2, label: 'Difficile', className: 'bg-sand text-ink' },
  { rating: 3, label: 'Correct', className: 'bg-sage text-white' },
  { rating: 4, label: 'Facile', className: 'bg-copper text-white' },
]

/**
 * Le résultat d'une notation.
 *
 * Il était réduit à un booléen, et l'appelant l'ignorait : une note perdue —
 * réseau coupé, hub indisponible — faisait défiler la carte suivante comme si
 * de rien n'était. Le planning ne bougeait pas, et rien ne le disait. Une note
 * qu'on croit avoir posée est pire qu'une note qu'on sait avoir ratée.
 */
export type ResultatNotation =
  | { ok: true }
  | { ok: false; raison: 'non_cloisonne' | 'hub' | 'reseau'; message?: string }

export async function submitRustiqueReview(cardId: string, rating: RustiqueRating): Promise<ResultatNotation> {
  const res = await invokeQuiz<{ ok: boolean }>({ action: 'submit_review', card_id: cardId, rating })
  if (res.status === 'ok') return { ok: true }
  // Le planning n'est pas cloisonné par compte : l'Edge Function refuse
  // l'écriture aux autres comptes plutôt que d'écraser celui du propriétaire.
  if (res.message?.includes('review_non_cloisonnee')) return { ok: false, raison: 'non_cloisonne' }
  return { ok: false, raison: res.status === 'not_configured' ? 'hub' : 'reseau', message: res.message }
}

// La Notion du jour de l'accueil ne vient plus d'ici — voir lib/qcmBridge.ts
// (vrai QCM à choix multiple, importé statiquement depuis le Hub Prométhée).
// L'exclusion "prochaine carte en écartant celles déjà vues" a migré avec
// elle, cf. prochaineQcm dans qcmBridge.ts.
