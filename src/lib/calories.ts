import { estRessenti, sessionTonnage, type MuscuExo, type MuscuSession } from './muscu'
import { dureeExercice, dureeLignes } from './duree'
import { ACTIVITE_NAMES, RECUPERATION_NAMES } from '../data/exercises'
import { coefIntensite, type IntensiteId } from './intensite'

/** Course, nage, béhourd, slackline… : pas un exercice de salle. */
const estActivite = (nom: string) => ACTIVITE_NAMES.has(nom.trim().toLowerCase())

/** Étirement, mobilité, nage lente : le catalogue le dit, on ne le devine pas. */
const estRecuperation = (nom: string) => RECUPERATION_NAMES.has(nom.trim().toLowerCase())

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
  // Travail léger / postural — EN TÊTE, et c'est le seul bloc qui y soit.
  //
  // Ces mots-là ne veulent dire qu'une chose : un exercice nommé « étirement »
  // est un étirement, point. Plus bas dans la cascade, ils se faisaient doubler
  // par un motif de sport qui traînait dans le nom — « Étirement des adducteurs
  // (papillon) » partait à 13,8, le MET de la nage papillon, pour un étirement
  // au sol. Rien ici ne peut être confondu avec une nage ni une course, donc
  // rien ne perd à passer en premier.
  [/(etirement|mobilite|vacuum|rotation externe|extension terminale)/, 2.5],
  // Récupération PASSIVE : on ne bouge pas. Sans ligne dédiée, un sauna
  // retombait sur le MET par défaut, celui de la musculation.
  //
  // « rouleau de massage » en entier, jamais « rouleau » seul : le catalogue a
  // un « Rouleau à poignet ». Et « bain chaud » en entier, jamais « bain » :
  // il y a « Moto — trajet urBAIN ».
  [/(sauna|bain chaud|rouleau de massage)/, 2],
  // Moto — AVANT tout le reste, parce que « Moto — grande balade » n'a aucun
  // mot-clé à lui et retombait sur le MET de la musculation : trois heures de
  // Speed Triple étaient facturées 1 530 kcal, autant qu'une séance de force de
  // trois heures. Conduire coûte quelque chose — tenir la machine, le vent, le
  // froid — mais pas ça. Les cols debout sur les repose-pieds valent plus que
  // l'autoroute en ligne droite, d'où deux paliers.
  [/\bmoto\b.*(sinueuse|\bcol|piste|tout-terrain)/, 3.5],
  [/\bmoto\b/, 2.5],
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
  //
  // « côte » désaccentué donne « cote », qui est aussi « côté » : le motif
  // \bcote\b attrapait « Haussement d'épaule nuque inclinée du côté opposé » et
  // facturait un haussement d'épaules au prix d'un sprint en côte — MET 12 au
  // lieu de 5. Il fallait donc du contexte, et « en cote » en donne assez ;
  // \bsprint attrape de toute façon « Sprints en côte » à lui seul.
  [/(\bsprint|fractionn|en cote\b|pliometrie)/, 12],
  [/corde a sauter/, 12],
  [/(course|running|footing|trail|sentier)/, 9.8],
  [/marche inclinee|escalier|stairmaster/, 8],
  [/(randonnee|\brando\b)/, 6],
  [/marche rapide/, 4.3],
  // Sports de combat pieds-poings — eux aussi retombaient sur le MET de la
  // musculation faute de motif. « \bboxe\b » et pas « box », sinon « Sauts sur
  // box » devient un combat.
  [/(cardioboxing|kickboxing|\bboxe\b).*(intervalle|sparring|combat|\bring\b)/, 9],
  [/(cardioboxing|kickboxing|\bboxe\b)/, 6],
  // Effort mixte / fonctionnel
  [/(burpees|traineau|sauts sur box|circuit|hiit)/, 8],
  [/(marche du fermier|port valise|portage|zercher)/, 6],
  [/(balancier|kettlebell|releve turc|lancer de ballon)/, 6.5],
  // Extérieur
  [/(hache|fendre|sciage|troncon|debitage)/, 6.3],
  [/(\bbois\b|elagage|debrouss)/, 5.5],
  [/jardinage|empilage/, 4.5],
  [/slackline/, 3.5],
  // Gainage — après la natation, sinon « Jambes de brasse (planche) » devient
  // du gainage à cause du mot « planche ».
  [/(gainage|\bplanche\b|deadbug|bird-dog|hollow|pont cervical|suspension a la barre)/, 3.5],
]

