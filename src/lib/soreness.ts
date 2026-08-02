import { fetchKv, saveKv } from './kv'
import type { GroupLoad } from './muscu'
import { MUSCLE_LABELS, regionsForGroup, type MuscleRegion } from './muscles'

// Ajustement du ressenti, déclaré à la main.
//
// Le calcul automatique part de l'intensité de l'exercice. Il se trompe dans les
// deux sens : certains jours ça tire beaucoup plus que prévu, d'autres le muscle
// est déjà frais alors que le barème le donne encore en récupération. On corrige
// donc dans les deux directions — du retard en plus, ou de l'avance.
//
// La déclaration est rattachée à la séance qui l'a provoquée (sa date). Dès que
// le muscle est retravaillé, l'ancienne déclaration ne s'applique plus — sinon
// elle collerait au muscle indéfiniment.
//
// ── Indexé par MUSCLE, et non par libellé de groupe ─────────────────────────
//
// C'était l'inverse, et ça donnait ceci : une marche du fermier s'enregistre
// sur un libellé large, le cou tire deux jours de plus que prévu, on touche le
// cou sur le mannequin pour le dire — et les vingt-cinq autres muscles couverts
// par le même libellé prenaient les deux jours avec lui. La déclaration
// décrivait donc un muscle et corrigeait une séance entière.
//
// Le muscle est la bonne maille parce que c'est celle du ressenti : on n'a pas
// « des courbatures au full body », on en a au cou. La correction est appliquée
// dans `reposParMuscle`, seul endroit où les muscles existent vraiment.

export interface Courbature {
  /**
   * Jours de récupération ajoutés. NÉGATIF quand le muscle va mieux que prévu :
   * la soustraction dans applyCourbatures fait alors avancer le muscle.
   */
  extra: number
  /** Date de la séance concernée (YYYY-MM-DD). */
  lastWorked: string
  /**
   * « C'est totalement bon » : le muscle est déclaré prêt, point.
   *
   * Ce n'est PAS un point de la barre, et c'est pourquoi c'est un champ à part.
   * La barre corrige le barème d'une ou deux crans ; ceci le court-circuite. Un
   * muscle peut être frais deux jours après une grosse séance sans qu'aucune
   * valeur de −1 j ne suffise à le dire, et t'obliger à tirer une barre jusqu'à
   * une borne qui ne suffit pas serait mentir sur ce que tu ressens.
   */
  pret?: boolean
}

export type Courbatures = Partial<Record<MuscleRegion, Courbature>>

const KEY = 'muscu_courbatures'

/**
 * Bornes de l'ajustement, au pas de 12 h du mannequin.
 *
 * Asymétrique à dessein : des courbatures peuvent coûter trois jours de plus,
 * alors qu'aller « mieux que prévu » ne fait gagner qu'une journée. Se tromper
 * en s'accordant du repos ne coûte rien ; se tromper en retournant à la salle
 * trop tôt, si.
 */
export const AJUST_MIN = -1
export const AJUST_MAX = 3
export const AJUST_PAS = 0.5


/**
 * « +12 h », « −1 j », « +2 j ½ » — un ajustement se lit signé, sans quoi on ne
 * sait pas si le muscle a pris du retard ou de l'avance.
 *
 * Ici et pas dans le mannequin : l'intensité déclarée d'une séance décale la
 * récupération du même nombre de jours, et deux formateurs pour la même unité
 * finiraient par ne plus dire la même chose.
 */
export function fmtAjust(jours: number): string {
  const signe = jours < 0 ? '−' : '+'
  const abs = Math.abs(jours)
  if (abs < 1) return `${signe}${Math.round(abs * 24)} h`
  const pleins = Math.floor(abs)
  return `${signe}${pleins} j${abs - pleins >= AJUST_PAS ? ' ½' : ''}`
}

export async function loadCourbatures(userId: string): Promise<Courbatures> {
  const c = await fetchKv<Record<string, Courbature>>(userId, KEY, {})
  return c && typeof c === 'object' ? migrerCourbatures(c) : {}
}

/**
 * Convertit les déclarations enregistrées avant le passage au muscle.
 *
 * Les anciennes sont indexées par libellé de groupe : on les éclate sur les
 * muscles que le libellé couvre. C'est le seul report fidèle possible — on ne
 * sait pas lequel de ces muscles était réellement visé, et les répartir tous
 * reproduit exactement ce que l'ancienne version affichait. Elles s'effaceront
 * d'elles-mêmes à la prochaine séance qui touche ces muscles.
 *
 * Deux libellés peuvent retomber sur le même muscle avec des valeurs
 * différentes ; on garde la plus prudente, c'est-à-dire le plus de repos. Se
 * tromper en s'accordant du repos ne coûte rien, l'inverse si — la même règle
 * qui rend les bornes de l'ajustement asymétriques.
 */
