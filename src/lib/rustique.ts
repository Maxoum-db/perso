import { supabase } from './supabase'

// Rustique : deuxième cerveau qui pioche dans les données du Hub Prométhée
// (apiculture, distillation, BPREA, recettes) via les mêmes Edge Functions
// que le Brassage — aucune connexion séparée, aucune donnée écrite ici.

export type HubStatus = 'ok' | 'not_configured' | 'error'

export interface RustiqueParams {
  apiculture: Record<string, unknown>
  distillation: Record<string, unknown>
  ambulant: Record<string, unknown>
  pauses: Record<string, unknown>
}

export interface RustiqueBprea {
  modulesDecks: number
  modulesCards: number
  biblioDecks: number
  biblioCards: number
  dueToday: number
}

export interface RustiqueOverview {
  updatedAt: string | null
  params: RustiqueParams
  apiProducts: Record<string, unknown>
  bprea: RustiqueBprea
}

export interface RustiqueOverviewResult {
  status: HubStatus
  overview: RustiqueOverview | null
  message?: string
}

export async function fetchRustiqueOverview(): Promise<RustiqueOverviewResult> {
  try {
    const { data, error } = await supabase.functions.invoke('hub-rustique', { body: {} })
    if (error) {
      const ctx = (error as { context?: Response }).context
      if (ctx?.status === 503) return { status: 'not_configured', overview: null }
      return { status: 'error', overview: null, message: error.message }
    }
    if (data?.error) return { status: 'error', overview: null, message: data.error }
    return { status: 'ok', overview: data as RustiqueOverview }
  } catch (e) {
    return { status: 'error', overview: null, message: (e as Error).message }
  }
}

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

export interface RustiqueDeck {
  id: string
  title: string
  scope: string | null
  cardCount: number
  dueCount: number
}

export interface RustiqueDecksResult {
  status: HubStatus
  decks: RustiqueDeck[]
  message?: string
}

export interface RustiqueReviewState {
  card_id: string
  due: string
  state: number
}

export interface RustiqueCard {
  id: string
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

export async function listRustiqueCards(deckId: string, dueOnly: boolean): Promise<RustiqueCardsResult> {
  const res = await invokeQuiz<{ cards: RustiqueCard[] }>({ action: 'list_cards', deck_id: deckId, due_only: dueOnly })
  if (res.status !== 'ok') return { status: res.status, cards: [], message: res.message }
  return { status: 'ok', cards: res.data?.cards ?? [] }
}

export async function submitRustiqueReview(cardId: string, rating: 1 | 2 | 3 | 4): Promise<boolean> {
  const res = await invokeQuiz<{ ok: boolean }>({ action: 'submit_review', card_id: cardId, rating })
  return res.status === 'ok'
}