/** MET par défaut d'un exercice de musculation avec charge. */
const MET_MUSCU = 5

/**
 * Plafond d'un exercice que le catalogue déclare « récupération ».
 *
 * Une nage de récupération reste une nage : la cascade lui donnait le MET de la
 * brasse en pleine effort (8,3) alors que c'est de la godille sur place. On ne
 * réécrit pas la cascade pour autant — on la borne. Ce que le catalogue
 * DÉCLARE l'emporte sur ce que le nom SUGGÈRE, comme partout ailleurs.
 */
const MET_RECUP_MAX = 4

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Coût métabolique d'un exercice, d'après son nom. */
export function metPourExercice(name: string): number {
  const n = norm(name)
  let met = MET_MUSCU
  for (const [re, m] of MET_PAR_MOTIF) {
    if (re.test(n)) {
      met = m
      break
    }
  }
  return estRecuperation(name) ? Math.min(met, MET_RECUP_MAX) : met
}

/**
 * Minutes que prend un exercice, à lui seul.
 *
 * Même règle que la durée estimée d'une séance et que le générateur : une seule
 * définition de « combien de temps prend cet exercice ». C'est elle qui sert de
 * POIDS à la moyenne des MET.
 */
function minutesDe(e: Pick<MuscuExo, 'name' | 'sets' | 'reps'>): number {
  return dureeExercice({ nom: e.name, sets: Math.max(1, e.sets), reps: e.reps }) / 60
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
  /** Dépense BRUTE : tout ce que le corps a consommé pendant la séance. */
  kcal: number
  /** Vrai quand le coefficient vient d'une intensité déclarée, pas du calcul. */
  declaree: boolean
  /**
   * MET moyen de la séance, densité comprise. NON arrondi : c'est aussi lui qui
   * porte la charge d'entraînement, où un arrondi au dixième suffirait à faire
   * basculer un ratio de 1,49 à 1,51. On arrondit à l'affichage.
   */
  met: number
  /** MET des exercices seuls, avant modulation. Non arrondi, même raison. */
  metBrut: number
  minutes: number
  /** Vrai quand la durée n'était pas saisie et a été estimée. */
  dureeEstimee: boolean
  densite: Densite
  /** Vrai si au moins une ligne porte une allure déclarée. */
  allureDeclaree: boolean
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

/**
 * Moyenne des MET PONDÉRÉE PAR LE TEMPS de chaque exercice, allure comprise.
 *
 * C'était une moyenne plate, et une moyenne plate donne le même poids à cinq
 * minutes de corde à sauter qu'à cinquante minutes de développé couché. La
 * corde vaut MET 12, la muscu 5 : la séance sortait à 8,5 au lieu de 5,6 — la
 * moitié des calories en trop pour cinq minutes de corde. Dans l'autre sens,
 * une longue course finie par deux séries de curl perdait un cinquième de sa
 * dépense. Chaque exercice porte donc désormais son propre temps.
 *
 * L'allure se pose ici aussi, ligne par ligne, et pour la même raison que dans
 * le mannequin : c'est la ligne qui sait, pas la séance. Une séance tranquille
 * finie par un rameur à fond a un rameur à fond dedans. Sans allure déclarée,
 * la ligne reprend le coefficient de la séance — le calcul est alors exactement
 * celui d'avant, à la pondération près.
 */
function metPondere(
  exos: MuscuExo[],
  coefSeance: number,
): { met: number; metBrut: number; allureDeclaree: boolean } {
  let pondere = 0
  let brut = 0
  let total = 0
  let allureDeclaree = false
  for (const e of exos) {
    const min = minutesDe(e)
    if (min <= 0) continue
    const m = metPourExercice(e.name)
    const allure = (e as { allure?: IntensiteId }).allure
    if (allure) allureDeclaree = true
    pondere += m * (allure ? coefIntensite(allure) : coefSeance) * min
    brut += m * min
    total += min
  }
  if (total <= 0) return { met: 0, metBrut: 0, allureDeclaree }
  return { met: pondere / total, metBrut: brut / total, allureDeclaree }
}

export function sessionCalories(s: MuscuSession, bodyWeight: number | null): SessionCalories {
  const minutes = dureeSeance(s)
  // La ligne de ressenti décrit des zones, pas un effort : l'inclure dans la
  // moyenne tirerait le MET d'un sparring vers celui d'une séance de muscu.
  // Et quand il n'y a QUE du ressenti — béhourd, kickboxing —, c'est le nom de
  // la séance qui porte l'intensité, pas sa liste d'exercices.
  const exos = s.exercises.filter((e) => !estRessenti(e.name))
  // Une intensité déclarée REMPLACE le calcul : tu étais là, pas le barème.
  // Les additionner reviendrait à compter deux fois le même jugement.
  const auto = densiteSeance(s, bodyWeight)
  const densite: Densite = s.intensite
    ? { coef: coefIntensite(s.intensite), tonnageParMin: null, seriesParMin: null, applique: false }
    : auto
  const pond = metPondere(exos, densite.coef)
  // Séance sans aucun exercice chiffré : c'est le nom qui porte l'effort.
  const metBrut = exos.length ? pond.metBrut : metPourExercice(s.name)
  const met = exos.length ? pond.met : metBrut * densite.coef
  const poids = bodyWeight ?? 75
  return {
    kcal: Math.round(met * poids * (minutes / 60)),
    met,
    metBrut,
    minutes,
    dureeEstimee: s.duration_min === null,
    declaree: Boolean(s.intensite),
    densite,
    allureDeclaree: pond.allureDeclaree,
  }
}

/**
 * Ce que la séance ajoute VRAIMENT à la journée, une fois retiré ce que la vie
 * courante attribuait déjà à ces heures-là.
 *
 * `baseParHeure` vaut 0 quand on veut la dépense brute — celle qu'afficherait
 * une montre, et celle qui sert à comparer une semaine à l'autre. Le bilan
 * énergétique, lui, additionne la vie courante et le sport : il ne peut pas
 * prendre le brut sans compter deux fois les mêmes heures.
 *
 * Borné à zéro : aucun exercice du catalogue ne descend sous MET 2,5, donc le
 * cas ne se présente pas — mais un jour où quelqu'un saisirait trois heures de
 * présence pour vingt minutes d'étirements, une dépense négative n'aurait aucun
 * sens à afficher.
 */
export function kcalNet(c: SessionCalories, baseParHeure: number): number {
  return Math.max(0, Math.round(c.kcal - baseParHeure * (c.minutes / 60)))
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

/**
 * Bilan sur les N derniers jours (aujourd'hui inclus), plus la période d'avant.
 *
 * `baseParHeure` à 0 donne la dépense brute — l'onglet « Calories brûlées ».
 * Renseigné, il donne la dépense NETTE, la seule qu'on puisse additionner à
 * une vie courante déjà comptée sur vingt-quatre heures.
 */
export function bilanCalories(
  sessions: MuscuSession[],
  bodyWeight: number | null,
  jours = 7,
  baseParHeure = 0,
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
    const kcal = kcalNet(sessionCalories(s, bodyWeight), baseParHeure)
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
