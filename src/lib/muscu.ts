import { supabase } from './supabase'
import { fetchKv, saveKv } from './kv'
import { MUSCU_PROGRAM } from '../data/behourd'
import { EXERCISE_LIBRARY, EXERCISE_RENAMES, RECUPERATION_NAMES } from '../data/exercises'
import { partParDefaut, regionsForGroup } from './muscles'
import { SEUIL_PRET, VITESSE_MAX, VITESSE_MIN } from './recuperation'
import { loadIntensites, recupIntensite, type IntensiteId, type Intensites } from './intensite'

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
  /** Horodatage d'enregistrement — sert à situer la séance dans la journée. */
  created_at?: string
  /**
   * Intensité déclarée à la main. Absente = non déclarée, et c'est le calcul
   * automatique qui s'applique. Elle vit dans le KV faute de colonne dédiée,
   * mais elle est recollée ici pour que tout le reste du module la voie comme
   * une propriété ordinaire de la séance.
   */
  intensite?: IntensiteId
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
 *
 * Un groupe sans coefficient vaut 1 — les valeurs saisies avant l'arrivée des
 * intensités restent donc valides —, SAUF les libellés parapluie, qui valent ce
 * que `partParDefaut` leur accorde : « Full body » n'a jamais voulu dire que les
 * trente-huit muscles étaient moteurs.
 */
export function parseGroupEntries(value: string): GroupEntry[] {
  return value
    .split(',')
    .map((part) => {
      const [rawName, rawIntensity] = part.split(':')
      const name = (rawName ?? '').trim()
      if (!name) return null
      const n = parseFloat((rawIntensity ?? '').trim())
      const intensity = Number.isFinite(n) && n > 0 ? Math.min(1, n) : partParDefaut(name)
      return { name, intensity }
    })
    .filter((e): e is GroupEntry => e !== null)
}

/** Les seuls noms des groupes, sans les coefficients. */
export function parseGroups(value: string): string[] {
  return parseGroupEntries(value).map((e) => e.name)
}

/**
 * Sérialise en omettant le coefficient quand il vaut déjà la valeur par défaut
 * du libellé — donc 1 pour un muscle, moins pour un parapluie.
 *
 * C'est ce qui garde l'aller-retour cohérent : cocher « Full body » en principal
 * dans le sélecteur écrit « Full body:1 » et se relit en principal. Omis, il se
 * serait relu en secondaire, et le sélecteur aurait affiché autre chose que ce
 * qu'on venait d'y cocher.
 */
export function serializeGroups(entries: GroupEntry[]): string {
  return entries
    .filter((e) => e.name.trim())
    .map((e) => (e.intensity === partParDefaut(e.name.trim()) ? e.name.trim() : `${e.name.trim()}:${e.intensity}`))
    .join(', ')
}

// ── Récupération : depuis combien de jours chaque groupe a-t-il été travaillé ──

/**
 * Pas de temps de la récupération : une demi-journée.
 *
 * En marches de 24 h, un muscle gardait la même couleur du réveil au coucher
 * puis changeait d'un coup pendant la nuit — alors qu'entre une séance du matin
 * et le soir même il s'est passé l'essentiel de la première phase de
 * récupération. À 12 h, chaque journée porte deux états : le mannequin bouge
 * dans la journée, et l'écart matin/soir cesse d'être invisible.
 */
export const PAS_HEURES = 12
export const PAS_JOURS = PAS_HEURES / 24

/**
 * Instant de référence d'une séance.
 *
 * Enregistrée le jour même, son heure de création fait foi — c'est le seul
 * moyen de distinguer une séance de 8 h d'une séance de 20 h, soit une section
 * entière. Saisie après coup, on la place à midi : à mi-journée l'erreur ne
 * dépasse jamais une demi-section dans un sens ou dans l'autre.
 */
export function instantSeance(s: { date: string; created_at?: string }): number {
  if (s.created_at) {
    const t = new Date(s.created_at)
    if (!Number.isNaN(t.getTime()) && t.toLocaleDateString('en-CA') === s.date) return t.getTime()
  }
  return new Date(s.date + 'T12:00:00').getTime()
}

