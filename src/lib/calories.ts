import { estRessenti, sessionTonnage, type MuscuSession } from './muscu'
import { dureeLignes } from './duree'
import { ACTIVITE_NAMES } from '../data/exercises'
import { coefIntensite } from './intensite'

/** Course, nage, béhourd, slackline… : pas un exercice de salle. */
const estActivite = (nom: string) => ACTIVITE_NAMES.has(nom.trim().toLowerCase())

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

// ── Densité : ce que vaut réellement une heure de salle ────────────────────
//
// Deux séances d'une heure ne se valent pas. Le MET seul ne voit que la nature
// des exercices, pas le rythme : trois séries molles et vingt-cinq séries
// enchaînées pèsent pareil. La densité corrige ça.
//
// Deux signaux, moyennés :
//   • tonnage rapporté au poids de corps et au temps — combien de fois on a
//     soulevé son propre poids par minute ;
//   • séries par minute — le rythme, seul signal disponible quand il n'y a pas
//     de charge (gainage, poids du corps).

/**
 * Référence : une séance de force menée correctement, rapportée à la durée
 * TOTALE passée à la salle — échauffement, repos entre les séries et remise en
 * place des charges compris. C'est cette durée-là qui est saisie, et c'est
 * elle qui rend la comparaison honnête d'une séance à l'autre.
 */
const REF_TONNAGE_PAR_MIN = 1.0 // poids de corps soulevés par minute
const REF_SERIES_PAR_MIN = 0.33 // une série toutes les trois minutes, repos compris

export interface Densite {
  /** Multiplicateur appliqué au MET (1 = séance de référence). */
  coef: number
  tonnageParMin: number | null
  seriesParMin: number | null
  /**
   * Faux quand la densité n'est pas calculable : durée non saisie (elle serait
   * déduite des séries, donc le rapport serait constant par construction) ou
   * séance sans exercice chiffré.
   */
  applique: boolean
}

export function densiteSeance(s: MuscuSession, bodyWeight: number | null): Densite {
  const exos = s.exercises.filter((e) => !estRessenti(e.name))
  const series = exos.reduce((n, e) => n + Math.max(1, e.sets), 0)

  // Sans durée saisie, elle est déduite des exercices eux-mêmes : en tirer une
  // densité reviendrait à mesurer la règle avec elle-même — le rapport
  // séries/minute serait constant par construction. On s'abstient plutôt que de
  // produire un chiffre qui a l'air informé.
  if (s.duration_min === null || s.duration_min <= 0 || series === 0) {
    return { coef: 1, tonnageParMin: null, seriesParMin: null, applique: false }
  }

  // Une activité continue — course, nage, béhourd, slackline — n'a ni tonnage
  // ni rythme de séries à mesurer : son intensité EST déjà dans son MET. Lui
  // appliquer le barème de la salle la pénalisait mécaniquement, une course de
  // 45 min comptant pour « une série » et perdant un quart de ses calories.
  //
  // Il suffit d'UNE activité pour fausser le calcul : elle occupe de la durée
  // sans produire de séries, donc elle écrase le rapport séries/minute de tout
  // ce qui l'accompagne. Dans ce cas on s'abstient plutôt que de sous-estimer.
  if (exos.some((e) => estActivite(e.name))) {
    return { coef: 1, tonnageParMin: null, seriesParMin: null, applique: false }
  }

  const minutes = s.duration_min
  const poids = bodyWeight ?? 75
  const tonnage = sessionTonnage(exos)
  const tonnageParMin = tonnage > 0 ? tonnage / (poids * minutes) : null
  const seriesParMin = series / minutes

  const ratios = [seriesParMin / REF_SERIES_PAR_MIN]
  if (tonnageParMin !== null) ratios.push(tonnageParMin / REF_TONNAGE_PAR_MIN)
  const ratio = ratios.reduce((a, b) => a + b, 0) / ratios.length

  // Modulation volontairement douce : ±25 % en dessous, +35 % au maximum.
  // Au-delà, ce n'est plus de la densité, c'est une erreur de saisie.
  const coef = Math.max(0.75, Math.min(1.35, 0.75 + 0.25 * ratio))
  return { coef: Math.round(coef * 100) / 100, tonnageParMin, seriesParMin, applique: true }
}

