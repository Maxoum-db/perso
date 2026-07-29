import { supabase } from './supabase'
import { fetchKv, saveKv } from './kv'
import { MUSCU_PROGRAM } from '../data/behourd'
import { OUTDOOR_ACTIVITIES } from '../data/activities'
import { EXERCISE_LIBRARY, EXERCISE_RENAMES, RECUPERATION_NAMES } from '../data/exercises'
import { regionsForGroup } from './muscles'

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

/**
 * Nom réservé à la ligne « ressenti » d'une séance sans exercices précis
 * (béhourd, kickboxing). Elle porte les zones sollicitées et leur intensité,
 * mais ne compte ni dans le tonnage ni dans le coût métabolique.
 */
export const RESSENTI_NAME = 'Ressenti de séance'

export function estRessenti(name: string): boolean {
  return name.trim().toLowerCase() === RESSENTI_NAME.toLowerCase()
}

// ── Tonnage : séries × reps × charge (exos au temps ou sans charge ignorés) ──

/**
 * Équivalence distance → répétitions. Un traîneau poussé sur 20 m compté comme
 * 20 répétitions gonfle le tonnage d'un facteur 10 et écrase tout le reste de
 * la séance. 10 m ≈ une répétition remet les portages et le traîneau à leur
 * juste poids face à une série de squats.
 */
export const METRES_PAR_REP = 10

/** Distance d'un format de reps (« 20 m », « 30 m/côté », « 1 km »), en mètres. */
export function distanceEnMetres(reps: string): number | null {
  const m = reps.match(/(\d+(?:[.,]\d+)?)\s*(km|m)\b/i)
  if (!m) return null
  const val = parseFloat(m[1].replace(',', '.'))
  if (!Number.isFinite(val)) return null
  return m[2].toLowerCase() === 'km' ? val * 1000 : val
}

/** Répétitions retenues pour le tonnage : distance convertie, sinon le nombre saisi. */
export function repsPourTonnage(reps: string): number | null {
  if (/\d\s*(s|sec|min)\b/i.test(reps)) return null // temps (gainage) : pas de tonnage
  const metres = distanceEnMetres(reps)
  if (metres !== null) return Math.max(1, Math.round(metres / METRES_PAR_REP))
  const m = reps.match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}

export function exoTonnage(e: { sets: number; reps: string; weight_kg: number | null }): number {
  if (e.weight_kg === null || e.weight_kg <= 0) return 0
  const reps = repsPourTonnage(e.reps)
  if (reps === null) return 0
  return e.sets * reps * e.weight_kg
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
   * s'accentue à mesure que le ratio baisse. Garde-fou : le lendemain d'une
   * séance, un muscle reste au minimum orange — jamais vert d'emblée.
   */
  effectiveDays: number
  /** Jours de récupération ajoutés à la main (courbatures déclarées). */
  soreExtra?: number
  /** Jours retirés par des séances de récupération active postérieures. */
  recupBonus?: number
}

/** Une séance de récupération active ne fatigue pas : elle raccourcit le délai. */
function estRecuperation(name: string): boolean {
  return RECUPERATION_NAMES.has(name.trim().toLowerCase())
}