export function migrerCourbatures(brut: Record<string, Courbature>): Courbatures {
  const out: Courbatures = {}
  const poser = (region: MuscleRegion, c: Courbature) => {
    const cur = out[region]
    // « Totalement bon » est la déclaration la MOINS prudente : un vrai
    // ajustement chiffré, même négatif, l'emporte sur elle.
    const poids = (x: Courbature) => (x.pret ? -Infinity : x.extra)
    if (!cur || poids(c) > poids(cur)) out[region] = c
  }
  for (const [cle, c] of Object.entries(brut)) {
    if (!c || typeof c.extra !== 'number' || typeof c.lastWorked !== 'string') continue
    if (cle in MUSCLE_LABELS) poser(cle as MuscleRegion, c)
    else for (const region of regionsForGroup(cle)) poser(region, c)
  }
  return out
}

export async function saveCourbatures(userId: string, c: Courbatures): Promise<void> {
  await saveKv(userId, KEY, c)
}

/**
 * Date de la séance à l'origine d'une charge. Elle est portée par la charge
 * elle-même : depuis le passage au pas de 12 h, la déduire d'« aujourd'hui
 * moins ses jours » tomberait à côté dès que l'ancienneté porte une demi-journée.
 */
export function dateDeLaSeance(load: GroupLoad): string {
  return load.date
}

/**
 * Pose ou retire la déclaration d'un groupe.
 *
 * Le zéro est le SEUL cas qui efface : c'est lui qui veut dire « pas de
 * déclaration, barème automatique ». Une valeur négative est une déclaration
 * comme une autre — « ça va mieux que prévu ».
 *
 * La règle vivait dans la page, où elle avait déjà divergé de `applyCourbatures`
 * en interdisant tout ce qui était ≤ 0 : la barre restait bloquée au milieu,
 * impossible de la tirer vers −1 j. Une seule définition, ici, pour les deux.
 */
export function declarerAjustement(
  courbatures: Courbatures,
  region: MuscleRegion,
  extra: number,
  dateSeance: string,
): Courbatures {
  const next = { ...courbatures }
  if (extra === 0) delete next[region]
  else next[region] = { extra, lastWorked: dateSeance }
  return next
}

/**
 * Pose ou retire « totalement bon ».
 *
 * Poser efface l'ajustement chiffré : les deux répondent à la même question et
 * garder les deux laisserait un `extra` fantôme réapparaître le jour où tu
 * retires « totalement bon ».
 */
export function declarerPret(
  courbatures: Courbatures,
  region: MuscleRegion,
  pret: boolean,
  dateSeance: string,
): Courbatures {
  const next = { ...courbatures }
  if (pret) next[region] = { extra: 0, lastWorked: dateSeance, pret: true }
  else delete next[region]
  return next
}

/**
 * Rattache à chaque charge les déclarations qui la concernent, muscle par muscle.
 *
 * Ne calcule rien : c'est un aiguillage. La correction elle-même est appliquée
 * dans `reposParMuscle`, parce qu'elle porte sur UN muscle et qu'à ce stade on
 * n'a encore que des libellés de groupe — un libellé en couvre jusqu'à
 * trente-huit, et corriger ici les aurait tous corrigés ensemble. C'est
 * exactement le défaut qu'on répare.
 *
 * Le tri des déclarations périmées reste ici, une fois : dès que le muscle est
 * retravaillé, la date ne correspond plus et la déclaration ne descend pas.
 */
export function rattacherCourbatures(
  loads: Record<string, GroupLoad>,
  courbatures: Courbatures,
): Record<string, GroupLoad> {
  // La séance la plus récente qui a touché chaque muscle. C'est à ELLE que la
  // déclaration doit se rapporter pour compter encore.
  //
  // Comparer à la seule charge qu'on est en train de traiter ne suffisait pas :
  // un muscle est souvent couvert par deux libellés à la fois (une marche du
  // fermier notée « Corps entier », puis des haussements d'épaules notés
  // « Cou »). La déclaration restait accrochée à la vieille charge, qui gagnait
  // ensuite le tri de `reposParMuscle` — un ressenti d'avant-hier continuait
  // donc de décrire un muscle travaillé ce matin.
  const derniere: Partial<Record<MuscleRegion, { jours: number; date: string }>> = {}
  for (const [group, load] of Object.entries(loads)) {
    for (const region of regionsForGroup(group)) {
      const cur = derniere[region]
      if (!cur || load.days < cur.jours) derniere[region] = { jours: load.days, date: load.date }
    }
  }

  const out: Record<string, GroupLoad> = {}
  for (const [group, load] of Object.entries(loads)) {
    const pour: Courbatures = {}
    let une = false
    for (const region of regionsForGroup(group)) {
      const c = courbatures[region]
      if (!c) continue
      // `=== 0` et non `<= 0` : c'est ce test qui bloquait les valeurs négatives.
      if (c.extra === 0 && !c.pret) continue
      if (c.lastWorked !== derniere[region]?.date) continue // périmée : muscle retravaillé depuis
      if (c.lastWorked !== dateDeLaSeance(load)) continue // pas la charge qui l'a provoquée
      pour[region] = c
      une = true
    }
    out[group] = une ? { ...load, courbatures: pour } : load
  }
  return out
}