/**
 * Ancienneté d'une séance en jours, arrondie à la demi-journée INFÉRIEURE : on
 * ne fait jamais vieillir un muscle plus vite que le temps réel.
 */
export function ancienneteEnJours(s: { date: string; created_at?: string }, now = Date.now()): number {
  const heures = (now - instantSeance(s)) / 3600000
  return Math.max(0, Math.floor(heures / PAS_HEURES) * PAS_JOURS)
}

/** « aujourd'hui », « il y a 12 h », « hier », « il y a 3 j ½ ». */
export function fmtAnciennete(jours: number): string {
  if (jours < PAS_JOURS) return "aujourd'hui"
  if (jours < 1) return `il y a ${PAS_HEURES} h`
  if (jours < 1 + PAS_JOURS) return 'hier'
  const pleins = Math.floor(jours)
  return `il y a ${pleins} j${jours - pleins >= PAS_JOURS ? ' ½' : ''}`
}

/**
 * Pour chaque groupe musculaire, le nombre de jours écoulés depuis la dernière
 * séance qui l'a travaillé (0 = aujourd'hui). Un groupe absent n'a jamais été
 * travaillé sur la période chargée.
 */
export interface GroupLoad {
  /** Jours écoulés depuis la dernière sollicitation, par pas d'une demi-journée. */
  days: number
  /** Date de la séance à l'origine (YYYY-MM-DD). */
  date: string
  /** Intensité de cette sollicitation (1 = principal). */
  intensity: number
  /** Jours « ressentis » — cf. `joursRessentis`. */
  effectiveDays: number
  /** Jours de récupération ajoutés à la main (courbatures déclarées). */
  soreExtra?: number
  /** Déclaré « totalement bon » : prime sur le barème, plafond compris. */
  sorePret?: boolean
  /**
   * Jours ressentis tels que le barème les donnait AVANT ta déclaration.
   *
   * Porté et non reconstruit : ré-ajouter l'ajustement à la valeur corrigée
   * tombait à côté dès que la soustraction avait buté sur le plancher à 0 — un
   * muscle corrigé de +2 j alors qu'il n'en avait qu'un affichait 0, et le calcul
   * inverse rendait 2 au lieu de 1. C'est cette valeur que la base d'observations
   * juge, elle doit être exacte.
   */
  effectiveDaysPrevus?: number
  /** Jours retirés par des séances de récupération active postérieures. */
  recupBonus?: number
  /** Jours ajoutés (ou retirés) par l'intensité déclarée de la séance. */
  intensiteRecup?: number
  /** Jours ajoutés (ou retirés) par le sommeil des nuits depuis la séance. */
  sommeilDelta?: number
  /** Intensité déclarée de la séance à l'origine, pour l'expliquer sur la fiche. */
  intensiteId?: IntensiteId
}

// ── Part du muscle dans l'exercice → jours ressentis ────────────────────────
//
// La règle précédente DIVISAIT les jours écoulés par la part au carré. Elle
// avait deux défauts, l'un à chaque bout, et ils se voyaient tous les deux sur
// une marche du fermier :
//
//   • le jour même, `0 ÷ part²` vaut zéro QUELLE QUE SOIT la part. Un quadriceps
//     touché à 40 % s'affichait donc aussi brûlant que l'avant-bras qui, lui,
//     avait vraiment lâché. Un exercice à cinq groupes allumait le mannequin
//     entier au maximum — c'est exactement ce qui paraissait excessif ;
//   • le surlendemain, la division explose : 1,5 ÷ 0,4² = 9,4 jours ressentis.
//     Le même quadriceps passait d'« ambre » à « froid, jamais travaillé » en
//     douze heures, et se retrouvait annoncé plus frais qu'un muscle réellement
//     au repos depuis neuf jours.
//
// La part ne change pas la VITESSE du temps, elle change la PROFONDEUR du trou.
// C'est ce que dit la littérature : quand la perte de force immédiate reste
// sous ~20 %, tout est revenu en deux jours — le muscle ne récupère pas plus
// vite, il avait simplement moins à réparer.
// https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6628445/
//
// D'où une AVANCE DE DÉPART plutôt qu'une division : une sollicitation légère
// commence déjà à mi-chemin, puis avance au rythme du calendrier, un jour par
// jour. Le temps reste le temps.

