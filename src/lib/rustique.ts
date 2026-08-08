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
