// Ce qui fait une séance cohérente, et pas seulement une liste d'exercices sur
// des muscles reposés.
//
// La récupération dit CE QU'ON PEUT travailler. Elle ne dit rien de ce qui
// compose une bonne séance : combien de séries un muscle peut absorber avant que
// les suivantes ne servent plus à rien, combien de gros mouvements un système
// nerveux encaisse d'affilée, quel équilibre pousser/tirer tenir, et quels
// exercices rendent le plus par série. Ce module porte ces règles-là.
//
// Sources des valeurs retenues, pour qu'on puisse les rediscuter :
//
//   • Volume par séance — au-delà de ~6-8 séries dures sur un muscle dans une
//     même séance, la croissance plafonne alors que le coût de récupération
//     continue de monter (relation logarithmique volume/hypertrophie).
//     https://weightology.net/the-members-area/evidence-based-guides/set-volume-for-muscle-size-the-ultimate-evidence-based-bible/
//     https://www.strongerbyscience.com/research-spotlight-volume-returns/
//
//   • Ordre des exercices — il ne change pas l'hypertrophie, mais il change les
//     gains de FORCE : ce qui est fait en premier progresse le plus, la fatigue
//     nerveuse s'accumulant au fil de la séance. La recommandation explicite est
//     de placer le muscle prioritaire en premier, qu'il soit travaillé en
//     polyarticulaire ou en isolation.
//     https://sandcresearch.medium.com/how-does-exercise-order-in-a-workout-affect-hypertrophy-586939963369
//
//   • Fatigue systémique — soulevés, squats et portages sollicitent beaucoup de
//     masse et font monter la pression intrathoracique ; leur coût nerveux et
//     cardiovasculaire dépasse largement celui d'une isolation, et il se cumule.
//     https://support.trainwithmorpheus.com/support/solutions/articles/4000226117-how-heavy-lifting-affects-blood-pressure-and-recovery
//
//   • Équilibre pousser/tirer — un ratio d'au moins 1:1, et plutôt 1:1,5 à 1:2
//     en faveur du tirage, pour la santé de l'épaule et la posture.
//     https://bretcontreras.com/topic-of-the-week-4-pushing-and-pulling-ratios/
//
//   • Longueur musculaire — charger un muscle en position étirée produit
//     nettement plus d'hypertrophie qu'en position raccourcie, jusqu'au double
//     sur les ischios et près du triple sur le biceps.
//     https://www.sciencedirect.com/science/article/pii/S2666337625000332

import { regionsForGroup, type MuscleRegion } from './muscles'
import { parseGroupEntries } from './muscu'

/** Sans accents et en minuscules : les règles ci-dessous s'y comparent. */
function normaliser(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .toLowerCase()
}

// ── Familles de mouvement ───────────────────────────────────────────────────

export type Pattern =
  | 'poussee'
  | 'tirage'
  | 'hanche'
  | 'genou'
  | 'portage'
  | 'gainage'
  | 'isolation'

/**
 * Rangées de règles, dans l'ordre : la PREMIÈRE qui correspond gagne.
 *
 * L'ordre compte. « Tirage bras tendus (pull-over) » contient « tirage » mais
 * doit tomber dans le tirage, pas ailleurs ; « soulevé de terre jambes tendues
 * aux haltères » doit tomber dans la hanche avant qu'une règle plus large ne
 * l'attrape.
 */
