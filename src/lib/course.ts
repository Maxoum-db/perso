import { supabase } from './supabase'
import { EXERCISE_LIBRARY } from '../data/exercises'
import type { MuscuSession } from './muscu'
import type { IntensiteId } from './intensite'

// La course à pied : saisie des sorties, et ce qu'on peut en lire.
//
// Une sortie n'est pas une séance de musculation. Elle n'a ni série ni charge :
// elle a une distance, un temps, un dénivelé et une allure. Les faire entrer
// dans le moule de la musculation obligerait à inventer un « exercice » par
// sortie et à ranger l'allure dans les notes — c'est-à-dire à renoncer à toute
// analyse. D'où une table et un module à part.
//
// Tout ce qui est calculé ici est une ESTIMATION à partir de ce qu'on a saisi,
// et chaque formule dit d'où elle vient. Une estimation dont on ignore
// l'origine est une opinion déguisée en mesure.

export type TypeSortie =
  | 'endurance'
  | 'recuperation'
  | 'seuil'
  | 'fractionne'
  | 'cotes'
  | 'longue'
  | 'course'
  | 'trail'

export const TYPES_SORTIE: Array<{ id: TypeSortie; label: string; icone: string; couleur: string; aide: string }> = [
  { id: 'recuperation', label: 'Récupération', icone: '🌿', couleur: '#22c55e', aide: 'Très facile, on peut parler en phrases entières. Ça accélère le retour, ça ne construit rien.' },
  { id: 'endurance', label: 'Endurance', icone: '🏃', couleur: '#3b82f6', aide: 'Le pain quotidien : allure de conversation, 60 à 75 % de la FC max. C’est le volume qui fait le coureur.' },
  { id: 'longue', label: 'Sortie longue', icone: '🛣️', couleur: '#8b5cf6', aide: 'La plus longue de la semaine, à allure d’endurance. Elle construit l’endurance fondamentale et la solidité tendineuse.' },
  { id: 'seuil', label: 'Seuil', icone: '🔥', couleur: '#f59e0b', aide: 'Allure « confortablement dure », tenable ~1 h en course. Le levier le plus rentable pour progresser sur 10 km et plus.' },
  { id: 'fractionne', label: 'Fractionné', icone: '⚡', couleur: '#ef4444', aide: 'Répétitions courtes et rapides avec récupération. C’est là que se travaille la VMA.' },
  { id: 'cotes', label: 'Côtes', icone: '⛰️', couleur: '#d97706', aide: 'Du fractionné qui muscle : même sollicitation cardiaque avec beaucoup moins d’impact au sol.' },
  { id: 'course', label: 'Compétition', icone: '🏅', couleur: '#eab308', aide: 'Dossard. C’est la sortie qui donne la meilleure estimation de la forme du moment.' },
  { id: 'trail', label: 'Trail', icone: '🌲', couleur: '#10b981', aide: 'Terrain et dénivelé : l’allure ne veut plus rien dire seule, c’est l’allure corrigée qu’il faut lire.' },
]

export interface Fraction {
  /** Nombre de répétitions. */
  nb: number
  /** Distance d'une répétition, en mètres (0 si la fraction est décrite en temps). */
  distance_m: number
  /** Durée d'une répétition, en secondes (0 si elle est décrite en distance). */
  duree_s: number
  /** Récupération entre deux répétitions, en secondes. */
  recup_s: number
}

export interface Sortie {
  id: string
  date: string
  heure: string | null
  type: TypeSortie
  distance_km: number
  duree_s: number
  denivele_pos_m: number | null
  denivele_neg_m: number | null
  fc_moy: number | null
  fc_max: number | null
  cadence_spm: number | null
  /** Effort perçu, échelle de Borg CR10 (1 = rien, 10 = maximal). */
  rpe: number | null
  surface: string | null
  meteo: string | null
  temperature_c: number | null
  chaussures: string | null
  /** Temps de chaque kilomètre, en secondes. */
  splits_s: number[]
  fractions: Fraction[]
  ressenti: string | null
  notes: string
}

const COLONNES =
  'id, date, heure, type, distance_km, duree_s, denivele_pos_m, denivele_neg_m, fc_moy, fc_max, ' +
  'cadence_spm, rpe, surface, meteo, temperature_c, chaussures, splits_s, fractions, ressenti, notes'