export function groupLoads(sessions: MuscuSession[]): Record<string, GroupLoad> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const jours = (date: string) => Math.round((today.getTime() - new Date(date + 'T00:00:00').getTime()) / 86400000)

  // Récupération active : elle ne compte pas comme du travail, elle en efface.
  // Indexée par MUSCLE et non par libellé de groupe — sans ça une marche
  // déclarée sur « Jambes » ne toucherait jamais un squat déclaré sur
  // « Quadriceps », alors que ce sont les mêmes muscles.
  const recups = new Map<string, number[]>()
  for (const s of sessions) {
    const d = jours(s.date)
    if (d < 0) continue
    for (const e of s.exercises) {
      if (!estRecuperation(e.name)) continue
      for (const g of parseGroupEntries(e.muscle_group)) {
        for (const region of regionsForGroup(g.name)) {
          const l = recups.get(region) ?? []
          l.push(d)
          recups.set(region, l)
        }
      }
    }
  }

  const out: Record<string, GroupLoad> = {}
  for (const s of sessions) {
    const days = jours(s.date)
    if (days < 0) continue // séance datée dans le futur : ignorée
    // Un exercice peut viser plusieurs groupes, chacun à sa propre intensité.
    for (const e of s.exercises) {
      if (estRecuperation(e.name)) continue
      for (const g of parseGroupEntries(e.muscle_group)) {
        // Pondération quadratique, plafonnée au palier orange les premiers
        // jours — sans ce plafond une sollicitation légère saute du rouge au
        // vert sans transition. La durée du plafond suit l'intensité :
        //   ≥ 0,5 → deux jours d'orange, c'est un vrai travail ;
        //   < 0,5 → un seul, la sollicitation était accessoire.
        const joursPlafonnes = g.intensity >= 0.5 ? 2 : 1
        const raw = days / (g.intensity * g.intensity)
        const effectiveDays = days <= joursPlafonnes ? Math.min(raw, 4) : raw
        const cur = out[g.name]
        // On garde la sollicitation la plus « fraîche » au sens ressenti.
        if (!cur || effectiveDays < cur.effectiveDays) {
          out[g.name] = { days, intensity: g.intensity, effectiveDays }
        }
      }
    }
  }

  // Chaque séance de récupération faite APRÈS le travail retire un jour, deux
  // au maximum : au-delà, ce n'est plus de la récupération, c'est du repos.
  // Un groupe profite du bonus dès qu'un de ses muscles en a bénéficié.
  for (const [group, load] of Object.entries(out)) {
    const dates = new Set<number>()
    for (const region of regionsForGroup(group)) {
      for (const d of recups.get(region) ?? []) if (d < load.days) dates.add(d)
    }
    if (dates.size === 0) continue
    const bonus = Math.min(2, dates.size)
    out[group] = { ...load, effectiveDays: load.effectiveDays + bonus, recupBonus: bonus }
  }
  return out
}

// ── Progression par exercice ────────────────────────────────────────────────

export interface ProgressPoint {
  date: string
  /** Charge maximale utilisée ce jour-là (null = poids du corps / sans charge). */
  weight: number | null
  sets: number
  reps: string
  tonnage: number
}

export interface ExerciseProgress {
  name: string
  /** Un point par jour où l'exercice a été fait, du plus ancien au plus récent. */
  points: ProgressPoint[]
  /** Record de charge, et le jour où il a été établi. */
  best: { weight: number; date: string } | null
  /** Record de tonnage sur une séance. */
  bestTonnage: { value: number; date: string } | null
  lastDate: string
}

/**
 * Agrège le journal par exercice : une courbe de charge, les records, et le
 * nombre de séances. Plusieurs lignes du même exercice le même jour sont
 * fusionnées (charge maximale, tonnage cumulé).
 */
export function exerciseProgress(sessions: MuscuSession[]): ExerciseProgress[] {
  const byName = new Map<string, { display: string; byDate: Map<string, ProgressPoint> }>()

  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of s.exercises) {
      const key = e.name.trim().toLowerCase()
      if (!key) continue
      const entry = byName.get(key) ?? { display: e.name.trim(), byDate: new Map<string, ProgressPoint>() }
      entry.display = e.name.trim() // le libellé le plus récent fait foi
      const cur = entry.byDate.get(s.date)
      const weight =
        e.weight_kg === null ? (cur?.weight ?? null) : Math.max(cur?.weight ?? Number.NEGATIVE_INFINITY, e.weight_kg)
      entry.byDate.set(s.date, {
        date: s.date,
        weight: weight === Number.NEGATIVE_INFINITY ? null : weight,
        sets: (cur?.sets ?? 0) + e.sets,
        reps: e.reps,
        tonnage: (cur?.tonnage ?? 0) + exoTonnage(e),
      })
      byName.set(key, entry)
    }
  }

  const out: ExerciseProgress[] = []
  for (const { display, byDate } of byName.values()) {
    const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
    let best: { weight: number; date: string } | null = null
    let bestTonnage: { value: number; date: string } | null = null
    for (const p of points) {
      if (p.weight !== null && (!best || p.weight > best.weight)) best = { weight: p.weight, date: p.date }
      if (p.tonnage > 0 && (!bestTonnage || p.tonnage > bestTonnage.value))
        bestTonnage = { value: p.tonnage, date: p.date }
    }
    out.push({ name: display, points, best, bestTonnage, lastDate: points[points.length - 1].date })
  }
  return out.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
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
const LIBRARY_SEED_KEY = 'muscu_library_v14'
const RECUP_TEMPLATES_KEY = 'muscu_recup_templates_v2'

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
  if (await ensureRecoveryTemplates(userId)) didSeed = true

  return didSeed
}

