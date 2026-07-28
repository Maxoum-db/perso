import { supabase } from './supabase'
import { fetchKv, saveKv } from './kv'
import { MUSCU_PROGRAM } from '../data/behourd'
import { OUTDOOR_ACTIVITIES } from '../data/activities'
import { EXERCISE_LIBRARY, EXERCISE_RENAMES } from '../data/exercises'

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

// ── Tonnage : séries × reps × charge (exos au temps ou sans charge ignorés) ──

export function exoTonnage(e: { sets: number; reps: string; weight_kg: number | null }): number {
  if (e.weight_kg === null || e.weight_kg <= 0) return 0
  if (/\d\s*(s|sec|min)\b/i.test(e.reps)) return 0 // temps (gainage) : pas de tonnage
  const m = e.reps.match(/\d+/)
  if (!m) return 0
  return e.sets * parseInt(m[0], 10) * e.weight_kg
}

export function sessionTonnage(exos: Array<{ sets: number; reps: string; weight_kg: number | null }>): number {
  return exos.reduce((sum, e) => sum + exoTonnage(e), 0)
}

export function fmtTonnage(kg: number): string {
  if (kg >= 10000) return `${(kg / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} t`
  return `${Math.round(kg).toLocaleString('fr-FR')} kg`
}

// ── Groupes musculaires d'un exercice : un ou plusieurs, séparés par des virgules ──

export interface GroupEntry {
  name: string
  /** 1 = moteur principal, 0.5 = secondaire, 0.3 = stabilisateur. */
  intensity: number
}

/**
 * « Pectoraux, Triceps:0.5 » → [{Pectoraux, 1}, {Triceps, 0.5}]
 * Un groupe sans coefficient vaut 1 : les valeurs saisies avant l'arrivée des
 * intensités restent donc valides.
 */
export function parseGroupEntries(value: string): GroupEntry[] {
  return value
    .split(',')
    .map((part) => {
      const [rawName, rawIntensity] = part.split(':')
      const name = (rawName ?? '').trim()
      if (!name) return null
      const n = parseFloat((rawIntensity ?? '').trim())
      const intensity = Number.isFinite(n) && n > 0 ? Math.min(1, n) : 1
      return { name, intensity }
    })
    .filter((e): e is GroupEntry => e !== null)
}

/** Les seuls noms des groupes, sans les coefficients. */
export function parseGroups(value: string): string[] {
  return parseGroupEntries(value).map((e) => e.name)
}

/** Sérialise en omettant le coefficient quand il vaut 1 (valeur par défaut). */
export function serializeGroups(entries: GroupEntry[]): string {
  return entries
    .filter((e) => e.name.trim())
    .map((e) => (e.intensity >= 1 ? e.name.trim() : `${e.name.trim()}:${e.intensity}`))
    .join(', ')
}

// ── Récupération : depuis combien de jours chaque groupe a-t-il été travaillé ──

/**
 * Pour chaque groupe musculaire, le nombre de jours écoulés depuis la dernière
 * séance qui l'a travaillé (0 = aujourd'hui). Un groupe absent n'a jamais été
 * travaillé sur la période chargée.
 */
export interface GroupLoad {
  /** Jours écoulés depuis la dernière sollicitation. */
  days: number
  /** Intensité de cette sollicitation (1 = principal). */
  intensity: number
  /**
   * Jours « ressentis » : un muscle sollicité en secondaire récupère nettement
   * plus vite qu'un moteur principal. La pondération est quadratique
   * (jours ÷ intensité²) : à pleine intensité rien ne change, et l'accélération
   * s'accentue à mesure que le ratio baisse — 1 jour à 0.5 pèse autant que
   * 4 jours à pleine charge, 1 jour à 0.3 en pèse 11.
   */
  effectiveDays: number
}

export function groupLoads(sessions: MuscuSession[]): Record<string, GroupLoad> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const out: Record<string, GroupLoad> = {}
  for (const s of sessions) {
    const days = Math.round((today.getTime() - new Date(s.date + 'T00:00:00').getTime()) / 86400000)
    if (days < 0) continue // séance datée dans le futur : ignorée
    // Un exercice peut viser plusieurs groupes, chacun à sa propre intensité.
    for (const e of s.exercises) {
      for (const g of parseGroupEntries(e.muscle_group)) {
        const effectiveDays = days / (g.intensity * g.intensity)
        const cur = out[g.name]
        // On garde la sollicitation la plus « fraîche » au sens ressenti.
        if (!cur || effectiveDays < cur.effectiveDays) {
          out[g.name] = { days, intensity: g.intensity, effectiveDays }
        }
      }
    }
  }
  return out
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
  'Trapèzes',
  'Lombaires',
  'Avant-bras',
  'Adducteurs',
  'Obliques',
  'Cou',
  'Mollets',
  'Abdos/Core',
  // Groupes « parapluie » pour les activités qui sollicitent tout un bloc
  // (course, natation…) : ils colorent plusieurs zones du mannequin.
  'Jambes (global)',
  'Haut du corps (global)',
  'Cardio',
  'Full body',
  // Muscles précis : pour ceux qui veulent viser finement (le mannequin les
  // distingue un par un).
  'Deltoïde antérieur',
  'Deltoïde latéral',
  'Deltoïde postérieur',
  'Pectoral supérieur',
  'Grand pectoral',
  'Grand dorsal',
  'Grand rond',
  'Rhomboïdes',
  'Trapèze supérieur',
  'Trapèze moyen',
  'Trapèze inférieur',
  'Érecteurs du rachis',
  'Brachial',
  'Brachio-radial',
  'Triceps longue portion',
  'Triceps latéral',
  'Fléchisseurs avant-bras',
  'Extenseurs avant-bras',
  'Grand droit',
  'Grand fessier',
  'Moyen fessier',
  'Droit fémoral',
  'Vaste latéral',
  'Vaste médial',
  'Biceps fémoral',
  'Ischios internes',
  'Gastrocnémiens',
  'Soléaire',
  'Tibial antérieur',
]

