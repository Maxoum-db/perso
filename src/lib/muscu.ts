import { supabase } from './supabase'
import { fetchKv, saveKv } from './kv'
import { MUSCU_PROGRAM } from '../data/behourd'

// ── Module Musculation ───────────────────────────────────────────────────────
// Séances types (modèles éditables, pré-remplies depuis le programme Basic Fit)
// + journal des séances réalisées (exercices, reps/temps, charge, groupe visé).
// Données strictement personnelles (RLS own-only côté Supabase).

export interface ExoInput {
  name: string
  muscle_group: string
  sets: number
  reps: string // reps ("8-10") ou temps ("45s") pour le gainage
  weight_kg: number | null // null = poids du corps
  notes: string
}

export interface MuscuExo extends ExoInput {
  id: string
  position: number
}

export interface MuscuTemplate {
  id: string
  name: string
  icon: string
  duration_min: number | null
  notes: string
  position: number
  exercises: MuscuExo[]
}

export interface MuscuSession {
  id: string
  date: string
  name: string
  duration_min: number | null
  notes: string
  template_id: string | null
  exercises: MuscuExo[]
}

export interface CatalogExercise {
  id: string
  name: string
  muscle_group: string
  default_sets: number
  default_reps: string
  default_weight_kg: number | null
  notes: string
  position: number
}

// ── Groupes musculaires : prédéfinis mais modifiables (stockés en perso_kv) ──

export const MUSCLE_GROUPS_DEFAULT = [
  'Pectoraux',
  'Dos',
  'Épaules',
  'Biceps',
  'Triceps',
  'Quadriceps',
  'Ischios',
  'Fessiers',
  'Mollets',
  'Abdos/Core',
  'Cardio',
  'Full body',
]

const GROUPS_KEY = 'muscu_groups'
const SEED_KEY = 'muscu_seeded'
const CATALOG_SEED_KEY = 'muscu_catalog_seeded'

export async function loadMuscleGroups(userId: string): Promise<string[]> {
  const g = await fetchKv<string[]>(userId, GROUPS_KEY, MUSCLE_GROUPS_DEFAULT)
  return g && g.length ? g : MUSCLE_GROUPS_DEFAULT
}

export async function saveMuscleGroups(userId: string, groups: string[]): Promise<void> {
  await saveKv(userId, GROUPS_KEY, groups)
}

// ── Helpers internes ─────────────────────────────────────────────────────────

const EXO_COLS = 'id,name,muscle_group,sets,reps,weight_kg,notes,position'

function normalizeExo(raw: Record<string, unknown>): MuscuExo {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    muscle_group: String(raw.muscle_group ?? ''),
    sets: Number(raw.sets) || 0,
    reps: String(raw.reps ?? ''),
    weight_kg: raw.weight_kg === null || raw.weight_kg === undefined ? null : Number(raw.weight_kg),
    notes: String(raw.notes ?? ''),
    position: Number(raw.position) || 0,
  }
}

function exoRows(userId: string, parentCol: 'template_id' | 'session_id', parentId: string, exos: ExoInput[]) {
  return exos.map((e, i) => ({
    user_id: userId,
    [parentCol]: parentId,
    name: e.name.trim() || 'Exercice',
    muscle_group: e.muscle_group.trim(),
    sets: Math.max(1, Math.round(e.sets) || 1),
    reps: e.reps.trim() || '10',
    weight_kg: e.weight_kg,
    notes: e.notes.trim(),
    position: i,
  }))
}

// ── Catalogue d'exercices types (sélectionnables dans l'éditeur) ─────────────

export async function listCatalog(userId: string): Promise<CatalogExercise[]> {
  const { data, error } = await supabase
    .from('perso_muscu_exercises')
    .select('id,name,muscle_group,default_sets,default_reps,default_weight_kg,notes,position')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    ...r,
    default_weight_kg: r.default_weight_kg === null ? null : Number(r.default_weight_kg),
  })) as CatalogExercise[]
}