/**
 * Deux séances types de récupération active, prêtes à lancer. Elles retirent un
 * jour de récupération aux zones qu'elles touchent : sans modèle sous la main,
 * personne ne pense à les enregistrer.
 */
const RECUP_TEMPLATES: Array<{ name: string; icon: string; duration: number; notes: string; exos: string[] }> = [
  {
    name: 'Récup — lendemain de béhourd',
    icon: '🧘',
    duration: 35,
    notes: 'Le lendemain d’un sparring : relancer la circulation sans rien casser.',
    exos: ['Récupération — nage souple', 'Récupération — mobilité haut du corps', 'Récupération — rouleau de massage'],
  },
  {
    name: 'Récup — jambes lourdes',
    icon: '🍃',
    duration: 30,
    notes: 'Après une grosse séance de jambes ou beaucoup de déplacement en armure.',
    exos: ['Récupération — marche', 'Récupération — mobilité hanches et jambes', 'Récupération — rouleau de massage'],
  },
  {
    name: 'Récup — étirements complets',
    icon: '🧊',
    duration: 25,
    notes: 'Une chaîne après l’autre, 45 s par côté, en respirant. Jamais à froid : après une séance ou en fin de journée active.',
    exos: [
      'Étirement des ischios (jambe tendue)',
      'Étirement des quadriceps debout',
      'Étirement des fessiers (figure 4)',
      'Étirement fléchisseurs de hanche (fente basse)',
      'Étirement des adducteurs (papillon)',
      'Étirement des mollets au mur',
      'Étirement du grand dorsal',
      'Étirement pectoraux au mur',
      'Étirement des trapèzes et de la nuque',
      'Étirement des avant-bras',
    ],
  },
  {
    name: 'Récup — poids du corps',
    icon: '🍃',
    duration: 25,
    notes: 'Amplitude et circulation, jamais l’échec. À placer le lendemain d’une séance lourde.',
    exos: [
      'Salutation au soleil (enchaînement)',
      'Chat-vache (mobilité du rachis)',
      'Squat profond en tenue',
      'Pont fessier au sol',
      'Marche en fente lente',
      'Rotations d’épaules à vide',
      '90/90 hanches (rotation assise)',
    ],
  },
  {
    name: 'Récup — nuque et épaules',
    icon: '🩹',
    duration: 15,
    notes: 'Après le port du heaume ou une séance de poussée. Cible l’épaule AC et les cervicales.',
    exos: [
      'Étirement des trapèzes et de la nuque',
      'Étirement pectoraux au mur',
      'Rotation thoracique couché',
      'Rotations d’épaules à vide',
      'Étirement du grand dorsal',
    ],
  },
]

async function ensureRecoveryTemplates(userId: string): Promise<boolean> {
  const done = await fetchKv<boolean>(userId, RECUP_TEMPLATES_KEY, false)
  if (done) return false

  const existants = new Set((await listTemplates(userId)).map((t) => t.name.trim().toLowerCase()))
  const lib = new Map(EXERCISE_LIBRARY.map((e) => [e.name, e]))
  for (const tpl of RECUP_TEMPLATES) {
    if (existants.has(tpl.name.trim().toLowerCase())) continue
    await saveTemplate(
      userId,
      { name: tpl.name, icon: tpl.icon, duration_min: tpl.duration, notes: tpl.notes },
      tpl.exos.map((n) => {
        const e = lib.get(n)
        return {
          name: n,
          muscle_group: e?.groups ?? '',
          sets: e?.sets ?? 1,
          reps: e?.reps ?? '15 min',
          weight_kg: null,
          notes: '',
        }
      }),
    )
  }
  await saveKv(userId, RECUP_TEMPLATES_KEY, true)
  return true
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