/**
 * Avance maximale accordée à une sollicitation nulle, en jours ressentis.
 *
 * Vaut le seuil de « prêt » : une part qui tend vers zéro n'a jamais rien coûté
 * et démarre donc au vert. Entre les deux, l'avance suit `1 − part²`, si bien
 * qu'un moteur principal n'en reçoit aucune et qu'un stabilisateur à 40 % en
 * reçoit 84 %.
 */
export const AVANCE_MAX = SEUIL_PRET

/**
 * Jamais plus frais que le calendrier.
 *
 * Passé ce plafond, l'avance de départ cesse de compter : sans lui, un muscle
 * effleuré hier serait classé devant un muscle qu'on n'a pas touché depuis une
 * semaine, et le générateur irait chercher le mauvais.
 *
 * La valeur est celle qui rend « prêt » la zone la plus lente du barème
 * (7,5 j × 0,6 = 4,5) : le palier ne peut donc jamais retenir un muscle EN
 * DEÇÀ du seuil, et le compte à rebours de la fiche reste une simple division.
 */
export const PLAFOND_FRAICHEUR = SEUIL_PRET / VITESSE_MIN

/**
 * Le jour même, aucun muscle sollicité n'affiche « prêt ».
 *
 * Un cran sous le seuil pour la zone la plus RAPIDE : même un avant-bras
 * effleuré reste au mieux « bientôt prêt » tant que la journée n'est pas
 * passée. On a beau savoir qu'une sollicitation à 40 % ne coûte presque rien,
 * l'annoncer vert le soir même de la séance ne serait pas crédible.
 */
export const PLAFOND_JOUR_J = (SEUIL_PRET - PAS_JOURS) / VITESSE_MAX

/** Le plafond applicable à une charge, selon son ancienneté. */
export function plafondRecup(days: number): number {
  return days < 1 ? PLAFOND_JOUR_J : Math.max(days, PLAFOND_FRAICHEUR)
}

/**
 * Jours ressentis d'une sollicitation : ancienneté réelle + avance de départ,
 * le tout sous plafond.
 *
 * `avanceSup` porte ce qui s'ajoute par-dessus le barème (récupération active),
 * pour que le plafond s'applique une seule fois, au même endroit, plutôt qu'une
 * fois par correction.
 */
export function joursRessentis(days: number, part: number, avanceSup = 0): number {
  const i = Math.max(0, Math.min(1, part))
  const avance = (1 - i * i) * AVANCE_MAX
  return Math.min(days + avance + avanceSup, plafondRecup(days))
}

/** Une séance de récupération active ne fatigue pas : elle raccourcit le délai. */
function estRecuperation(name: string): boolean {
  return RECUPERATION_NAMES.has(name.trim().toLowerCase())
}

