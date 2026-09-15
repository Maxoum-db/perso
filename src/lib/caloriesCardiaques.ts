// Les calories comptées au cœur, quand le brassard était là.
//
// ── Ce que la méthode MET ne peut pas savoir ────────────────────────────────
//
// `calories.ts` estime la dépense par le MET : un barème par type d'exercice,
// multiplié par le poids et la durée. C'est ce qu'on peut faire de mieux SANS
// mesure — mais ça ne décrit pas ta séance, ça décrit la séance moyenne de
// quelqu'un qui fait les mêmes exercices que toi.
//
// Deux séances de développé couché d'une heure y valent exactement pareil, que
// l'une se soit passée à 105 bpm entre de longues pauses et l'autre à 150 sans
// souffler. Le barème ne peut pas les distinguer : il ne regarde que les noms
// des exercices.
//
// La fréquence cardiaque, elle, mesure ce que TON corps a fait. Quand elle est
// disponible, elle vaut mieux.
//
// ── L'équation de Keytel ────────────────────────────────────────────────────
//
// Keytel et al. (2005), « Prediction of energy expenditure from heart rate
// monitoring during submaximal exercise ». Elle rend des kilojoules par minute
// à partir de la fréquence, du poids, de l'âge et du sexe.
//
// ⚠️ « SUBMAXIMAL EXERCISE » est dans le titre, et c'est une borne, pas une
// précision de style. L'équation a été établie sur des gens à l'effort ; au
// repos elle déraille. Un homme de 80 kg et 40 ans assis à 70 bpm y récolte
// environ 190 kcal/h, soit plus du double de sa dépense réelle au repos. Elle
// n'est donc PAS appliquée en dessous du seuil ci-dessous — on garde le MET,
// qui est mauvais pour distinguer deux séances et honnête pour décrire le
// calme.

export type Sexe = 'H' | 'F'

/**
 * Kilojoules par minute selon Keytel.
 *
 * Les coefficients sont ceux de la publication, recopiés tels quels. Le
 * `-55.0969` masculin n'est pas une faute de frappe : l'équation passe par des
 * valeurs négatives aux fréquences basses, ce qui est une autre façon de dire
 * qu'elle n'y a pas cours.
 */
export function keytelKjParMinute(bpm: number, poidsKg: number, age: number, sexe: Sexe): number {
  return sexe === 'H'
    ? -55.0969 + 0.6309 * bpm + 0.1988 * poidsKg + 0.2017 * age
    : -20.4022 + 0.4472 * bpm - 0.1263 * poidsKg + 0.074 * age
}

/** Un kilojoule vaut 1/4,184 kilocalorie. */
const KJ_EN_KCAL = 4.184

/**
 * En dessous de quelle part de la fréquence maximale on refuse de s'en servir.
 *
 * La moitié, et ce n'est pas une constante de Keytel : c'est la borne haute de
 * la zone « Repos » du reste de l'application (`ZONES` dans `cardio.ts`, sous
 * 50 % = récupération entre deux séries). Reprendre la même frontière évite
 * qu'un écran annonce « zone Repos » pendant qu'un autre facture de l'effort,
 * et elle s'adapte à la personne au lieu d'être un chiffre absolu.
 */
export const PART_MIN_FCMAX = 0.5

export interface EstimationCardiaque {
  kcal: number
  /** kcal par minute — c'est ce qui compare deux séances de durées différentes. */
  parMinute: number
}

/**
 * Les calories d'une séance d'après la fréquence moyenne mesurée.
 *
 * Rend `null` — et pas zéro, ni une valeur approchée — dès qu'il manque quoi
 * que ce soit : pas de mesure, pas de poids, pas d'âge, ou une fréquence trop
 * basse pour que l'équation ait cours. L'écran doit alors dire qu'il s'en tient
 * au barème, ce qu'il ne pourrait pas faire s'il recevait un nombre.
 */
export function caloriesCardiaques(args: {
  /** Fréquence moyenne de la séance, en battements par minute. */
  moyenne: number | null
  minutes: number
  poidsKg: number | null
  age: number | null
  sexe: Sexe
  /** Fréquence maximale, relevée ou estimée. */
  fcMax: number | null
}): EstimationCardiaque | null {
  const { moyenne, minutes, poidsKg, age, sexe, fcMax } = args
  if (moyenne === null || poidsKg === null || age === null || fcMax === null) return null
  if (!(minutes > 0) || !(fcMax > 0)) return null
  if (moyenne < fcMax * PART_MIN_FCMAX) return null

  const parMinuteKcal = keytelKjParMinute(moyenne, poidsKg, age, sexe) / KJ_EN_KCAL
  // Une valeur négative ou nulle ne veut rien dire : on refuse plutôt que de
  // rendre un zéro qui se laisserait additionner.
  if (!(parMinuteKcal > 0)) return null

  return {
    kcal: Math.round(parMinuteKcal * minutes),
    parMinute: Math.round(parMinuteKcal * 10) / 10,
  }
}

/**
 * L'écart à l'estimation par barème, en pourcentage.
 *
 * C'est la réponse à « quel effet ce sport a eu sur mes calories » : pas un
 * chiffre de plus, mais la différence entre ce que le barème supposait et ce
 * que le cœur a mesuré. `null` si l'une des deux manque.
 */
export function ecartAuBareme(mesure: number | null, bareme: number | null): number | null {
  if (mesure === null || bareme === null || bareme <= 0) return null
  return Math.round(((mesure - bareme) / bareme) * 100)
}