function versSortie(r: Record<string, unknown>): Sortie {
  return {
    id: String(r.id),
    date: String(r.date),
    heure: (r.heure as string) ?? null,
    type: (r.type as TypeSortie) ?? 'endurance',
    distance_km: Number(r.distance_km) || 0,
    duree_s: Number(r.duree_s) || 0,
    denivele_pos_m: r.denivele_pos_m === null ? null : Number(r.denivele_pos_m),
    denivele_neg_m: r.denivele_neg_m === null ? null : Number(r.denivele_neg_m),
    fc_moy: r.fc_moy === null ? null : Number(r.fc_moy),
    fc_max: r.fc_max === null ? null : Number(r.fc_max),
    cadence_spm: r.cadence_spm === null ? null : Number(r.cadence_spm),
    rpe: r.rpe === null ? null : Number(r.rpe),
    surface: (r.surface as string) ?? null,
    meteo: (r.meteo as string) ?? null,
    temperature_c: r.temperature_c === null ? null : Number(r.temperature_c),
    chaussures: (r.chaussures as string) ?? null,
    splits_s: Array.isArray(r.splits_s) ? (r.splits_s as number[]).map(Number) : [],
    fractions: Array.isArray(r.fractions) ? (r.fractions as Fraction[]) : [],
    ressenti: (r.ressenti as string) ?? null,
    notes: String(r.notes ?? ''),
  }
}

export async function listSorties(userId: string): Promise<Sortie[]> {
  const { data, error } = await supabase
    .from('perso_course_sessions')
    .select(COLONNES)
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(versSortie)
}

export async function saveSortie(userId: string, s: Omit<Sortie, 'id'> & { id?: string }): Promise<void> {
  const ligne = {
    user_id: userId,
    date: s.date,
    heure: s.heure || null,
    type: s.type,
    distance_km: s.distance_km,
    duree_s: s.duree_s,
    denivele_pos_m: s.denivele_pos_m,
    denivele_neg_m: s.denivele_neg_m,
    fc_moy: s.fc_moy,
    fc_max: s.fc_max,
    cadence_spm: s.cadence_spm,
    rpe: s.rpe,
    surface: s.surface || null,
    meteo: s.meteo || null,
    temperature_c: s.temperature_c,
    chaussures: s.chaussures || null,
    splits_s: s.splits_s,
    fractions: s.fractions,
    ressenti: s.ressenti || null,
    notes: s.notes,
    updated_at: new Date().toISOString(),
  }
  const { error } = s.id
    ? await supabase.from('perso_course_sessions').update(ligne).eq('id', s.id)
    : await supabase.from('perso_course_sessions').insert(ligne)
  if (error) throw new Error(error.message)
}

