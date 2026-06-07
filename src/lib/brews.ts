import { supabase } from './supabase'

// ── Brassins (perso_brews) ────────────────────────────────────────────────

export type BrewStatus = 'planifie' | 'fermentation' | 'maturation' | 'embouteille' | 'termine'

export const BREW_STATUSES: { id: BrewStatus; label: string; emoji: string }[] = [
  { id: 'planifie', label: 'Planifié', emoji: '📋' },
  { id: 'fermentation', label: 'Fermentation', emoji: '🫧' },
  { id: 'maturation', label: 'Maturation', emoji: '⏳' },
  { id: 'embouteille', label: 'Embouteillé', emoji: '🍾' },
  { id: 'termine', label: 'Terminé', emoji: '✅' },
]

export interface Brew {
  id: string
  user_id: string
  recipe_id: string | null
  recipe_name: string
  recipe_type: string
  style: string
  batch_size_l: number | null
  brew_date: string
  status: BrewStatus
  og: number | null
  fg: number | null
  abv: number | null
  rating: number | null
  tasting_notes: string
  notes: string
  created_at: string
  updated_at: string
}

export type NewBrew = Partial<Omit<Brew, 'id' | 'user_id' | 'created_at' | 'updated_at'>> & {
  recipe_name: string
}

const BREW_COLS =
  'id,user_id,recipe_id,recipe_name,recipe_type,style,batch_size_l,brew_date,status,og,fg,abv,rating,tasting_notes,notes,created_at,updated_at'

