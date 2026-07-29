import { estRessenti, type MuscuSession } from './muscu'

// Estimation de la dépense énergétique d'une séance par la méthode MET :
//
//     kcal = MET × poids de corps (kg) × durée (h)
//
// Le MET (équivalent métabolique) est le coût d'une activité rapporté au repos.
// Les valeurs suivent le Compendium of Physical Activities : 5 pour de la
// musculation classique, ~10 pour de la course, ~11 pour du combat en armure.
//
// C'est une ESTIMATION : sans capteur cardiaque, la vérité est à ±15-20 %. Elle
// reste utile pour comparer une semaine à l'autre — ce qui est le but ici.

/**
 * Table MET par mot-clé, dans l'ordre : le premier motif qui correspond gagne.
 *
 * Les motifs sont écrits SANS accent (le nom est désaccentué avant le test) et
 * bornés par \b dès qu'ils sont courts : sans ça « velo » se retrouve au milieu
 * de « déVELOppé couché » et toute la muscu passe pour du vélo.
 */
const MET_PAR_MOTIF: Array<[RegExp, number]> = [
  // Béhourd — combat en armure, le plus coûteux de la semaine
  [/behourd.*(melee|sparring|corps a corps|duel)/, 11],
  [/behourd.*(frappes|technique)/, 8.5],
  [/behourd.*(harnois|garde)/, 7],
  [/behourd/, 8.5],
  // Natation — avant la course, sinon « crawl en sprint » part en sprint à pied
  [/papillon/, 13.8],
  [/crawl en sprint/, 10],
  [/(crawl|dos crawle|brasse|plaquettes|eau libre)/, 8.3],
  [/(planche \(natation\)|pull buoy|dauphin|jambes de brasse|nage indienne)/, 6],
  [/aquagym/, 5.5],
  // Cardio salle — avant la course pour la même raison (rameur en sprint)
  [/(rameur|assault bike|cordes ondulatoires)/, 8.5],
  [/(velo de biking|\bvtt\b)/, 8.5],
  [/velo elliptique/, 5.5],
  [/\bvelo\b/, 7],
  [/\bkayak\b|aviron/, 7],
  [/escalade|\bbloc\b/, 8],
  // Course & impact
  [/(\bsprint|fractionn|\bcote\b|pliometrie)/, 12],
  [/corde a sauter/, 12],
  [/(course|running|footing|trail|sentier)/, 9.8],
  [/marche inclinee|escalier|stairmaster/, 8],
  [/(randonnee|\brando\b)/, 6],
  [/marche rapide/, 4.3],
  // Effort mixte / fonctionnel
  [/(burpees|traineau|sauts sur box|circuit|hiit)/, 8],
  [/(marche du fermier|port valise|portage|zercher)/, 6],
  [/(balancier|kettlebell|releve turc|lancer de ballon)/, 6.5],
  // Extérieur
  [/(hache|fendre|sciage|troncon|debitage)/, 6.3],
  [/(\bbois\b|elagage|debrouss)/, 5.5],
  [/jardinage|empilage/, 4.5],
  [/slackline/, 3.5],
  // Travail léger / postural
  [/(etirement|mobilite|vacuum|rotation externe|extension terminale)/, 2.5],
  [/(gainage|\bplanche\b|deadbug|bird-dog|hollow|pont cervical|suspension a la barre)/, 3.5],
]

/** MET par défaut d'un exercice de musculation avec charge. */
const MET_MUSCU = 5

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Coût métabolique d'un exercice, d'après son nom. */
export function metPourExercice(name: string): number {
  const n = norm(name)
  for (const [re, met] of MET_PAR_MOTIF) if (re.test(n)) return met
  return MET_MUSCU
}

/** Durée retenue pour une séance : celle saisie, sinon l'estimation. */
export function dureeSeance(s: MuscuSession): number {
  return s.duration_min ?? dureeEstimee(s)
}

export interface SessionCalories {
  kcal: number
  /** MET moyen de la séance. */
  met: number
  minutes: number
  /** Vrai quand la durée n'était pas saisie et a été estimée. */
  dureeEstimee: boolean
}

/**
 * Durée estimée quand elle n'a pas été saisie : ~2,5 min par série, série et
 * repos compris. Volontairement prudent — mieux vaut sous-estimer.
 * Exportée pour que la charge d'entraînement estime exactement pareil.
 */
export function dureeEstimee(s: MuscuSession): number {
  const series = s.exercises.filter((e) => !estRessenti(e.name)).reduce((n, e) => n + Math.max(1, e.sets), 0)
  return Math.min(150, Math.max(15, Math.round(series * 2.5)))
}

export function sessionCalories(s: MuscuSession, bodyWeight: number | null): SessionCalories {
  const minutes = dureeSeance(s)
  // La ligne de ressenti décrit des zones, pas un effort : l'inclure dans la
  // moyenne tirerait le MET d'un sparring vers celui d'une séance de muscu.
  // Et quand il n'y a QUE du ressenti — béhourd, kickboxing —, c'est le nom de
  // la séance qui porte l'intensité, pas sa liste d'exercices.
  const mets = s.exercises.filter((e) => !estRessenti(e.name)).map((e) => metPourExercice(e.name))
  const met = mets.length ? mets.reduce((a, b) => a + b, 0) / mets.length : metPourExercice(s.name)
  const poids = bodyWeight ?? 75
  return {
    kcal: Math.round(met * poids * (minutes / 60)),
    met: Math.round(met * 10) / 10,
    minutes,
    dureeEstimee: s.duration_min === null,
  }
}

export interface JourCalories {
  date: string
  kcal: number
  /** Noms des séances du jour, pour l'infobulle. */
  seances: string[]
}

export interface BilanCalories {
  /** Du plus ancien au plus récent, un point par jour, trous compris. */
  jours: JourCalories[]
  total: number
  moyenne: number
  /** Total de la période précédente de même longueur, pour la tendance. */
  totalPrecedent: number
  max: number
}

/** Bilan sur les N derniers jours (aujourd'hui inclus), plus la période d'avant. */
export function bilanCalories(
  sessions: MuscuSession[],
  bodyWeight: number | null,
  jours = 7,
): BilanCalories {
  const debut = new Date()
  debut.setHours(0, 0, 0, 0)
  debut.setDate(debut.getDate() - (jours - 1))

  const cases: JourCalories[] = []
  for (let i = 0; i < jours; i++) {
    const d = new Date(debut)
    d.setDate(d.getDate() + i)
    cases.push({ date: d.toLocaleDateString('en-CA'), kcal: 0, seances: [] })
  }
  const index = new Map(cases.map((c, i) => [c.date, i]))

  const debutPrecedent = new Date(debut)
  debutPrecedent.setDate(debutPrecedent.getDate() - jours)
  const bornePrecedent = debut.toLocaleDateString('en-CA')
  const debutPrecedentStr = debutPrecedent.toLocaleDateString('en-CA')

  let totalPrecedent = 0
  for (const s of sessions) {
    const { kcal } = sessionCalories(s, bodyWeight)
    const i = index.get(s.date)
    if (i !== undefined) {
      cases[i].kcal += kcal
      cases[i].seances.push(s.name)
    } else if (s.date >= debutPrecedentStr && s.date < bornePrecedent) {
      totalPrecedent += kcal
    }
  }

  const total = cases.reduce((n, c) => n + c.kcal, 0)
  return {
    jours: cases,
    total,
    moyenne: Math.round(total / jours),
    totalPrecedent,
    max: Math.max(1, ...cases.map((c) => c.kcal)),
  }
}
