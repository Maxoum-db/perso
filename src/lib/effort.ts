import { distanceEnMetres, isBodyweightExercise, repsPourTonnage } from './muscu'

// Ce qu'une SÉRIE a réellement coûté.
//
// Le mannequin traitait 40 kg au développé couché exactement comme 100 kg. La
// seule intensité qu'il lisait était la part du muscle dans l'exercice —
// « Grand pectoral:1 » — et la mention « à fond » cochée à la main sur la séance
// entière. Deux séances identiques sur le papier, dont l'une échauffe et l'autre
// écrase, cuisaient donc le pectoral pareil.
//
// Ce module rend un FACTEUR, autour de 1, dont on multiplie la part du muscle.
// Une série légère réduit la part, donc le muscle repart avec de l'avance et
// revient au vert plus tôt ; une série lourde fait l'inverse.
//
// La mesure est le POURCENTAGE DU MAXIMUM, pas les kilos bruts : 60 kg au
// développé ne veulent rien dire tant qu'on ne sait pas ce que la personne y
// pousse au maximum. C'est aussi la seule façon d'être juste pour deux corps
// différents — Andréa à 60 kg et moi à 102 kg n'avons pas les mêmes barres sur
// la même série de travail, et le mannequin doit dire la même chose des deux.
//
// ⚠️ Sans poids de corps connu, le facteur vaut exactement 1 et rien ne change.
// C'est délibéré : sans lui, une traction pèse « zéro » et un dips aussi, la
// référence d'un exercice au poids du corps serait donc vide et son facteur
// tomberait au plancher. Mieux vaut un mannequin qui garde son barème qu'un
// mannequin qui invente le poids de la personne.

/**
 * Part du poids du corps réellement soulevée, par famille de mouvement.
 *
 * Une traction déplace tout le corps, une pompe environ les deux tiers, un squat
 * au poids du corps un peu moins que tout — les jambes ne se portent pas
 * elles-mêmes. Ces fractions sont les ordres de grandeur admis en biomécanique
 * pour les appuis correspondants ; elles n'ont pas besoin d'être exactes au
 * pour cent, seulement de mettre les exercices dans le bon ordre.
 *
 * L'ordre des entrées compte : le premier motif qui correspond gagne.
 */
const PART_DU_CORPS: Array<[RegExp, number]> = [
  [/traction|suspension|dead hang|muscle-?up/i, 1.0],
  [/dips|pompe|planche dynamique|renegade/i, 0.68],
  [/gainage|planche|deadbug|bird-?dog|hollow|superman/i, 0.55],
  [/fente|montée sur banc|step-?up|bulgare/i, 0.85],
  [/squat|pistol|chaise/i, 0.85],
  [/burpee|saut|sprint|grimpeur|corde à sauter/i, 0.9],
  [/relevé de jambes|crunch|rotation russe|roulette/i, 0.4],
]

function partDuCorps(nom: string): number {
  if (!isBodyweightExercise(nom)) return 0
  return PART_DU_CORPS.find(([re]) => re.test(nom))?.[1] ?? 0.6
}

/**
 * Charge totale déplacée par répétition, en kilos.
 *
 * C'est ici que le poids de la personne entre : une traction lestée de 20 kg
 * pour quelqu'un de 102 kg, c'est 122 kg qui montent, pas 20. Et la même
 * traction sans lest n'est pas « zéro », ce que le tonnage croit encore — le
 * tonnage compte ce qu'on ajoute à la barre, ici on compte ce que le muscle
 * déplace.
 */
export function chargeTotale(
  e: { name: string; weight_kg: number | null },
  poidsCorps: number | null,
): number {
  const externe = typeof e.weight_kg === 'number' && e.weight_kg > 0 ? e.weight_kg : 0
  const part = poidsCorps ? partDuCorps(e.name) * poidsCorps : 0
  return externe + part
}

/**
 * Maximum théorique sur une répétition, formule d'Epley : w × (1 + reps/30).
 *
 * Elle sert à comparer des séries qui n'ont ni le même poids ni le même nombre
 * de répétitions — 100 kg × 3 et 80 kg × 10 sont à peu près le même effort, et
 * sans elle la seconde passerait pour légère.
 *
 * Au-delà d'une quinzaine de répétitions elle dérive : on borne, parce qu'une
 * série de trente ne dit plus rien d'une force maximale, elle parle d'endurance.
 */
export function maxTheorique(charge: number, reps: number): number {
  return charge * (1 + Math.min(reps, 15) / 30)
}

