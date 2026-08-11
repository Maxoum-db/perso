import { distanceEnMetres, repsPourTonnage } from './muscu'

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
 * Part du poids du corps réellement déplacée, par famille de mouvement.
 *
 * ⚠️ Cette table est la SEULE définition de « ce mouvement porte le corps ».
 *
 * Elle était auparavant filtrée par `isBodyweightExercise`, qui répond à une
 * tout autre question — « cet exercice se fait-il sans charge par défaut ? ».
 * Les deux listes ne se recouvraient pas, et la plus étroite gagnait : 37
 * exercices où le corps est bel et bien porté comptaient pour zéro, dont TOUS
 * les squats et toutes les fentes. Une fente marchée avec deux kettlebells de
 * 12 kg pesait 24 kg pour quelqu'un de 102 kg, au lieu de 111.
 *
 * Le fonctionnement est volontairement en LISTE BLANCHE : un mouvement absent
 * de la table ne porte rien. Une règle large aurait fini par donner du poids de
 * corps à un développé couché — où le corps repose sur le banc — ou à un curl.
 *
 * Les fractions sont les ordres de grandeur admis en biomécanique pour les
 * appuis correspondants : une traction déplace tout le corps, une pompe environ
 * les deux tiers (le reste porte sur les mains et les pieds), un squat un peu
 * moins que tout — les jambes ne se portent pas elles-mêmes.
 *
 * L'ordre des entrées compte : le premier motif qui correspond gagne.
 */
const PART_DU_CORPS: Array<[RegExp, number]> = [
  // Le corps pend tout entier aux bras.
  [/traction|suspension|dead hang|muscle-?up|escalade|bloc|chaise romaine — relevés|barre fixe/i, 1.0],
  [/\bdips\b/i, 0.9],
  // Sauts et déplacements : tout le corps est projeté.
  [/burpee|saut|sprint|grimpeur|corde à sauter|montée de genoux/i, 0.9],
  // Appuis pieds-mains : une part passe au sol.
  [/pompe|planche dynamique|renegade|poussée dentelé|pompe scapulaire/i, 0.68],
  // Unipodal : une jambe porte tout le reste, et c'est ce qui les rend durs.
  [/fente|montée sur banc|step-?up|bulgare|pistol|unipodal|talons|marche sur les/i, 0.85],
  // Squats : le tronc et les bras montent avec la barre. Vaut aussi barre vide.
  [/squat|chaise|soulevé de terre|hip thrust|poussée de hanches|pont fessier/i, 0.85],
  // Le hack squat couche le corps sur un chariot : il en porte encore une part,
  // mais l'appui dorsal en reprend le reste. La presse à cuisses, elle, ne
  // déplace que les jambes — elle n'est pas dans la table, donc elle ne porte
  // rien, ce qui est exact.
  [/hack squat/i, 0.6],
  // Le relevé turc emmène le corps du sol à debout, en plus de la charge.
  [/relevé turc/i, 0.5],
  // Gainages : le corps est tenu, pas déplacé. Sans effet sur le facteur
  // d'effort — ils se comptent au temps — mais la pastille « PDC » de l'écran
  // doit quand même dire ce qu'on porte.
  [/gainage|planche|deadbug|bird-?dog|hollow|superman|pont cervical|bateau/i, 0.55],
  // Le tronc ou les jambes seuls.
  [/relevé.* de jambes|relevés de jambes|crunch|rotation russe|rotations russes|roulette|genoux suspendu/i, 0.4],
]

/**
 * Ce que la MACHINE reprend à ta place.
 *
 * Une poulie, un élastique ou une machine assistée fournit la résistance ou
 * ALLÈGE le corps : dans les deux cas le poids du corps n'est plus ce qui est
 * déplacé. Vérifié avant la table, sinon « crunch à la poulie haute » toucherait
 * la règle des crunchs et « traction assistée » celle des tractions — c'est-à-
 * dire exactement l'inverse de ce que fait la machine.
 */
const PORTE_PAR_LA_MACHINE = /assist|à la machine|\(machine\)|poulie|élastique|presse à cuisses/i

export function partDuCorps(nom: string): number {
  // Le hack squat porte « machine » dans son nom sans rien reprendre au corps :
  // on est couché SUR le chariot, pas soulagé par lui.
  if (PORTE_PAR_LA_MACHINE.test(nom) && !/hack squat/i.test(nom)) return 0
  return PART_DU_CORPS.find(([re]) => re.test(nom))?.[1] ?? 0
}

/**
 * Le poids du corps réellement déplacé par cet exercice, en kilos.
 *
 * C'est la valeur de la pastille « PDC » sur la ligne de séance : déjà remplie,
 * jamais à saisir. Zéro — donc pas de pastille — quand le corps ne bouge pas :
 * développé couché, curl, machine.
 */
export function poidsDuCorpsPorte(nom: string, poidsCorps: number | null): number {
  if (!poidsCorps || poidsCorps <= 0) return 0
  return Math.round(partDuCorps(nom) * poidsCorps * 10) / 10
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
  const ajoute = typeof e.weight_kg === 'number' && e.weight_kg > 0 ? e.weight_kg : 0
  return poidsDuCorpsPorte(e.name, poidsCorps) + ajoute
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