const REGLES: Array<[Pattern, RegExp]> = [
  // Charge portée, déplacée : le tronc travaille en isométrie sous charge.
  ['portage', /marche du fermier|port valise|portage|traineau|releve turc/],
  // Charnière de hanche : le dos et la chaîne postérieure en extension.
  //
  // Pas de « jambes tendues » ici : la règle était redondante — le seul exercice
  // qu'elle visait, le soulevé jambes tendues, tombe déjà dans « souleve de
  // terre » — et elle attrapait au passage les « relevés de jambes tendues
  // suspendu », c'est-à-dire un relevé de jambes classé comme un soulevé de
  // terre. Il en héritait le repos long, la place de gros mouvement dans la
  // séance et l'appariement d'une charnière de hanche.
  ['hanche', /souleve de terre|roumain|rdl|poussee de hanches|balancier|extension (du buste|lombaire|de hanche)|superman|flexion du buste|machine a fessiers/],
  // Flexion de genou sous charge.
  ['genou', /squat|presse a cuisses|fente|montee sur banc|hack/],
  // Tout ce qui tire vers soi, horizontalement ou verticalement.
  //
  // `\btraction` et non `traction` : sans la frontière de mot, la « pompe
  // scapulaire (PROtraction) » — qui pousse le sol pour écarter les omoplates —
  // était classée comme un tirage. Elle en héritait le mauvais côté du ratio
  // pousser/tirer et se retrouvait appariée en superset avec une poussée, dont
  // elle partage pourtant les moteurs.
  ['tirage', /\btraction|tirage|rowing|pull-over|retraction scapulaire|oiseau|ecarte inverse|suspension a la barre/],
  // Tout ce qui pousse loin de soi.
  ['poussee', /developpe|pompe|dips|ecarte|floor press/],
  // Anti-mouvement : on résiste, on ne déplace rien.
  ['gainage', /planche|gainage|deadbug|bird-dog|hollow|pallof|anti-rotation|anti-extension|vacuum|pont cervical|chaise romaine|abduction en gainage/],
]

export function patternDe(nom: string): Pattern {
  const n = normaliser(nom)
  for (const [pattern, re] of REGLES) if (re.test(n)) return pattern
  return 'isolation'
}

/** Le pousser et le tirer, pour l'équilibre de l'épaule. */
export function estPoussee(nom: string): boolean {
  return patternDe(nom) === 'poussee'
}
export function estTirage(nom: string): boolean {
  return patternDe(nom) === 'tirage'
}

// ── Coût systémique ─────────────────────────────────────────────────────────

/**
 * Ce que l'exercice coûte au système, indépendamment des muscles qu'il vise.
 *
 * 2 = lourd (beaucoup de masse mobilisée, apnée sous charge), 1 = moyen,
 * 0 = local. Le générateur proposait cinq mouvements à 2 d'affilée — soulevé
 * trap bar, soulevé, zercher, portage unilatéral, marche du fermier — parce
 * qu'aucune règle ne les empêchait de s'additionner. Chacun se justifiait
 * séparément ; ensemble, c'est une séance qu'on ne finit pas.
 */
const LOURDS = /souleve de terre|squat (barre|a la barre guidee)|marche du fermier|portage|traineau|releve turc|burpees/
const MOYENS = /presse a cuisses|fente|hack|traction|dips|developpe militaire|developpe couche(?! a la barre guidee)|poussee de hanches|balancier|montee sur banc|tirage buste penche|t-bar|rowing en position de planche|roumain/

export function coutSystemique(nom: string): 0 | 1 | 2 {
  const n = normaliser(nom)
  if (LOURDS.test(n)) return 2
  if (MOYENS.test(n)) return 1
  return 0
}

/**
 * Budget de fatigue systémique d'une séance.
 *
 * Environ 0,7 point par exercice : sur six, quatre points, soit deux gros
 * mouvements, ou un gros et deux moyens. En mode béhourd on accorde un point de
 * plus — les portages et les soulevés SONT le sport, les écarter par principe
 * serait s'entraîner à côté de la plaque.
 */
export function budgetSystemique(count: number, behourd: boolean): number {
  return Math.max(3, Math.ceil(count * 0.7)) + (behourd ? 1 : 0)
}

// ── Volume par muscle ───────────────────────────────────────────────────────

/**
 * Séries « effectives » qu'un muscle peut absorber dans une séance.
 *
 * Une série compte au prorata de la part du muscle dans l'exercice : quatre
 * séries de développé couché valent quatre séries de pectoral et deux de
 * triceps. Au-delà de ce plafond, la croissance ne suit plus mais la fatigue
 * continue — c'est la définition même du volume inutile.
 *
 * Six par défaut, huit sur le point faible : on y met délibérément le haut de la
 * fourchette productive, c'est justement ce que « viser un groupe » veut dire.
 */