/**
 * Exercices dont la charge est le poids du corps : à l'ajout, le champ kg est
 * pré-rempli avec la dernière pesée de l'utilisateur connecté (chacun le sien).
 * Les versions assistées en sont exclues : la machine retire une partie du poids.
 */
const BODYWEIGHT_KEYWORDS = [
  'traction',
  'pompe',
  'dips',
  'burpee',
  'escalade',
  'sprint',
  'corde à sauter',
  'saut sur box',
  'genoux suspendu',
  'grimpeur',
  'sac lesté',
  'course à pied',
  'sentier',
]

export function isBodyweightExercise(name: string): boolean {
  const n = name.toLowerCase()
  if (n.includes('assist')) return false
  return BODYWEIGHT_KEYWORDS.some((k) => n.includes(k))
}

const GROUPS_KEY = 'muscu_groups'
const SEED_KEY = 'muscu_seeded'
const CATALOG_SEED_KEY = 'muscu_catalog_seeded'
const ACTIVITIES_SEED_KEY = 'muscu_activities_seeded'
const LIBRARY_SEED_KEY = 'muscu_library_v6'

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
  if (error) throw new Error(error.message)
  // Ordre alphabétique (localeCompare : « Élévations » se range bien avec les E).
  return (data ?? [])
    .map((r) => ({
      ...r,
      default_weight_kg: r.default_weight_kg === null ? null : Number(r.default_weight_kg),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })) as CatalogExercise[]
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

  // Activités hors salle (natation, course, bois, extérieur) : ajoutées une
  // fois au catalogue, sans toucher aux exercices déjà présents.
  const actSeeded = await fetchKv<boolean>(userId, ACTIVITIES_SEED_KEY, false)
  if (!actSeeded) {
    const existing = await listCatalog(userId)
    const have = new Set(existing.map((e) => e.name.trim().toLowerCase()))
    const rows = OUTDOOR_ACTIVITIES.filter((a) => !have.has(a.name.trim().toLowerCase())).map((a, i) => ({
      user_id: userId,
      name: a.name,
      muscle_group: a.muscle_group,
      default_sets: a.sets,
      default_reps: a.reps,
      default_weight_kg: null,
      notes: a.notes,
      position: 200 + i,
    }))
    if (rows.length) {
      const { error } = await supabase.from('perso_muscu_exercises').insert(rows)
      if (error) throw new Error(error.message)
    }
    await saveKv(userId, ACTIVITIES_SEED_KEY, true)
    didSeed = true
  }

  if (await ensureLibrary(userId)) didSeed = true

  return didSeed
}

/**
 * Aligne le catalogue sur la bibliothèque de référence :
 *  - complète les groupes musculaires des exercices qui n'en avaient qu'un,
 *    avec leurs coefficients d'intensité ;
 *  - ajoute les exercices absents.
 * Les exercices dont l'utilisateur a lui-même défini plusieurs groupes ne sont
 * jamais réécrits.
 */
async function ensureLibrary(userId: string): Promise<boolean> {
  const done = await fetchKv<boolean>(userId, LIBRARY_SEED_KEY, false)
  if (done) return false

  const existing = await listCatalog(userId)
  // Un exercice renommé (ex. « Hip thrust » → « Poussée de hanches ») est
  // indexé sous son NOUVEAU nom : il sera mis à jour, pas dupliqué.
  const byName = new Map(
    existing.map((e) => {
      const key = e.name.trim().toLowerCase()
      return [(EXERCISE_RENAMES[key] ?? e.name).trim().toLowerCase(), e]
    }),
  )

  const toAdd: Array<Record<string, unknown>> = []
  let position = 300
  for (const lib of EXERCISE_LIBRARY) {
    const current = byName.get(lib.name.trim().toLowerCase())
    if (!current) {
      toAdd.push({
        user_id: userId,
        name: lib.name,
        muscle_group: lib.groups,
        default_sets: lib.sets,
        default_reps: lib.reps,
        default_weight_kg: null,
        notes: lib.notes ?? '',
        position: position++,
      })
      continue
    }
    // Réalignement sur la référence (les exercices que TU as créés toi-même ne
    // sont pas dans la bibliothèque : ils ne sont donc jamais touchés).
    if (current.name.trim() === lib.name && current.muscle_group.trim() === lib.groups) continue
    const { error } = await supabase
      .from('perso_muscu_exercises')
      .update({ name: lib.name, muscle_group: lib.groups, updated_at: new Date().toISOString() })
      .eq('id', current.id)
    if (error) throw new Error(error.message)
  }

  if (toAdd.length) {
    const { error } = await supabase.from('perso_muscu_exercises').insert(toAdd)
    if (error) throw new Error(error.message)
  }
  await saveKv(userId, LIBRARY_SEED_KEY, true)
  return true
}