export async function listBrews(userId: string): Promise<Brew[]> {
  const { data, error } = await supabase
    .from('perso_brews')
    .select(BREW_COLS)
    .eq('user_id', userId)
    .order('brew_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Brew[]
}

export async function createBrew(userId: string, brew: NewBrew): Promise<Brew> {
  const { data, error } = await supabase
    .from('perso_brews')
    .insert({ ...brew, user_id: userId })
    .select(BREW_COLS)
    .single()
  if (error) throw new Error(error.message)
  return data as Brew
}

export async function updateBrew(
  id: string,
  patch: Partial<Omit<Brew, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('perso_brews')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteBrew(id: string): Promise<void> {
  // Les événements partent en cascade (FK on delete cascade).
  const { error } = await supabase.from('perso_brews').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Journal de fermentation (perso_brew_events) ───────────────────────────

export type BrewEventKind = 'mesure' | 'houblonnage' | 'transfert' | 'embouteillage' | 'degustation' | 'note'

export const BREW_EVENT_KINDS: { id: BrewEventKind; label: string; emoji: string }[] = [
  { id: 'mesure', label: 'Densité', emoji: '🌡️' },
  { id: 'houblonnage', label: 'Dry hop', emoji: '🌿' },
  { id: 'transfert', label: 'Transfert', emoji: '🪣' },
  { id: 'embouteillage', label: 'Embouteillage', emoji: '🍾' },
  { id: 'degustation', label: 'Dégustation', emoji: '🍺' },
  { id: 'note', label: 'Note', emoji: '✏️' },
]

export interface BrewEvent {
  id: string
  brew_id: string
  date: string
  kind: BrewEventKind
  gravity: number | null
  temp_c: number | null
  note: string
  created_at: string
}

const EVENT_COLS = 'id,brew_id,date,kind,gravity,temp_c,note,created_at'

export async function listBrewEvents(brewId: string): Promise<BrewEvent[]> {
  const { data, error } = await supabase
    .from('perso_brew_events')
    .select(EVENT_COLS)
    .eq('brew_id', brewId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as BrewEvent[]
}

export async function addBrewEvent(
  userId: string,
  brewId: string,
  ev: { date: string; kind: BrewEventKind; gravity?: number | null; temp_c?: number | null; note?: string },
): Promise<void> {
  const { error } = await supabase.from('perso_brew_events').insert({
    user_id: userId,
    brew_id: brewId,
    date: ev.date,
    kind: ev.kind,
    gravity: ev.gravity ?? null,
    temp_c: ev.temp_c ?? null,
    note: ev.note?.trim() ?? '',
  })
  if (error) throw new Error(error.message)
}

export async function deleteBrewEvent(id: string): Promise<void> {
  const { error } = await supabase.from('perso_brew_events').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Recettes du hub (via Edge Function "hub-recipes", lecture seule) ───────

export interface HubRecipe {
  id: string
  type: string
  name: string
  source: string | null
  style: string | null
  beer_category: string | null
  spirit_category: string | null
  batch_size_l: number | null
  abv: number | null
  ibu: number | null
  og: number | null
  fg: number | null
  srm: number | null
  favorite: boolean | null
  tried: boolean | null
  rating: number | null
  yeast_strain: string | null
  notes: string | null
}

export interface HubRecipeFull extends HubRecipe {
  grain_bill: unknown
  hop_additions: unknown
  mash_steps: unknown
  botanicals: unknown
  fermentation: unknown
  distillation: unknown
  maturation: unknown
  boil_time_min: number | null
  yeast_attenuation: string | null
  tasting_notes: string | null
  notes: string | null
}

/** État de connexion au hub, pour afficher un message adapté côté UI. */
export type HubStatus = 'ok' | 'not_configured' | 'error'

export interface HubRecipesResult {
  status: HubStatus
  recipes: HubRecipe[]
  message?: string
}

export async function fetchHubRecipes(): Promise<HubRecipesResult> {
  try {
    const { data, error } = await supabase.functions.invoke('hub-recipes', { body: {} })
    if (error) {
      // 503 = secrets HUB pas encore configurés côté fonction.
      const ctx = (error as { context?: Response }).context
      if (ctx?.status === 503) return { status: 'not_configured', recipes: [] }
      return { status: 'error', recipes: [], message: error.message }
    }
    if (data?.error === 'hub_not_configured') return { status: 'not_configured', recipes: [] }
    if (data?.error) return { status: 'error', recipes: [], message: data.error }
    return { status: 'ok', recipes: (data?.recipes ?? []) as HubRecipe[] }
  } catch (e) {
    return { status: 'error', recipes: [], message: (e as Error).message }
  }
}

export async function fetchHubRecipe(id: string): Promise<HubRecipeFull | null> {
  const { data, error } = await supabase.functions.invoke('hub-recipes', { body: { id } })
  if (error || data?.error) return null
  return (data?.recipe ?? null) as HubRecipeFull | null
}

// ── Écriture de notes vers le hub (Edge Function "hub-notes") ──────────────

/** Brassin en cours (WIP) côté hub. */
export interface HubWip {
  id: string
  recipeName: string
  recipeId: string | null
  brewDate: string | null
  notes: string
  eventCount: number
}

export interface HubWipResult {
  status: HubStatus
  wip: HubWip[]
}

export async function listHubWip(): Promise<HubWipResult> {
  try {
    const { data, error } = await supabase.functions.invoke('hub-notes', { body: { action: 'list_wip' } })
    if (error) {
      const ctx = (error as { context?: Response }).context
      if (ctx?.status === 503) return { status: 'not_configured', wip: [] }
      return { status: 'error', wip: [] }
    }
    if (data?.error === 'hub_not_configured') return { status: 'not_configured', wip: [] }
    if (data?.error) return { status: 'error', wip: [] }
    return { status: 'ok', wip: (data?.wip ?? []) as HubWip[] }
  } catch {
    return { status: 'error', wip: [] }
  }
}

/** Ajoute un événement daté à la timeline d'un brassin WIP (format hub). */
export async function addHubWipEvent(
  wipId: string,
  ev: { date: string; label: string; action?: string; note?: string; temp_C?: number | null; done?: boolean },
): Promise<boolean> {
  const event = {
    id: `evt-aide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: ev.date,
    type: 'custom',
    label: ev.label,
    action: ev.action ?? '',
    note: ev.note ?? '',
    status: ev.done ? 'done' : 'pending',
    temp_C: ev.temp_C ?? null,
    userModified: true,
    _source: 'aide',
  }
  const { data, error } = await supabase.functions.invoke('hub-notes', {
    body: { action: 'add_wip_event', wip_id: wipId, event },
  })
  return !error && !data?.error
}

export async function setHubWipNotes(wipId: string, notes: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('hub-notes', {
    body: { action: 'set_wip_notes', wip_id: wipId, notes },
  })
  return !error && !data?.error
}

export async function setHubRecipeNotes(recipeId: string, notes: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('hub-notes', {
    body: { action: 'set_recipe_notes', recipe_id: recipeId, notes },
  })
  return !error && !data?.error
}

// ── Aides ──────────────────────────────────────────────────────────────────

/** ABV approximatif à partir de la densité initiale/finale (formule standard). */
export function computeAbv(og: number | null, fg: number | null): number | null {
  if (og == null || fg == null || og <= fg) return null
  return Math.round((og - fg) * 131.25 * 10) / 10
}