/**
 * Une série a-t-elle une CHARGE au sens où on l'entend ici ?
 *
 * Non pour un gainage tenu 45 s : il n'a ni charge ni répétitions à comparer,
 * son intensité est dans la durée.
 *
 * Non pour une locomotion — « 6 × 40 m », une sortie de 8 km : une distance
 * n'est pas un pourcentage de maximum, et l'intensité d'une course vient déjà
 * de l'effort perçu, qui est une meilleure mesure que tout ce qu'on
 * calculerait. Mais une marche du fermier sur 20 m porte, elle, de vrais kilos :
 * c'est la présence d'une charge externe qui départage, pas le format des reps.
 */
function repsChargeables(e: { reps: string; weight_kg: number | null }): number | null {
  const reps = repsPourTonnage(e.reps)
  if (reps === null) return null
  const lest = typeof e.weight_kg === 'number' && e.weight_kg > 0
  if (!lest && distanceEnMetres(e.reps) !== null) return null
  return reps
}

/**
 * Le meilleur maximum théorique connu POUR CHAQUE exercice, sur la fenêtre.
 *
 * Construit en une passe et rendu sous forme de table : `groupLoads` parcourt
 * déjà toutes les séances et tous les exercices, et redemander la référence à
 * chaque ligne rendrait le calcul quadratique — sur trois mois de séances, ça
 * se voit à l'écran.
 *
 * La référence est le maximum de la PERSONNE, pas un barème : c'est ce qui rend
 * la mesure juste sans avoir à connaître son niveau. Elle inclut forcément la
 * série qu'on est en train de juger, donc le rapport ne dépasse jamais 1 — un
 * record du jour vaut « à fond », ce qui est exactement ce qu'il est.
 */
export function referencesEffort(
  seances: Array<{ date: string; exercises: Array<{ name: string; reps: string; weight_kg: number | null }> }>,
  poidsCorps: number | null,
  jours = 180,
  maintenant = Date.now(),
): Map<string, number> {
  const out = new Map<string, number>()
  if (!poidsCorps || poidsCorps <= 0) return out
  const limite = new Date(maintenant - jours * 86400000).toLocaleDateString('en-CA')
  for (const s of seances) {
    if (s.date < limite) continue
    for (const e of s.exercises) {
      const reps = repsChargeables(e)
      if (reps === null) continue
      const c = chargeTotale(e, poidsCorps)
      if (c <= 0) continue
      const cle = e.name.trim().toLowerCase()
      out.set(cle, Math.max(out.get(cle) ?? 0, maxTheorique(c, reps)))
    }
  }
  return out
}

/**
 * Le facteur d'effort d'une ligne de séance, autour de 1.
 *
 * Le plancher n'est pas zéro et le plafond pas l'infini : une série très légère
 * SOLLICITE quand même — elle ne mérite pas d'être effacée du mannequin — et une
 * série record ne doit pas non plus doubler la fatigue d'un muscle. La fourchette
 * dit « d'un échauffement à une série maximale », pas « de rien à tout ».
 */
export const EFFORT_MIN = 0.45
export const EFFORT_MAX = 1.2

/**
 * Les deux bornes du barème, en pourcentage du maximum.
 *
 * `PART_PIVOT` est le point qui rend exactement 1 : une série de travail
 * ordinaire — huit répétitions autour de 75 % — ne doit RIEN changer à ce que
 * le mannequin disait déjà. Tout le réglage existant a été calibré sur des
 * séances comme celles-là ; si elles se mettaient à bouger, c'est le barème
 * entier qu'il faudrait refaire. Seuls les extrêmes déplacent la ligne.
 */
const PART_PLANCHER = 0.3
const PART_PIVOT = 0.78

export function facteurEffort(
  e: { name: string; reps: string; weight_kg: number | null },
  poidsCorps: number | null,
  references: Map<string, number>,
): number {
  // Sans poids de corps, on ne sait rien : le mannequin garde son barème.
  if (!poidsCorps || poidsCorps <= 0) return 1
  if (repsChargeables(e) === null) return 1
  const charge = chargeTotale(e, poidsCorps)
  if (charge <= 0) return 1

  const ref = references.get(e.name.trim().toLowerCase()) ?? 0
  // Exercice absent de la fenêtre de référence — une séance plus vieille que
  // l'historique chargé. On ne devine pas : facteur neutre.
  if (ref <= 0) return 1

  const part = charge / ref
  const facteur =
    EFFORT_MIN + ((part - PART_PLANCHER) / (PART_PIVOT - PART_PLANCHER)) * (1 - EFFORT_MIN)
  return Math.max(EFFORT_MIN, Math.min(EFFORT_MAX, facteur))
}