export interface SessionCalories {
  kcal: number
  /** Vrai quand le coefficient vient d'une intensité déclarée, pas du calcul. */
  declaree: boolean
  /** MET moyen de la séance, densité comprise. */
  met: number
  /** MET des exercices seuls, avant modulation. */
  metBrut: number
  minutes: number
  /** Vrai quand la durée n'était pas saisie et a été estimée. */
  dureeEstimee: boolean
  densite: Densite
}

/**
 * Durée estimée quand elle n'a pas été saisie : le CUMUL des durées propres aux
 * exercices.
 *
 * C'était avant « 2,5 min par série », plancher à quinze minutes. Une règle
 * plate qui ignorait tout de ce qu'on avait fait : quatre séries de soulevé de
 * terre — trois minutes de repos chacune — comptaient comme quatre séries de
 * flexions de poignets, un portage de 30 m comme une série de dix, et vingt
 * minutes de crawl comme une seule série, donc quinze minutes. Les calories
 * suivaient.
 *
 * Le générateur savait déjà estimer ça exercice par exercice pour tenir un
 * créneau d'une heure : travail déduit du format de répétitions (temps, distance
 * ou reps), repos selon le coût du mouvement, transition entre exercices. C'est
 * la même règle qui sert ici — une seule définition de « combien de temps prend
 * cet exercice ».
 *
 * Exportée pour que la charge d'entraînement estime exactement pareil.
 */
export function dureeEstimee(s: MuscuSession): number {
  const exos = s.exercises.filter((e) => !estRessenti(e.name))
  // Rien de mesurable — une séance qui ne porte qu'un ressenti (béhourd,
  // kickboxing). Elle a bien duré quelque chose, mais rien ici ne dit combien :
  // on garde le minimum prudent d'avant plutôt que d'annoncer zéro calorie.
  if (!exos.length) return MINUTES_SANS_REPERE
  return dureeLignes(exos.map((e) => ({ nom: e.name, sets: Math.max(1, e.sets), reps: e.reps })))
}

/** Durée retenue faute de tout repère : ni durée saisie, ni exercice chiffré. */
const MINUTES_SANS_REPERE = 15

export function sessionCalories(s: MuscuSession, bodyWeight: number | null): SessionCalories {
  const minutes = dureeSeance(s)
  // La ligne de ressenti décrit des zones, pas un effort : l'inclure dans la
  // moyenne tirerait le MET d'un sparring vers celui d'une séance de muscu.
  // Et quand il n'y a QUE du ressenti — béhourd, kickboxing —, c'est le nom de
  // la séance qui porte l'intensité, pas sa liste d'exercices.
  const mets = s.exercises.filter((e) => !estRessenti(e.name)).map((e) => metPourExercice(e.name))
  const metBrut = mets.length ? mets.reduce((a, b) => a + b, 0) / mets.length : metPourExercice(s.name)
  // Une intensité déclarée REMPLACE le calcul : tu étais là, pas le barème.
  // Les additionner reviendrait à compter deux fois le même jugement.
  const auto = densiteSeance(s, bodyWeight)
  const densite: Densite = s.intensite
    ? { coef: coefIntensite(s.intensite), tonnageParMin: null, seriesParMin: null, applique: false }
    : auto
  const met = metBrut * densite.coef
  const poids = bodyWeight ?? 75
  return {
    kcal: Math.round(met * poids * (minutes / 60)),
    met: Math.round(met * 10) / 10,
    metBrut: Math.round(metBrut * 10) / 10,
    minutes,
    dureeEstimee: s.duration_min === null,
    declaree: Boolean(s.intensite),
    densite,
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