export const SERIES_MAX = 6
export const SERIES_MAX_FOCUS = 8

/** En dessous, la sollicitation est incidente : elle ne consomme pas de volume. */
export const PART_COMPTABLE = 0.5

/** Intensité maximale par muscle pour un exercice donné. */
export function musclesDeLExercice(groups: string): Map<MuscleRegion, number> {
  const out = new Map<MuscleRegion, number>()
  for (const entry of parseGroupEntries(groups)) {
    for (const region of regionsForGroup(entry.name)) {
      const cur = out.get(region)
      if (cur === undefined || entry.intensity > cur) out.set(region, entry.intensity)
    }
  }
  return out
}

/**
 * Ce qu'un exercice ajoute au compteur de séries de chaque muscle.
 *
 * Pondéré par la part du muscle : quatre séries de développé couché valent
 * quatre séries de pectoral et deux de triceps. Exporté et non recalculé ailleurs
 * — mesurer le volume autrement que le générateur ne l'impose, c'est vérifier
 * autre chose que ce qui tourne.
 */
export function apportSeries(
  muscles: Map<MuscleRegion, number>,
  sets: number,
): Array<[MuscleRegion, number]> {
  const out: Array<[MuscleRegion, number]> = []
  for (const [region, part] of muscles) {
    if (part < PART_COMPTABLE) continue
    out.push([region, sets * part])
  }
  return out
}

// ── Position étirée ─────────────────────────────────────────────────────────

/**
 * Exercices qui chargent le muscle en position ALLONGÉE.
 *
 * Liste tenue à la main plutôt que devinée : « écarté » est étiré, « écarté
 * inversé » ne l'est pas, et aucune règle sur les noms ne distinguera les deux
 * de façon fiable. Mieux vaut une liste courte et juste qu'une règle large et
 * fausse.
 */
export const ETIRES = new Set(
  [
    // Pectoraux : l'amplitude basse de l'écarté et du dips.
    'Écarté haltères',
    'Écarté incliné haltères',
    'Écarté à la poulie',
    'Écarté croisé à la poulie basse',
    'Développé couché incliné haltères',
    'Dips aux barres parallèles',
    'Pompes déclinées',
    // Dos et pectoral en extension complète au-dessus de la tête.
    'Pull-over haltère au banc',
    'Pull-over à la poulie haute (bras tendus)',
    'Tirage bras tendus (pull-over)',
    'Tractions pronation',
    // Ischios : hanche fléchie, le cas le mieux documenté.
    'Soulevé de terre roumain (RDL)',
    'Soulevé de terre jambes tendues aux haltères',
    'Flexion des ischios assis (machine)',
    // Quadriceps et fessiers en amplitude basse.
    'Fentes bulgares',
    'Fentes marchées haltères',
    'Fentes inversées',
    'Presse à cuisses pieds hauts',
    'Squat gobelet en tempo',
    'Montée sur banc',
    // Biceps bras en arrière, triceps au-dessus de la tête.
    'Curl incliné aux haltères',
    'Curl au pupitre',
    'Extensions triceps au-dessus de la tête (poulie)',
    'Extension triceps haltère à deux mains',
    // Mollets : le talon sous le niveau de l'avant-pied.
    'Mollets debout (machine)',
    'Mollets assis (machine)',
    'Mollets à la presse',
    'Mollets unilatéraux',
    // Abdominaux et adducteurs en allongement.
    'Relevés de jambes tendues suspendu',
    'Chaise romaine — relevés de jambes',
    'Roulette abdominale',
    'Planche latérale danoise (copenhagen)',
  ].map(normaliser),
)

export function estEtire(nom: string): boolean {
  return ETIRES.has(normaliser(nom))
}

/**
 * Bonus de score des exercices en position étirée.
 *
 * Volontairement modeste au regard de la littérature — certaines études
 * rapportent jusqu'au double de croissance —, parce qu'il s'ajoute à un
 * classement qui pèse d'abord la récupération. Une séance ne doit pas devenir
 * une collection d'étirements chargés sur des muscles fatigués.
 */
export const BONUS_ETIRE = 1.3