export function groupLoads(sessions: MuscuSession[]): Record<string, GroupLoad> {
  const now = Date.now()
  const aujourdhui = new Date(now).toLocaleDateString('en-CA')

  // Récupération active : elle ne compte pas comme du travail, elle en efface.
  // Indexée par MUSCLE et non par libellé de groupe — sans ça une marche
  // déclarée sur « Jambes » ne toucherait jamais un squat déclaré sur
  // « Quadriceps », alors que ce sont les mêmes muscles.
  const recups = new Map<string, number[]>()
  for (const s of sessions) {
    if (s.date > aujourdhui) continue
    const d = ancienneteEnJours(s, now)
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
    if (s.date > aujourdhui) continue // séance datée dans le futur : ignorée
    const days = ancienneteEnJours(s, now)
    // Un exercice peut viser plusieurs groupes, chacun à sa propre intensité.
    for (const e of s.exercises) {
      if (estRecuperation(e.name)) continue
      for (const g of parseGroupEntries(e.muscle_group)) {
        // L'intensité déclarée retarde le retour au vert : jusqu'à un jour de
        // plus pour un moteur principal d'une séance à fond. On RETIRE des jours
        // ressentis, exactement comme des courbatures déclarées — le muscle est
        // traité comme s'il avait été travaillé plus récemment qu'il ne l'a été.
        //
        // Passée EN AVANCE et non soustraite au résultat : une séance déclarée
        // « tranquille » rend des jours au lieu d'en prendre, et retranchée après
        // coup elle passait par-dessus le plafond du jour J.
        const sur = recupIntensite(s.intensite, g.intensity)
        const effectiveDays = Math.max(0, joursRessentis(days, g.intensity, -sur))
        const cur = out[g.name]
        // On garde la sollicitation la plus « fraîche » au sens ressenti.
        if (!cur || effectiveDays < cur.effectiveDays) {
          out[g.name] = {
            days,
            date: s.date,
            intensity: g.intensity,
            effectiveDays,
            ...(sur !== 0 ? { intensiteRecup: sur, intensiteId: s.intensite } : {}),
          }
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
    // On repasse par `joursRessentis` au lieu d'ajouter au résultat : le bonus
    // rentre alors sous le même plafond que l'avance de départ, appliqué une
    // seule fois. Ajouté par-dessus un plafond déjà atteint, il le faisait
    // sauter — une récup active raccourcit le délai, elle n'efface pas la
    // journée qui vient de se passer.
    out[group] = {
      ...load,
      effectiveDays: Math.max(0, joursRessentis(load.days, load.intensity, bonus - (load.intensiteRecup ?? 0))),
      recupBonus: bonus,
    }
  }
  return out
}

// ── Fenêtre glissante ───────────────────────────────────────────────────────

/**
 * Les séances des N derniers jours, fenêtre GLISSANTE et non mois calendaire.
 *
 * Un compteur du 1er au 31 remet tout à zéro le premier du mois : le 2 août tu
 * lis « 0 séance » alors que tu t'es entraîné quatre fois la semaine précédente.
 * Le chiffre ne dit alors plus rien de ton entraînement, seulement de la date.
 * Trente jours glissants répondent à la vraie question — qu'est-ce que j'ai fait
 * récemment ? — et ne dépendent pas du calendrier.
 */
export const FENETRE_STATS = 30

export function seancesRecentes(
  sessions: MuscuSession[],
  jours = FENETRE_STATS,
  now = Date.now(),
): MuscuSession[] {
  const debut = new Date(now)
  debut.setDate(debut.getDate() - jours + 1)
  const min = debut.toLocaleDateString('en-CA')
  const max = new Date(now).toLocaleDateString('en-CA')
  return sessions.filter((s) => s.date >= min && s.date <= max)
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
  'Fibulaires',
  'Coiffe des rotateurs',
  'Psoas-iliaque',
  'Tenseur du fascia lata',
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
const LIBRARY_SEED_KEY = 'muscu_library_v21'
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
    .select('id,date,name,duration_min,notes,template_id,created_at')
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
  const intensites: Intensites = await loadIntensites(userId).catch(() => ({}))
  return (sessions ?? []).map((s) => ({
    ...s,
    notes: s.notes ?? '',
    exercises: bySession.get(s.id) ?? [],
    intensite: intensites[s.id],
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

  // Les activités hors salle (natation, course, bois, extérieur) avaient leur
  // propre table, avec leurs propres groupes musculaires. C'était une SECONDE
  // source de vérité pour les mêmes vingt-huit exercices, et elle contredisait
  // la bibliothèque : là où celle-ci dit « Obliques:0.9, Grand dorsal:0.8… »
  // pour fendre du bois, la table disait « Full body », soit trente-six muscles
  // à 100 %. C'est de là que venait le libellé. Elle a été supprimée, ses
  // consignes de sécurité rapatriées dans la bibliothèque, et c'est
  // `ensureLibrary` ci-dessous qui ajoute ces exercices — au bon étiquetage.

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