export async function deleteSortie(id: string): Promise<void> {
  const { error } = await supabase.from('perso_course_sessions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Lecture d'un temps et d'une allure ──────────────────────────────────────

/** « 52:30 » ou « 1:05:12 » selon la durée. Jamais « 3912 s ». */
export function formatDuree(s: number): string {
  const t = Math.max(0, Math.round(s))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = t % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

/** Une allure s'écrit toujours mm:ss — « 5:24/km », jamais « 5,4 min/km ». */
export function formatAllure(sParKm: number): string {
  if (!isFinite(sParKm) || sParKm <= 0) return '—'
  const m = Math.floor(sParKm / 60)
  return `${m}:${String(Math.round(sParKm % 60)).padStart(2, '0')}/km`
}

/** Secondes par kilomètre. C'est l'unité dans laquelle un coureur pense. */
export function allure(s: Sortie): number {
  return s.distance_km > 0 ? s.duree_s / s.distance_km : 0
}

export function vitesseKmh(s: Sortie): number {
  return s.duree_s > 0 ? (s.distance_km / s.duree_s) * 3600 : 0
}

/**
 * Coût énergétique de la course en pente, d'après Minetti et coll. (2002),
 * en J·kg⁻¹·m⁻¹. `i` est la pente en tant que rapport (0,10 = 10 %).
 *
 * Le polynôme est donné pour −0,45 ≤ i ≤ 0,45 ; au-delà il diverge, on borne.
 * À plat il vaut 3,6 : c'est la référence par rapport à laquelle on corrige.
 */
export function coutPente(i: number): number {
  const x = Math.max(-0.45, Math.min(0.45, i))
  return 155.4 * x ** 5 - 30.4 * x ** 4 - 43.3 * x ** 3 + 46.3 * x ** 2 + 19.5 * x + 3.6
}

export const COUT_PLAT = 3.6

/**
 * Allure corrigée du dénivelé — l'allure qu'aurait valu le même effort à plat.
 *
 * Sans elle, 8 km à 6:30/km avec 400 m de D+ passent pour une mauvaise séance
 * alors que c'est peut-être la meilleure du mois. Avec elle, deux sorties sur
 * des terrains différents deviennent comparables, ce qui est tout l'intérêt
 * d'un journal.
 *
 * ⚠️ C'est une APPROXIMATION, et il faut savoir laquelle : on ne sait pas
 * comment le dénivelé se répartit sur le parcours, seulement son total. On
 * suppose donc la montée étalée sur la moitié de la distance et la descente sur
 * l'autre. Sur une boucle vallonnée régulière c'est proche du vrai ; sur une
 * sortie qui monte 10 km puis redescend 10 km, ça l'est exactement ; sur un
 * seul mur de 200 m suivi de 15 km de plat, ça sous-estime.
 */
export function allureCorrigee(s: Sortie): number {
  const a = allure(s)
  const dPlus = s.denivele_pos_m ?? 0
  const dMoins = s.denivele_neg_m ?? 0
  if (a <= 0 || (dPlus === 0 && dMoins === 0)) return a
  const demiM = (s.distance_km * 1000) / 2
  if (demiM <= 0) return a
  const equivalent =
    0.5 * (coutPente(dPlus / demiM) / COUT_PLAT) + 0.5 * (coutPente(-dMoins / demiM) / COUT_PLAT)
  return a / Math.max(0.2, equivalent)
}

/** Distance à plat de même coût énergétique, en km. */
export function distanceEquivalente(s: Sortie): number {
  const a = allure(s)
  return a > 0 ? (s.duree_s / allureCorrigee(s)) : s.distance_km
}

// ── Forme du moment ─────────────────────────────────────────────────────────

/**
 * VDOT de Daniels & Gilbert : la « cylindrée » que suppose une performance.
 *
 * Deux formules, l'une pour la consommation d'oxygène à une vitesse donnée,
 * l'autre pour la fraction de VO2max qu'on peut tenir pendant un temps donné.
 * Leur rapport donne le VO2max qu'il faut avoir pour signer cette course-là.
 *
 * Elle suppose un effort SOUTENU. Un footing tranquille rend un VDOT bas, ce
 * qui est correct : il ne dit rien de la cylindrée. C'est pourquoi on ne lit
 * jamais un VDOT isolé mais le MEILLEUR d'une fenêtre — c'est l'usage prévu.
 */
export function vdot(distanceKm: number, dureeS: number): number {
  const t = dureeS / 60
  const v = (distanceKm * 1000) / t
  if (t < 3 || t > 240 || v <= 0) return 0
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v
  const part = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t)
  return vo2 / part
}

/**
 * VMA estimée, en km/h : la vitesse à laquelle VO2max est atteint.
 *
 * Le rapport classique (Léger) veut qu'une VMA en km/h coûte environ
 * 3,5 ml·kg⁻¹·min⁻¹ de VO2 par km/h. On divise donc le VDOT par 3,5.
 */
export function vma(vdotValeur: number): number {
  return vdotValeur > 0 ? vdotValeur / 3.5 : 0
}

/** Le meilleur VDOT d'une fenêtre : la forme telle qu'elle s'est vue. */
export function vdotRecent(sorties: Sortie[], jours = 42, fin = Date.now()): number {
  const limite = new Date(fin - jours * 86400000).toLocaleDateString('en-CA')
  return sorties
    .filter((s) => s.date >= limite && s.distance_km >= 1.5)
    .reduce((m, s) => Math.max(m, vdot(distanceEquivalente(s), s.duree_s)), 0)
}

/**
 * Facteur d'efficacité : mètres parcourus par minute et par battement.
 *
 * Deux sorties à la même allure, celle où le cœur bat moins vite est la
 * meilleure. C'est le signe de progrès le plus lisible en endurance, et le seul
 * qui ne demande pas de courir vite pour se mesurer. Il faut une ceinture ou
 * une montre au poignet : sans FC moyenne, il ne rend rien.
 */
export function efficacite(s: Sortie): number | null {
  if (!s.fc_moy || s.fc_moy <= 0 || s.duree_s <= 0) return null
  const metresParMinute = (distanceEquivalente(s) * 1000) / (s.duree_s / 60)
  return metresParMinute / s.fc_moy
}

// ── Records ─────────────────────────────────────────────────────────────────

export const DISTANCES_REPERES = [
  { km: 1, label: '1 km' },
  { km: 5, label: '5 km' },
  { km: 10, label: '10 km' },
  { km: 21.0975, label: 'Semi' },
  { km: 42.195, label: 'Marathon' },
]

export interface Chrono {
  km: number
  label: string
  duree_s: number
  date: string
  /** Vrai quand le temps vient d'une fenêtre de kilomètres et non de la sortie entière. */
  extrait: boolean
}

/**
 * Meilleur temps sur une distance, tiré de deux sources.
 *
 * 1. Les SPLITS, quand ils sont là : la meilleure fenêtre de N kilomètres
 *    consécutifs. C'est ce qui permet de trouver un record de 5 km à
 *    l'intérieur d'un 10 km — le vrai record est souvent là, pas sur la ligne
 *    d'arrivée d'une sortie entière.
 * 2. La sortie entière, si sa distance tombe à 3 % près sur la distance visée.
 *    Au-delà, extrapoler serait inventer.
 */
export function meilleurTemps(sorties: Sortie[], km: number, label: string): Chrono | null {
  let best: Chrono | null = null
  const garder = (r: Chrono) => {
    if (!best || r.duree_s < best.duree_s) best = r
  }
  const entier = Math.round(km)
  for (const s of sorties) {
    if (s.splits_s.length >= entier && entier >= 1) {
      let somme = s.splits_s.slice(0, entier).reduce((a, b) => a + b, 0)
      let min = somme
      for (let i = entier; i < s.splits_s.length; i++) {
        somme += s.splits_s[i] - s.splits_s[i - entier]
        if (somme < min) min = somme
      }
      // Les splits couvrent des kilomètres entiers : sur le semi ou le
      // marathon, on complète au prorata de la fraction restante.
      if (min > 0) garder({ km, label, duree_s: (min * km) / entier, date: s.date, extrait: true })
    }
    if (s.distance_km > 0 && Math.abs(s.distance_km - km) / km <= 0.03) {
      garder({ km, label, duree_s: (s.duree_s * km) / s.distance_km, date: s.date, extrait: false })
    }
  }
  return best
}

export function records(sorties: Sortie[]): Chrono[] {
  return DISTANCES_REPERES.map((d) => meilleurTemps(sorties, d.km, d.label)).filter(
    (r): r is Chrono => r !== null,
  )
}

// ── Volume et charge ────────────────────────────────────────────────────────

export interface Semaine {
  /** Lundi de la semaine, au format YYYY-MM-DD. */
  debut: string
  km: number
  duree_s: number
  denivele_m: number
  sorties: number
  charge: number
}

/** Lundi de la semaine contenant `d`. */
export function lundi(d: string): string {
  const t = new Date(d + 'T12:00:00')
  const jour = (t.getDay() + 6) % 7
  t.setDate(t.getDate() - jour)
  return t.toLocaleDateString('en-CA')
}

/**
 * Charge d'une sortie, méthode « session-RPE » de Foster : durée en minutes
 * multipliée par l'effort perçu. Une unité arbitraire, mais la même d'une
 * semaine à l'autre — c'est tout ce qu'on lui demande.
 *
 * Sans RPE saisi, on retombe sur l'effort typique du type de sortie plutôt que
 * de compter zéro : une sortie longue sans note n'est pas une sortie sans
 * effort.
 */
const RPE_PAR_DEFAUT: Record<TypeSortie, number> = {
  recuperation: 2,
  endurance: 4,
  longue: 5,
  seuil: 7,
  fractionne: 8,
  cotes: 8,
  course: 9,
  trail: 7,
}

export function chargeSortie(s: Sortie): number {
  return (s.duree_s / 60) * (s.rpe ?? RPE_PAR_DEFAUT[s.type] ?? 5)
}

export function semaines(sorties: Sortie[], combien = 12, fin = Date.now()): Semaine[] {
  const par = new Map<string, Semaine>()
  const debutFenetre = new Date(fin)
  debutFenetre.setDate(debutFenetre.getDate() - (combien - 1) * 7)
  const premier = lundi(debutFenetre.toLocaleDateString('en-CA'))

  for (let i = 0; i < combien; i++) {
    const d = new Date(premier + 'T12:00:00')
    d.setDate(d.getDate() + i * 7)
    const cle = d.toLocaleDateString('en-CA')
    par.set(cle, { debut: cle, km: 0, duree_s: 0, denivele_m: 0, sorties: 0, charge: 0 })
  }
  for (const s of sorties) {
    const cle = lundi(s.date)
    const sem = par.get(cle)
    if (!sem) continue
    sem.km += s.distance_km
    sem.duree_s += s.duree_s
    sem.denivele_m += s.denivele_pos_m ?? 0
    sem.sorties += 1
    sem.charge += chargeSortie(s)
  }
  return [...par.values()]
}

export type VerdictCharge = 'repos' | 'sous-charge' | 'optimal' | 'attention' | 'risque'

export const VERDICTS_COURSE: Record<VerdictCharge, { label: string; couleur: string; conseil: string }> = {
  repos: { label: 'Au repos', couleur: '#64748b', conseil: 'Rien de notable cette semaine. Reprends doucement.' },
  'sous-charge': { label: 'Sous-charge', couleur: '#3b82f6', conseil: 'Tu cours moins que d’habitude : de la marge pour ajouter du volume.' },
  optimal: { label: 'Optimal', couleur: '#22c55e', conseil: 'La charge de la semaine est dans la continuité des quatre dernières. C’est la zone où on progresse sans se casser.' },
  attention: { label: 'Attention', couleur: '#f59e0b', conseil: 'Progression rapide. Tiens ce palier une semaine avant de remonter.' },
  risque: { label: 'Risque', couleur: '#ef4444', conseil: 'Bond trop brutal par rapport aux quatre semaines précédentes — c’est le profil classique de la blessure de surcharge. Coupe le volume.' },
}

/**
 * Rapport charge aiguë / charge chronique : la semaine écoulée comparée à la
 * moyenne des quatre dernières.
 *
 * La règle de progression la plus ancienne de la course à pied dit « pas plus
 * de 10 % de volume en plus par semaine ». Ce rapport en est la version qui
 * tient compte de l'intensité et pas seulement des kilomètres, et il vaut
 * surtout par son extrémité haute : c'est un bond soudain qui blesse, pas un
 * volume élevé installé depuis des mois.
 */
export function rapportCharge(sorties: Sortie[], fin = Date.now()): { ratio: number; aigue: number; chronique: number; verdict: VerdictCharge } {
  const depuis = (jours: number) => {
    const limite = new Date(fin - jours * 86400000).toLocaleDateString('en-CA')
    const jusqu = new Date(fin).toLocaleDateString('en-CA')
    return sorties.filter((s) => s.date > limite && s.date <= jusqu).reduce((n, s) => n + chargeSortie(s), 0)
  }
  const aigue = depuis(7)
  const chronique = depuis(28) / 4
  if (aigue === 0 && chronique === 0) return { ratio: 0, aigue, chronique, verdict: 'repos' }
  const ratio = chronique > 0 ? aigue / chronique : 2
  const verdict: VerdictCharge =
    aigue === 0 ? 'repos' : ratio < 0.8 ? 'sous-charge' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'attention' : 'risque'
  return { ratio, aigue, chronique, verdict }
}

// ── Saisie ──────────────────────────────────────────────────────────────────

/**
 * Lit une durée écrite comme on la lit sur une montre : « 52:30 », « 1:05:12 »,
 * « 47 » (minutes), « 47min », « 1h05 ». Rend des secondes.
 *
 * Exiger un format unique ferait perdre une saisie sur deux : personne ne note
 * son temps de la même façon selon qu'il fait 40 minutes ou 4 heures.
 */
export function lireDuree(txt: string): number {
  const t = txt.trim().toLowerCase().replace(/\s+/g, '')
  if (!t) return 0
  const hms = t.match(/^(\d+)h(\d*)m?(\d*)s?$/)
  if (hms) return +hms[1] * 3600 + (+hms[2] || 0) * 60 + (+hms[3] || 0)
  const parts = t.split(':').map((p) => Number(p.replace(/[^\d.]/g, '')) || 0)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  const min = t.match(/^([\d.]+)(min|m)?$/)
  if (min) return Math.round(Number(min[1]) * 60)
  return 0
}

/**
 * Lit une liste de temps au kilomètre, séparés par des espaces, virgules ou
 * retours à la ligne : « 5:12 5:08 5:20 ». C'est ce qu'on recopie d'une montre.
 */
export function lireSplits(txt: string): number[] {
  return txt
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(lireDuree)
    .filter((v) => v > 0)
}


// ── Ce qu'une sortie fait au mannequin ──────────────────────────────────────
//
// Courir travaille des muscles, et le mannequin doit le savoir : sans ça, une
// coureuse voit ses jambes vertes le lendemain d'un fractionné, et le
// générateur lui propose des squats.
//
// On ne recalcule RIEN. Chaque sortie est convertie en une séance de
// musculation d'une seule ligne, dont l'étiquetage vient de la bibliothèque —
// la même qui sert à tout le reste. Le moteur de récupération, les courbatures,
// le sommeil, l'intensité : tout s'applique ensuite sans qu'on y touche. Une
// seconde façon de calculer la charge serait une seconde vérité, et deux
// vérités finissent toujours par se contredire.

/**
 * L'exercice de la bibliothèque qui décrit le mieux chaque type de sortie.
 *
 * Le seuil n'a pas son entrée : il sollicite les mêmes muscles que l'endurance,
 * plus fort. C'est l'INTENSITÉ qui porte la différence, pas l'étiquetage — et
 * c'est déjà ce que fait le modèle pour une séance de force menée à fond.
 */
const EXERCICE_PAR_TYPE: Record<TypeSortie, string> = {
  recuperation: 'Course à pied — endurance (zone 2)',
  endurance: 'Course à pied — endurance (zone 2)',
  longue: 'Course à pied — endurance (zone 2)',
  seuil: 'Course à pied — endurance (zone 2)',
  course: 'Course à pied — endurance (zone 2)',
  fractionne: 'Fractionné 30/30',
  cotes: 'Sprints en côte',
  trail: 'Course en sentier',
}

/** À défaut d'effort perçu saisi, ce que le type de sortie vaut d'ordinaire. */
const INTENSITE_PAR_TYPE: Record<TypeSortie, IntensiteId> = {
  recuperation: 'tranquille',
  endurance: 'normal',
  longue: 'normal',
  seuil: 'soutenu',
  trail: 'soutenu',
  fractionne: 'fond',
  cotes: 'fond',
  course: 'fond',
}

/**
 * L'effort perçu décide, le type de sortie ne fait que suppléer.
 *
 * Une sortie longue menée à 9/10 n'est pas « normale » parce qu'elle s'appelle
 * « longue », et un fractionné avorté à 4/10 n'est pas « à fond ». Ce qui a été
 * ressenti l'emporte toujours sur ce qui était prévu.
 */
export function intensiteSortie(s: Sortie): IntensiteId {
  if (s.rpe === null) return INTENSITE_PAR_TYPE[s.type]
  return s.rpe <= 3 ? 'tranquille' : s.rpe <= 6 ? 'normal' : s.rpe <= 8 ? 'soutenu' : 'fond'
}

/**
 * Une sortie, vue comme une séance — pour le mannequin et lui seul.
 *
 * L'identifiant est préfixé : ces séances ne doivent jamais être confondues
 * avec celles du journal, ni modifiables, ni comptées deux fois au tonnage.
 * Elles n'existent que le temps d'un calcul de récupération.
 */
export function sortieEnSeance(s: Sortie): MuscuSession {
  const ref = EXERCISE_LIBRARY.find((e) => e.name === EXERCICE_PAR_TYPE[s.type])
  const type = TYPES_SORTIE.find((t) => t.id === s.type)
  return {
    id: `course:${s.id}`,
    date: s.date,
    created_at: `${s.date}T${s.heure ?? '12:00'}:00`,
    name: `${type?.icone ?? '🏃'} ${type?.label ?? 'Course'} — ${s.distance_km.toFixed(1)} km`,
    notes: '',
    duration_min: Math.round(s.duree_s / 60),
    template_id: null,
    intensite: intensiteSortie(s),
    exercises: [
      {
        id: `course:${s.id}:1`,
        position: 0,
        name: ref?.name ?? 'Course à pied — endurance (zone 2)',
        muscle_group: ref?.groups ?? '',
        sets: 1,
        reps: `${Math.round(s.duree_s / 60)} min`,
        weight_kg: null,
        notes: '',
        // Un footing de récupération SOULAGE au lieu de charger : c'est le
        // même mécanisme que la marche ou les étirements, et il rend des jours
        // aux jambes au lieu d'en prendre.
        doux: s.type === 'recuperation' ? true : undefined,
      },
    ],
  } as MuscuSession
}

export function sortiesEnSeances(sorties: Sortie[]): MuscuSession[] {
  return sorties.map(sortieEnSeance)
}
