import { supabase } from './supabase'
import { fetchKv, saveKv } from './kv'
import { MUSCU_PROGRAM } from '../data/behourd'
import { EXERCISE_LIBRARY, EXERCISE_RENAMES, RECUPERATION_NAMES } from '../data/exercises'
import { partParDefaut, regionsForGroup, type MuscleRegion } from './muscles'
import type { Courbature } from './soreness'
import { PAS_HEURES, PAS_JOURS, SEUIL_PRET, VITESSE_MIN } from './recuperation'
// Ré-exportés : le pas de temps est une règle du barème, mais tout le module le
// lit depuis ici depuis toujours.
export { PAS_HEURES, PAS_JOURS }
import { loadIntensites, recupIntensite, type IntensiteId, type Intensites } from './intensite'
import { clefDouceur, loadDouceurs, type Douceurs } from './douceur'

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
  /**
   * Déclaré fait en VERSION DOUCE : à vide, en amplitude, sans forcer. La ligne
   * compte alors comme de la récupération et non comme du travail.
   *
   * Recollée depuis le KV au chargement, comme l'intensité de la séance : la
   * table des exercices n'a pas de colonne pour ça, et le reste du module n'a
   * pas à le savoir.
   */
  doux?: boolean
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
  /**
   * Déclarations de ressenti qui s'appliquent à cette charge, PAR MUSCLE.
   *
   * Portées et non appliquées : une charge est indexée par libellé de groupe, et
   * un libellé couvre jusqu'à trente-huit muscles. Les appliquer ici aurait
   * étendu une courbature déclarée au cou à tout ce qu'une marche du fermier
   * touche. C'est `reposParMuscle` qui les consomme, là où les muscles existent.
   *
   * Déjà filtrées : ce qui est périmé ou nul n'y figure pas.
   */
  courbatures?: Partial<Record<MuscleRegion, Courbature>>
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
 * Le plafond applicable à une charge.
 *
 * Il n'y a plus que celui-là : le « jamais prêt le jour même » a rejoint
 * `reposParMuscle`, où la vitesse de la zone est connue. Ici elle ne l'est pas —
 * une charge est indexée par LIBELLÉ de groupe, qui peut couvrir des muscles de
 * vitesses différentes —, et le plafond devait donc se caler sur la zone la plus
 * rapide du barème, ce qui le rendait trop bas pour toutes les autres.
 */