export async function saveCatalogExercise(
  userId: string,
  exo: Omit<CatalogExercise, 'id' | 'position'> & { id?: string },
): Promise<void> {
  const base = {
    name: exo.name.trim() || 'Exercice',
    muscle_group: exo.muscle_group.trim(),
    default_sets: Math.max(1, Math.round(exo.default_sets) || 1),
    default_reps: exo.default_reps.trim() || '10',
    default_weight_kg: exo.default_weight_kg,
    notes: exo.notes.trim(),
  }
  if (exo.id) {
    const { error } = await supabase
      .from('perso_muscu_exercises')
      .update({ ...base, updated_at: new Date().toISOString() })
      .eq('id', exo.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('perso_muscu_exercises').insert({ user_id: userId, ...base })
    if (error) throw new Error(error.message)
  }
}

export async function deleteCatalogExercise(id: string): Promise<void> {
  const { error } = await supabase.from('perso_muscu_exercises').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Séances types (modèles) ──────────────────────────────────────────────────

export async function listTemplates(userId: string): Promise<MuscuTemplate[]> {
  const { data: tpls, error } = await supabase
    .from('perso_muscu_templates')
    .select('id,name,icon,duration_min,notes,position')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  const { data: exos, error: e2 } = await supabase
    .from('perso_muscu_template_exercises')
    .select(`template_id,${EXO_COLS}`)
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (e2) throw new Error(e2.message)

  const byTpl = new Map<string, MuscuExo[]>()
  for (const raw of exos ?? []) {
    const list = byTpl.get(raw.template_id as string) ?? []
    list.push(normalizeExo(raw))
    byTpl.set(raw.template_id as string, list)
  }
  return (tpls ?? []).map((t) => ({
    ...t,
    notes: t.notes ?? '',
    exercises: byTpl.get(t.id) ?? [],
  })) as MuscuTemplate[]
}

export async function saveTemplate(
  userId: string,
  tpl: { id?: string; name: string; icon: string; duration_min: number | null; notes: string },
  exos: ExoInput[],
): Promise<string> {
  const base = {
    name: tpl.name.trim() || 'Séance',
    icon: tpl.icon || '🏋️',
    duration_min: tpl.duration_min,
    notes: tpl.notes.trim(),
  }
  let id = tpl.id
  if (id) {
    const { error } = await supabase
      .from('perso_muscu_templates')
      .update({ ...base, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
    const { error: eDel } = await supabase.from('perso_muscu_template_exercises').delete().eq('template_id', id)
    if (eDel) throw new Error(eDel.message)
  } else {
    const { data, error } = await supabase
      .from('perso_muscu_templates')
      .insert({ user_id: userId, ...base })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    id = (data as { id: string }).id
  }
  if (exos.length) {
    const { error } = await supabase
      .from('perso_muscu_template_exercises')
      .insert(exoRows(userId, 'template_id', id, exos))
    if (error) throw new Error(error.message)
  }
  return id
}

export async function deleteTemplate(id: string): Promise<void> {
  // Les exercices partent en cascade (FK on delete cascade).
  const { error } = await supabase.from('perso_muscu_templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Journal des séances ──────────────────────────────────────────────────────

export async function listSessions(userId: string, limit = 100): Promise<MuscuSession[]> {
  const { data: sessions, error } = await supabase
    .from('perso_muscu_sessions')
    .select('id,date,name,duration_min,notes,template_id')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  const ids = (sessions ?? []).map((s) => s.id)
  const bySession = new Map<string, MuscuExo[]>()
  if (ids.length) {
    const { data: exos, error: e2 } = await supabase
      .from('perso_muscu_session_exercises')
      .select(`session_id,${EXO_COLS}`)
      .in('session_id', ids)
      .order('position', { ascending: true })
    if (e2) throw new Error(e2.message)
    for (const raw of exos ?? []) {
      const list = bySession.get(raw.session_id as string) ?? []
      list.push(normalizeExo(raw))
      bySession.set(raw.session_id as string, list)
    }
  }
  return (sessions ?? []).map((s) => ({
    ...s,
    notes: s.notes ?? '',
    exercises: bySession.get(s.id) ?? [],
  })) as MuscuSession[]
}

export async function saveSession(
  userId: string,
  session: { id?: string; date: string; name: string; duration_min: number | null; notes: string; template_id: string | null },
  exos: ExoInput[],
): Promise<string> {
  const base = {
    date: session.date,
    name: session.name.trim() || 'Séance',
    duration_min: session.duration_min,
    notes: session.notes.trim(),
    template_id: session.template_id,
  }
  let id = session.id
  if (id) {
    const { error } = await supabase
      .from('perso_muscu_sessions')
      .update({ ...base, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
    const { error: eDel } = await supabase.from('perso_muscu_session_exercises').delete().eq('session_id', id)
    if (eDel) throw new Error(eDel.message)
  } else {
    const { data, error } = await supabase
      .from('perso_muscu_sessions')
      .insert({ user_id: userId, ...base })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    id = (data as { id: string }).id
  }
  if (exos.length) {
    const { error } = await supabase
      .from('perso_muscu_session_exercises')
      .insert(exoRows(userId, 'session_id', id, exos))
    if (error) throw new Error(error.message)
  }
  return id
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from('perso_muscu_sessions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Seed : importe le programme Basic Fit (Push/Pull/Legs/Core) une seule fois ─

// Groupe musculaire de chaque exercice du programme, dans l'ordre de MUSCU_PROGRAM.
const SEED_GROUPS: Record<string, string[]> = {
  push: ['Pectoraux', 'Pectoraux', 'Épaules', 'Épaules', 'Pectoraux', 'Triceps'],
  pull: ['Dos', 'Dos', 'Dos', 'Épaules', 'Biceps', 'Biceps'],
  legs: ['Quadriceps', 'Ischios', 'Quadriceps', 'Fessiers', 'Ischios', 'Mollets'],
  core: ['Abdos/Core', 'Abdos/Core', 'Abdos/Core', 'Abdos/Core', 'Abdos/Core'],
}
const SEED_ICONS: Record<string, string> = { push: '💪', pull: '🦾', legs: '🦵', core: '🧱' }

/** Crée les séances types par défaut à la première visite. Renvoie true si un seed a eu lieu. */
export async function ensureSeeded(userId: string): Promise<boolean> {
  const seeded = await fetchKv<boolean>(userId, SEED_KEY, false)
  let didSeed = false

  if (!seeded) {
    const { count, error } = await supabase
      .from('perso_muscu_templates')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (error) throw new Error(error.message)

    if (!count) {
      for (const [key, prog] of Object.entries(MUSCU_PROGRAM)) {
        const groups = SEED_GROUPS[key] ?? []
        await saveTemplate(
          userId,
          { name: prog.label, icon: SEED_ICONS[key] ?? '🏋️', duration_min: prog.duration_min, notes: '' },
          prog.exercises.map((e, i) => ({
            name: e.name,
            muscle_group: groups[i] ?? '',
            sets: e.sets,
            reps: e.reps,
            weight_kg: null,
            notes: [e.machine, e.notes].filter(Boolean).join(' — '),
          })),
        )
      }
    }
    await saveKv(userId, SEED_KEY, true)
    didSeed = true
  }

  // Catalogue : complète avec les exercices des séances types absents du
  // catalogue (une seule fois ; les exos déjà présents — perso — sont gardés).
  const catSeeded = await fetchKv<boolean>(userId, CATALOG_SEED_KEY, false)
  if (!catSeeded) {
    const [existing, tpls] = await Promise.all([listCatalog(userId), listTemplates(userId)])
    const have = new Set(existing.map((e) => e.name.trim().toLowerCase()))
    const rows: Array<Record<string, unknown>> = []
    let pos = 100
    for (const t of tpls) {
      for (const e of t.exercises) {
        const key = e.name.trim().toLowerCase()
        if (!key || have.has(key)) continue
        have.add(key)
        rows.push({
          user_id: userId,
          name: e.name,
          muscle_group: e.muscle_group,
          default_sets: e.sets,
          default_reps: e.reps,
          default_weight_kg: e.weight_kg,
          notes: e.notes,
          position: pos++,
        })
      }
    }
    if (rows.length) {
      const { error } = await supabase.from('perso_muscu_exercises').insert(rows)
      if (error) throw new Error(error.message)
    }
    await saveKv(userId, CATALOG_SEED_KEY, true)
    didSeed = true
  }

  return didSeed
}