export function plafondRecup(days: number): number {
  return Math.max(days, PLAFOND_FRAICHEUR)
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

/**
 * Une séance de récupération active ne fatigue pas : elle raccourcit le délai.
 *
 * Deux façons d'en être une : l'exercice EST un étirement (la bibliothèque le
 * dit), ou bien c'est un exercice adaptable qu'on a déclaré fait en version
 * douce. Prend la ligne entière et non le nom, précisément pour voir la seconde.
 *
 * ⚠️ Mais un étirement CHARGÉ n'est plus un étirement. Un 90/90 hanches fait à
 * 45 kg comptait dans le tonnage de la séance — donc comme du travail — et ne
 * chargeait aucun muscle sur le mannequin — donc comme de la mobilité. Les deux
 * écrans se contredisaient sur la même ligne, et tout ce qu'on étiquetait sur
 * cet exercice restait invisible : on cochait un muscle, il ne se passait rien.
 *
 * La charge tranche, et c'est déjà le juge que le tonnage écoute. Ce qui reste
 * au poids du corps continue de rendre des jours.
 *
 * La coche « version douce » garde le dernier mot dans l'autre sens : une
 * déclaration explicite passe avant ce qu'on déduit d'un nombre.
 */
function estRecuperation(e: { name: string; doux?: boolean; weight_kg?: number | null }): boolean {
  if (e.doux === true) return true
  if (!RECUPERATION_NAMES.has(e.name.trim().toLowerCase())) return false
  return !(typeof e.weight_kg === 'number' && e.weight_kg > 0)
}

/**
 * Une séance de TRAVAIL : elle contient au moins une ligne qui fatigue.
 *
 * Une séance d'étirements, ou une séance dont toutes les lignes sont cochées
 * « version douce », n'en est pas une : elle n'occupe pas la journée et n'empêche
 * pas d'aller à la salle. Une ligne de ressenti, elle, en est une — c'est
 * exactement comme ça qu'un béhourd s'enregistre.
 */
export function estSeanceDeTravail(s: MuscuSession): boolean {
  return s.exercises.some((e) => !estRecuperation(e))
}

/** La séance de travail faite un jour donné, s'il y en a une. */
export function seanceDuJour(sessions: MuscuSession[], jour: string): MuscuSession | undefined {
  return sessions.find((s) => s.date === jour && estSeanceDeTravail(s))
}

/**
 * La charge de chaque groupe à un instant donné.
 *
 * `maintenant` est un paramètre et non `Date.now()` en dur pour qu'on puisse
 * poser la même question plus tard : « et dans 12 h, dans 2 jours ? ». Le calcul
 * est le même — seule l'horloge avance —, donc il n'y a rien à dupliquer pour
 * projeter, et une projection ne peut pas dériver du calcul réel.
 */
export function groupLoads(sessions: MuscuSession[], maintenant = Date.now()): Record<string, GroupLoad> {
  const now = maintenant
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
      if (!estRecuperation(e)) continue
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
      if (estRecuperation(e)) continue
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

/**
 * Les libellés proposés dans le sélecteur « Groupe visé ».
 *
 * Classés par ORDRE ALPHABÉTIQUE et non par famille : le sélecteur les affiche
 * en un seul nuage de pastilles, sans séparateur ni titre. Le classement par
 * familles n'existait donc que dans le code — à l'écran, il fallait balayer
 * cinquante-sept pastilles pour trouver « Soléaire ». Alphabétique, on sait où
 * regarder.
 *
 * On y trouve trois sortes de libellés, et c'est voulu :
 *   • des groupes courants (« Pectoraux », « Dos ») qui couvrent plusieurs
 *     muscles à la fois ;
 *   • des libellés PARAPLUIE (« Full body », « Jambes (global) ») pour les
 *     activités qui sollicitent un bloc entier — ils valent moins que 1 par
 *     défaut, cf. `partParDefaut` ;
 *   • des muscles précis, pour viser finement — le mannequin les distingue un
 *     par un.
 *
 * « Dentelé antérieur » manquait : c'était le SEUL des trente-huit muscles
 * qu'aucun libellé précis n'atteignait, joignable uniquement en cochant « Full
 * body » ou « Haut du corps ». Impossible, donc, d'étiqueter proprement une
 * pompe scapulaire.
 */
export const MUSCLE_GROUPS_DEFAULT = [
  'Abdos/Core',
  'Adducteurs',
  'Avant-bras',
  'Biceps',
  'Biceps fémoral',
  'Brachial',
  'Brachio-radial',
  'Bras',
  'Cardio',
  'Chevilles',
  'Coiffe des rotateurs',
  'Cou',
  'Deltoïde antérieur',
  'Deltoïde latéral',
  'Deltoïde postérieur',
  'Dentelé antérieur',
  'Dos',
  'Droit fémoral',
  'Épaules',
  'Érecteurs du rachis',
  'Extenseurs avant-bras',
  'Fessiers',
  'Fibulaires',
  'Fléchisseurs avant-bras',
  'Full body',
  'Gastrocnémiens',
  'Grand dorsal',
  'Grand droit',
  'Grand fessier',
  'Grand pectoral',
  'Grand rond',
  'Hanches',
  'Haut du corps (global)',
  'Ischios',
  'Ischios internes',
  'Jambes (global)',
  'Lombaires',
  'Mollets',
  'Moyen fessier',
  'Obliques',
  'Pectoral supérieur',
  'Pectoraux',
  'Psoas-iliaque',
  'Quadriceps',
  'Rhomboïdes',
  'Soléaire',
  'Tenseur du fascia lata',
  'Tibial antérieur',
  'Trapèze inférieur',
  'Trapèze moyen',
  'Trapèze supérieur',
  'Trapèzes',
  'Triceps',
  'Triceps latéral',
  'Triceps longue portion',
  'Vaste latéral',
  'Vaste médial',
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
const LIBRARY_SEED_KEY = 'muscu_library_v23'
const RECUP_TEMPLATES_KEY = 'muscu_recup_templates_v2'
const COMBAT_TEMPLATES_KEY = 'muscu_combat_templates_v1'
const PROTOCOLE_TEMPLATES_KEY = 'muscu_protocole_cameleon_v1'
const MISE_EN_FORME_KEY = 'muscu_mise_en_forme_aout_v1'

/**
 * Ordre alphabétique français : « Épaules » se range à sa place, pas après « Z ».
 *
 * Appliqué aussi à la liste ENREGISTRÉE et pas seulement au défaut : une liste
 * personnalisée est construite par ajouts successifs à la fin, donc son ordre
 * ne porte aucune intention — le trier ne détruit rien et range les groupes
 * ajoutés à la main au milieu des autres.
 */
export function trierGroupes(groupes: string[]): string[] {
  return [...groupes].sort((a, b) => a.localeCompare(b, 'fr'))
}

/**
 * Les libellés du défaut sont un PLANCHER, pas une valeur initiale.
 *
 * Ils étaient une valeur initiale, et c'est ce qui a rendu invisible l'ajout du
 * dentelé antérieur : la liste enregistrée dans la base avait été figée avant,
 * elle gagnait la main, et le nouveau libellé n'atteignait jamais l'écran. Le
 * corps ne change pas, lui — les trente-huit muscles existent, ils doivent tous
 * rester sélectionnables quoi qu'il y ait en base.
 *
 * Ce qui reste au choix de l'utilisateur, ce sont les libellés qu'il AJOUTE.
 * C'est ce que la clé enregistrée porte désormais : des ajouts, pas un
 * remplacement.
 */
export function fusionnerGroupes(enregistres: string[] | null | undefined): string[] {
  return trierGroupes([...new Set([...MUSCLE_GROUPS_DEFAULT, ...(enregistres ?? [])])])
}

export async function loadMuscleGroups(userId: string): Promise<string[]> {
  return fusionnerGroupes(await fetchKv<string[]>(userId, GROUPS_KEY, []))
}

/** Les libellés ajoutés à la main, ceux que l'utilisateur peut retirer. */
export function groupesPersos(groupes: string[]): string[] {
  const defaut = new Set(MUSCLE_GROUPS_DEFAULT)
  return groupes.filter((g) => !defaut.has(g))
}

export async function saveMuscleGroups(userId: string, groups: string[]): Promise<void> {
  await saveKv(userId, GROUPS_KEY, groups)
}

// ── Helpers internes ─────────────────────────────────────────────────────────

const EXO_COLS = 'id,name,muscle_group,sets,reps,weight_kg,notes,position'

/**
 * Le CATALOGUE fait foi pour les muscles travaillés, y compris rétroactivement.
 *
 * Chaque ligne de séance porte une copie du `muscle_group` de l'exercice, figée
 * au moment de l'enregistrement. C'était une photo, et elle ne bougeait plus :
 * corriger l'étiquetage d'un exercice — ajouter le dentelé à une pompe
 * scapulaire, retirer les jambes d'une marche du fermier — ne changeait rien
 * aux séances déjà faites. Le mannequin continuait donc d'afficher l'ancienne
 * erreur, et il fallait rouvrir chaque séance à la main pour la corriger.
 *
 * Un exercice, c'est un MOUVEMENT : les muscles qu'il travaille sont une
 * propriété du mouvement, pas de la journée où on l'a fait. Ils appartiennent
 * donc au catalogue, et la ligne de séance n'en garde qu'une trace de secours
 * pour ce que le catalogue ne connaît pas.
 *
 * Deux exceptions, et seulement deux :
 *
 *   • la ligne de RESSENTI, dont les zones sont déclarées séance par séance —
 *     c'est tout son objet, un béhourd ne tape pas au même endroit deux fois ;
 *   • un exercice absent du catalogue (renommé, supprimé, saisi à la volée) :
 *     on garde ce qui est écrit, faute de mieux.
 *
 * ⚠️ Contrepartie assumée : un réglage fait à la main sur UNE séance pour un
 * exercice du catalogue est repris par le catalogue au rechargement. Pour dire
 * « ce jour-là ça a tapé ailleurs », l'outil est la déclaration de ressenti sur
 * le mannequin, qui est datée et ne prétend pas décrire le mouvement.
 */
export function appliquerCatalogue(exos: MuscuExo[], catalog: CatalogExercise[]): MuscuExo[] {
  const parNom = new Map(catalog.map((c) => [c.name.trim().toLowerCase(), c.muscle_group]))
  return exos.map((e) => {
    if (estRessenti(e.name)) return e
    const groupes = parNom.get(e.name.trim().toLowerCase())
    if (groupes === undefined || groupes === e.muscle_group) return e
    return { ...e, muscle_group: groupes }
  })
}

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
    // Le NOM est le seul lien entre le catalogue et les séances déjà faites :
    // les lignes de séance ne portent pas de clé vers l'exercice, seulement son
    // libellé recopié. Renommer sans reporter le nom couperait donc ce lien, et
    // l'exercice renommé cesserait en silence de corriger l'historique — le
    // défaut d'origine reviendrait par une autre porte. On lit le nom d'avant
    // pour savoir s'il a bougé.
    const { data: avant } = await supabase
      .from('perso_muscu_exercises')
      .select('name')
      .eq('id', exo.id)
      .maybeSingle()
    const ancien = String(avant?.name ?? '').trim()
    const { error } = await supabase
      .from('perso_muscu_exercises')
      .update({ ...base, updated_at: new Date().toISOString() })
      .eq('id', exo.id)
    if (error) throw new Error(error.message)
    if (ancien && ancien !== base.name) await renommerPartout(userId, ancien, base.name)
  } else {
    const { error } = await supabase.from('perso_muscu_exercises').insert({ user_id: userId, ...base })
    if (error) throw new Error(error.message)
  }
}

/**
 * Reporte un renommage du catalogue sur tout ce qui le cite par son nom :
 * les séances déjà faites et les séances types.
 *
 * L'ancien nom est comparé tel quel — c'est celui que le catalogue portait, et
 * les lignes de séance ont été écrites depuis ce même catalogue. Ce qui aurait
 * été saisi à la main avec une autre orthographe n'est pas rattrapé : on ne
 * devine pas, sous peine de renommer l'exercice du voisin.
 */
async function renommerPartout(userId: string, ancien: string, nouveau: string): Promise<void> {
  for (const table of ['perso_muscu_session_exercises', 'perso_muscu_template_exercises'] as const) {
    const { error } = await supabase
      .from(table)
      .update({ name: nouveau })
      .eq('user_id', userId)
      .eq('name', ancien)
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
  // Même règle que pour les séances : une correction du catalogue doit se voir
  // dans les modèles aussi, sinon lancer une séance type réinjecterait l'ancien
  // étiquetage et le problème reviendrait par la porte de service.
  const catalog = await listCatalog(userId).catch(() => [] as CatalogExercise[])
  return (tpls ?? []).map((t) => ({
    ...t,
    notes: t.notes ?? '',
    exercises: appliquerCatalogue(byTpl.get(t.id) ?? [], catalog),
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
  const douceurs: Douceurs = await loadDouceurs(userId).catch(() => ({}))
  // Le catalogue est relu ICI, une fois, plutôt que dans chaque écran : c'est le
  // seul moyen que le mannequin, l'export, l'historique et les calories voient
  // tous le même étiquetage. Un catalogue illisible ne bloque pas le journal —
  // on retombe alors sur les groupes enregistrés.
  const catalog = await listCatalog(userId).catch(() => [] as CatalogExercise[])
  return (sessions ?? []).map((s) => ({
    ...s,
    notes: s.notes ?? '',
    exercises: appliquerCatalogue(bySession.get(s.id) ?? [], catalog).map((e) =>
      douceurs[clefDouceur(s.id as string, e.name)] ? { ...e, doux: true } : e,
    ),
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
  if (await ensureTemplates(userId, RECUP_TEMPLATES_KEY, RECUP_TEMPLATES)) didSeed = true
  if (await ensureTemplates(userId, COMBAT_TEMPLATES_KEY, COMBAT_TEMPLATES)) didSeed = true
  if (await ensureTemplates(userId, MISE_EN_FORME_KEY, MISE_EN_FORME_TEMPLATES)) didSeed = true
  if (await ensureTemplates(userId, PROTOCOLE_TEMPLATES_KEY, PROTOCOLE_TEMPLATES)) didSeed = true

  return didSeed
}

/**
 * Un exercice d'une séance type livrée avec l'application.
 *
 * Le nom seul suffit : format et groupes viennent de la bibliothèque, qui fait
 * foi. `sets` / `reps` ne sont là que pour les séances dont le format N'EST PAS
 * celui de la bibliothèque — une séance lourde tourne à 6 répétitions là où la
 * fiche en propose 15, et recopier la fiche aurait donné une séance légère
 * portant un nom de séance lourde.
 */
type LigneModele = string | { nom: string; sets?: number; reps?: string; notes?: string }

interface SeanceModele {
  name: string
  icon: string
  duration: number
  notes: string
  exos: LigneModele[]
}

/**
 * Deux séances types de récupération active, prêtes à lancer. Elles retirent un
 * jour de récupération aux zones qu'elles touchent : sans modèle sous la main,
 * personne ne pense à les enregistrer.
 */
export const RECUP_TEMPLATES: SeanceModele[] = [
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

/**
 * La ceinture abdominale, chargée, pour le combat.
 *
 * Ce n'est pas la séance « Core » du programme Basic Fit, qui est un jour de
 * récupération active à base de gainage au poids du corps. Celle-ci travaille
 * les quatre choses que le harnois demande au tronc, et rien d'autre :
 *
 *   • résister à l'extension sous charge — c'est ce que fait le dos quand
 *     35 kg d'acier tirent vers l'arrière (roulette, gainage lesté) ;
 *   • résister à la rotation et à l'inclinaison — encaisser un coup de côté
 *     sans se plier (Pallof, port valise) ;
 *   • produire de la rotation — la frappe part des obliques, pas du bras
 *     (bûcheron à la poulie) ;
 *   • fléchir la hanche sous charge — se relever, monter le genou en armure
 *     (chaise romaine, crunch à la poulie).
 *
 * Deux choix méritent d'être dits. La chaise romaine plutôt que le relevé de
 * jambes suspendu : suspendu, tout le poids du corps tire sur l'articulation
 * acromio-claviculaire, et l'épaule droite n'a pas à payer une séance d'abdos.
 * Et l'extension lombaire en dernier : les érecteurs sont l'arrière de la
 * ceinture, une ceinture qui ne tient que devant ne tient pas.
 */
export const COMBAT_TEMPLATES: SeanceModele[] = [
  {
    name: 'Ceinture abdominale lourde (combat)',
    icon: '🛡️',
    duration: 60,
    notes:
      'Charges lourdes, séries courtes : la ceinture se muscle comme le reste, pas à 30 répétitions. ' +
      '⚠️ En reprise, première séance à 60 % et 3 séries par exercice — un abdo tiré gêne absolument tout, ' +
      'y compris respirer sous le harnois. Souffler à l’effort, jamais bloquer en apnée.',
    exos: [
      { nom: 'Roulette abdominale', sets: 5, reps: '6', notes: 'La plus dure en premier. Lest sur le dos dès que 6 passent sans trembler. Dos jamais cambré — c’est exactement ce qu’on entraîne.' },
      { nom: 'Chaise romaine — relevés de jambes', sets: 4, reps: '8', notes: 'Haltère serré entre les pieds. Chaise romaine et non suspendu : avant-bras en appui, l’épaule AC n’est pas mise en traction.' },
      { nom: 'Crunch à la poulie haute (à genoux)', sets: 4, reps: '8', notes: 'Lourd. Enrouler le buste vertèbre par vertèbre, hanches immobiles — ce n’est pas un mouvement de hanche.' },
      { nom: 'Bûcheron à la poulie (haut vers bas)', sets: 4, reps: '8/côté', notes: 'Le geste de frappe. Pivoter sur le pied arrière, bras tendus : la rotation vient du tronc.' },
      { nom: 'Anti-rotation à la poulie (Pallof)', sets: 4, reps: '8/côté', notes: 'Tenir 3 s bras tendus à chaque répétition. Charge assez lourde pour que ça pousse vraiment de côté.' },
      { nom: 'Port valise (haltère à une main)', sets: 4, reps: '40 m/côté', notes: 'Le plus lourd que tu tiennes sans t’incliner. Épaules au même niveau — c’est le seul critère.' },
      { nom: 'Extension lombaire à la machine', sets: 3, reps: '10', notes: 'L’arrière de la ceinture. Charge modérée, amplitude complète, sans à-coup.' },
    ],
  },
]

/**
 * Le bloc de mise en forme d'août — à Basic Fit, et rien qu'avec ce qu'on y
 * trouve.
 *
 * Ce n'est pas un programme différent : ce sont les trois séances de salle du
 * microcycle de septembre, avec des substitutions imposées par le matériel.
 * Même découpage, mêmes patterns, mêmes priorités. Septembre ne change alors
 * que les OUTILS — traîneau à la place de la presse, sangle cervicale à la
 * place de l'élastique, ring pour la boxe —, jamais la logique. C'est la
 * différence entre une reprise et un démarrage à froid.
 *
 * Les trois substitutions, et ce qu'elles coûtent :
 *
 *   • traîneau → presse à cuisses. On perd la poussée horizontale, qui est le
 *     geste-roi du tank ; on garde la production de force en extension de
 *     hanche et de genou. C'est le meilleur report possible sans traîneau.
 *   • sangle cervicale → élastique et pont cervical. La charge plafonne vite,
 *     mais c'est justement ce qu'on veut en août : le protocole demande une
 *     montée en charge du cou TRÈS graduelle, et deux mois de travail léger
 *     sont exactement la bonne préparation avant de charger en septembre.
 *   • fat grips → serviette enroulée autour de la barre. Même effet, coût nul.
 *
 * Intensité soutenue, pas maximale : on installe le déficit et on rode les
 * mouvements. Le lourd commence en septembre.
 */
export const MISE_EN_FORME_TEMPLATES: SeanceModele[] = [
  {
    name: 'Août A — Push & épaules (Basic Fit)',
    icon: '🅰️',
    duration: 60,
    notes:
      'Mise en forme, intensité soutenue. Prépare le mardi de septembre : mêmes patterns, charges modérées. ' +
      'Le but est de roder les mouvements et d’installer le déficit, pas de chercher des records.',
    exos: [
      { nom: 'Développé couché', sets: 4, reps: '8', notes: 'Charge modérée, exécution propre. Scapulas serrées, pieds ancrés.' },
      { nom: 'Développé militaire barre', sets: 4, reps: '8', notes: 'Gainage abdominal, pas de cambrure lombaire. La barre guidée fait l’affaire si la cage est prise.' },
      { nom: 'Développé incliné à la machine', sets: 3, reps: '10', notes: 'Faisceau claviculaire — le coussin d’amorti sous les épaulières.' },
      { nom: 'Élévations latérales haltères', sets: 4, reps: '12', notes: 'Coude légèrement plié, descente lente. Du volume d’épaulière, pas de la force.' },
      { nom: 'Extensions triceps poulie haute (corde)', sets: 3, reps: '12', notes: 'Coudes collés au corps, descente contrôlée.' },
    ],
  },
  {
    name: 'Août B — Tirage, cou & préhension (Basic Fit)',
    icon: '🅱️',
    duration: 65,
    notes:
      'Prépare le mercredi de septembre, LA séance pivot. Le cou se travaille ici à l’élastique et au poids du ' +
      'corps : la charge plafonne, et c’est voulu — deux mois de travail léger sont la bonne rampe avant de ' +
      'charger à la sangle. La préhension se fait aux haltères, serviette enroulée sur la barre pour épaissir.',
    exos: [
      { nom: 'Tractions pronation', sets: 4, reps: '8', notes: 'Assistées à la machine si 8 ne passent pas propre. C’est le volume qui compte en août.' },
      { nom: 'Rowing prise large coudes hauts', sets: 4, reps: '10', notes: 'Buste à 45°, dos plat, tirage vers le nombril.' },
      { nom: 'Extensions cervicales (élastique)', sets: 3, reps: '15', notes: '⚠️ Très léger. Amplitude contrôlée, jamais d’à-coup. On installe l’habitude, on ne charge pas.' },
      { nom: 'Flexions latérales de nuque', sets: 3, reps: '12/côté', notes: 'Au poids de la tête seule. Les coups arrivent de côté en mêlée : le latéral compte autant que la flexion.' },
      { nom: 'Marche du fermier', sets: 4, reps: '30 m', notes: 'Haltères, les plus lourds que tu tiennes sans t’incliner. Épaules au même niveau.' },
      { nom: 'Curl haltères', sets: 3, reps: '12', notes: 'Serviette enroulée autour du manche : c’est la préhension qu’on cherche autant que le biceps.' },
    ],
  },
  {
    name: 'Août C — Jambes & ancrage (Basic Fit)',
    icon: '🅾️',
    duration: 65,
    notes:
      'Prépare le jeudi de septembre. Pas de traîneau à Basic Fit : la presse prend le relais pour la production ' +
      'de force, la poussée horizontale attendra la nouvelle salle. Anti-rotation plutôt que crunch — le tronc ' +
      'doit résister aux torsions, pas les créer.',
    exos: [
      { nom: 'Presse à cuisses (pieds standard)', sets: 4, reps: '10', notes: 'Substitut du traîneau : on garde la production de force, on perd l’horizontalité. Pas de verrouillage des genoux.' },
      { nom: 'Squat à la barre guidée', sets: 3, reps: '8', notes: 'Guidé plutôt que barre libre : les genoux sont déjà taxés par l’armure du samedi.' },
      { nom: 'Fentes marchées haltères', sets: 3, reps: '12/jambe', notes: 'Pas long, genou avant à 90°. C’est l’unilatéral qui tient la base sur terrain irrégulier.' },
      { nom: 'Soulevé de terre roumain (RDL)', sets: 3, reps: '10', notes: 'Modéré. Hanches en arrière, dos plat.' },
      { nom: 'Anti-rotation à la poulie (Pallof)', sets: 3, reps: '12/côté', notes: 'Tenir 3 s bras tendus. La résistance à la poussée adverse.' },
      { nom: 'Port valise (haltère à une main)', sets: 3, reps: '30 m/côté', notes: 'Anti-inclinaison + préhension. Épaules au même niveau, c’est le seul critère.' },
    ],
  },
]

/**
 * Le microcycle du protocole tank, six jours sur sept.
 *
 * Une séance par jour nommé, parce que c'est un PARCOURS et non un catalogue :
 * l'ordre des jours porte la logique de récupération. Le béhourd du samedi est
 * la séance que tout le reste sert ; le lundi est de la récupération active
 * après les chocs ; le lourd est placé le plus loin possible du samedi dans les
 * deux sens.
 *
 * Le dimanche n'a pas de modèle : le repos total n'est pas une séance, et lui
 * en donner une aurait invité à le remplir.
 *
 * Trois principes du protocole se lisent dans le contenu :
 *
 *   • on entraîne des PATTERNS de tank, pas des muscles isolés — pousser
 *     (traîneau, développé), tenir (préhension, portage), encaisser (cou,
 *     anti-rotation), rester bas (squat, mobilité) ;
 *   • le cou et la préhension sont la priorité n°1, et ils sont groupés le
 *     mercredi, au milieu de la semaine, le plus loin du samedi ;
 *   • l'anti-rotation prime sur le crunch : le tronc doit RÉSISTER aux torsions
 *     en mêlée, pas les produire.
 *
 * Le masque respiratoire n'est pas un exercice mais un modificateur : il vit
 * dans les notes, avec sa règle de sécurité. Jamais sur un effort maximal avec
 * verrouillage du tronc — restreindre le souffle pendant une manœuvre de
 * Valsalva dégrade la sécurité du rachis et l'expression de force.
 */
export const PROTOCOLE_TEMPLATES: SeanceModele[] = [
  {
    name: 'Lundi — Kickboxing (récup active)',
    icon: '🥊',
    duration: 60,
    notes:
      'Lendemain de béhourd : technique, déplacements, faible impact articulaire. On relance sans rien casser. ' +
      'Pas de masque, pas de puissance — si ça tape dur, ce n’est plus une récupération.',
    exos: [{ nom: 'Kickboxing — technique et déplacements', sets: 1, reps: '60 min', notes: 'Shadow, pattes d’ours, déplacements. Aucune puissance : on cherche l’amplitude et la fluidité, pas l’impact.' }],
  },
  {
    name: 'Mardi — Push / Force',
    icon: '💪',
    duration: 60,
    notes:
      'Force du haut du corps. Les ceintures scapulaires sont le coussin d’amorti sous le plastron. ' +
      '⚠️ Masque INTERDIT sur les deux premiers exercices : le verrouillage du tronc exige un souffle libre. ' +
      'Il ne sert qu’au finisher.',
    exos: [
      { nom: 'Développé couché', sets: 4, reps: '5', notes: 'Lourd. Repos 2 à 3 min. Scapulas serrées, pieds ancrés. Sans masque.' },
      { nom: 'Développé militaire barre', sets: 4, reps: '5', notes: 'Lourd. Repos 2 à 3 min. Gainage abdominal, pas de cambrure lombaire. Sans masque.' },
      { nom: 'Dips aux barres parallèles', sets: 3, reps: '8', notes: 'Lestés dès que 8 passent propre. Penché en avant pour les pectoraux.' },
      { nom: 'Élévations latérales haltères', sets: 4, reps: '12', notes: 'Coude légèrement plié, descente lente. C’est du volume d’épaulière, pas de la force.' },
      { nom: 'Corde à sauter', sets: 1, reps: '5 min', notes: '👺 Finisher masque : résistance basse, 5 min. Retirer au moindre picotement ou vertige.' },
    ],
  },
  {
    name: 'Mercredi — Pull / Grip / Cou',
    icon: '🦾',
    duration: 65,
    notes:
      'LA séance pivot du tank. Le heaume transmet chaque impact à la colonne cervicale : un cou fort réduit ' +
      'l’accélération de la tête, donc le risque de sonnage. Et sans préhension, la force du bras est ' +
      'inexploitable — c’est elle qui tient le bouclier et la hallebarde jusqu’au bout du round.',
    exos: [
      { nom: 'Tractions pronation', sets: 4, reps: '6', notes: 'Lestées si 6 passent propre, assistées sinon. Repos 2 à 3 min.' },
      { nom: 'Rowing prise large coudes hauts', sets: 4, reps: '8', notes: 'Buste à 45°, dos plat, tirage vers le nombril.' },
      { nom: 'Sangle cervicale (neck harness) — flexion/extension', sets: 3, reps: '12', notes: '⚠️ Progression par très petites marches. Jamais à l’échec, jamais en à-coup. Sans charge les deux premières semaines.' },
      { nom: 'Flexions latérales de nuque', sets: 3, reps: '12/côté', notes: 'Amplitude contrôlée. Le latéral compte autant que la flexion : en mêlée les coups arrivent de côté.' },
      { nom: 'Marche du fermier', sets: 4, reps: '40 m', notes: 'Le plus lourd que tu tiennes sans t’incliner. Épaules au même niveau.' },
      { nom: 'Curl haltères', sets: 3, reps: '12', notes: 'Fat grips ou serviette enroulée autour de la barre : c’est la préhension qu’on cherche autant que le biceps.' },
    ],
  },
  {
    name: 'Jeudi — Legs / Ancrage',
    icon: '🦵',
    duration: 75,
    notes:
      'Base de puissance. La poussée horizontale au traîneau est le geste-roi du tank en mêlée — c’est ' +
      'exactement le transfert de force du sol vers l’adversaire. Anti-rotation plutôt que crunch : le tronc ' +
      'doit résister aux torsions, pas les créer.',
    exos: [
      { nom: 'Squat à la machine (hack squat)', sets: 4, reps: '6', notes: 'Guidé : moins de charge sur le rachis que la barre libre, et les genoux sont déjà taxés par l’armure du samedi.' },
      { nom: 'Traîneau poussé', sets: 6, reps: '20 m', notes: 'LOURD, buste bas. Le geste de mêlée. Repos complet entre les allers.' },
      { nom: 'Fentes marchées haltères', sets: 3, reps: '12/jambe', notes: 'Pas long, genou avant à 90°. Unilatéral : c’est ce qui tient la base sur terrain irrégulier.' },
      { nom: 'Soulevé de terre roumain (RDL)', sets: 3, reps: '10', notes: 'MODÉRÉ — la chaîne postérieure travaille déjà au béhourd. Hanches en arrière, dos plat.' },
      { nom: 'Anti-rotation à la poulie (Pallof)', sets: 3, reps: '10/côté', notes: 'Tenir 3 s bras tendus. C’est la résistance à la poussée adverse qu’on entraîne.' },
      { nom: 'Port valise (haltère à une main)', sets: 3, reps: '40 m/côté', notes: 'Anti-inclinaison + préhension. Épaules au même niveau, c’est le seul critère.' },
    ],
  },
  {
    name: 'Vendredi — Cardioboxing (masque)',
    icon: '😤',
    duration: 45,
    notes:
      '👺 Le vrai transfert respiratoire. Le masque n’est PAS un simulateur d’altitude : il ne change rien à ' +
      'l’oxygène du sang. Il muscle le diaphragme et habitue au CO₂ — c’est-à-dire exactement à l’air confiné ' +
      'et chaud sous heaume fermé. ' +
      '🩺 Retirer immédiatement en cas de vertige, de picotements aux doigts ou aux lèvres, de céphalée qui ' +
      's’installe, ou dès que la technique se dégrade. La technique prime toujours.',
    exos: [{ nom: 'Cardioboxing — intervalles', sets: 8, reps: '2 min', notes: 'Rounds de 2 min, 1 min de récup. Masque en résistance moyenne.' }],
  },
  {
    name: 'Samedi — Béhourd en armure',
    icon: '⚔️',
    duration: 120,
    notes:
      'LA séance. Tout le reste de la semaine la sert. 35 kg d’acier + gambison : la perte hydrique et sodée ' +
      'est massive et la thermorégulation est entravée. Boire avant d’avoir soif, saler l’eau (1,5 L + une ' +
      'pincée de fleur de sel + citron), et traiter crampes ou vertiges comme des signaux, pas comme du ' +
      'caractère. Échauffement RAMP et activation du cou AVANT de coiffer le heaume.',
    exos: [
      { nom: 'Béhourd — port du harnois (endurance armure)', sets: 1, reps: '30 min', notes: 'Montée en température sous armure avant le contact.' },
      { nom: 'Béhourd — sparring en armure', sets: 1, reps: '90 min', notes: 'Combat réel. Protéines + glucides rapides dans l’heure qui suit.' },
    ],
  },
]

/**
 * Sème des séances types livrées avec l'application, une fois.
 *
 * Une seule définition pour la récup et le combat : la version précédente ne
 * savait semer que les séances de récup, et ajouter la séance de combat
 * demandait de recopier la boucle — donc d'avoir deux endroits où corriger le
 * jour où le format d'une ligne change. Une séance déjà présente sous le même
 * nom n'est jamais réécrite : elle a pu être modifiée à la main.
 */
async function ensureTemplates(userId: string, cle: string, modeles: SeanceModele[]): Promise<boolean> {
  const done = await fetchKv<boolean>(userId, cle, false)
  if (done) return false

  const existants = new Set((await listTemplates(userId)).map((t) => t.name.trim().toLowerCase()))
  const lib = new Map(EXERCISE_LIBRARY.map((e) => [e.name, e]))
  for (const tpl of modeles) {
    if (existants.has(tpl.name.trim().toLowerCase())) continue
    await saveTemplate(
      userId,
      { name: tpl.name, icon: tpl.icon, duration_min: tpl.duration, notes: tpl.notes },
      tpl.exos.map((ligne) => {
        const l = typeof ligne === 'string' ? { nom: ligne } : ligne
        const e = lib.get(l.nom)
        return {
          name: l.nom,
          // Les groupes viennent TOUJOURS de la bibliothèque, jamais du modèle :
          // c'est elle qui porte les coefficients par muscle, et une séance qui
          // les redéclarerait ferait mentir le mannequin sur sa propre séance.
          muscle_group: e?.groups ?? '',
          sets: l.sets ?? e?.sets ?? 1,
          reps: l.reps ?? e?.reps ?? '15 min',
          weight_kg: null,
          notes: l.notes ?? '',
        }
      }),
    )
  }
  await saveKv(userId, cle, true)
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
