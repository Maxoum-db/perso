import { fetchKv, saveKv } from './kv'
import type { GroupLoad } from './muscu'
import { SEUIL_PRET, VITESSE_MIN } from './recuperation'

// Ajustement du ressenti, déclaré à la main.
//
// Le calcul automatique part de l'intensité de l'exercice. Il se trompe dans les
// deux sens : certains jours ça tire beaucoup plus que prévu, d'autres le muscle
// est déjà frais alors que le barème le donne encore en récupération. On corrige
// donc dans les deux directions — du retard en plus, ou de l'avance.
//
// La déclaration est rattachée à la séance qui l'a provoquée (sa date). Dès que
// le groupe est retravaillé, l'ancienne déclaration ne s'applique plus — sinon
// elle collerait au muscle indéfiniment.

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

export type Courbatures = Record<string, Courbature>

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
 * Jours ressentis posés par « totalement bon ».
 *
 * Déduit du barème et non écrit en dur : il faut que même la zone la plus lente
 * (la coiffe des rotateurs, ×0,6) franchisse le seuil de « prêt ». Une valeur
 * figée deviendrait fausse à la première retouche des vitesses — et fausse dans
 * le mauvais sens, en affichant « prêt » un muscle qui ne l'est pas.
 */
export const JOURS_TOTALEMENT_BON = SEUIL_PRET / VITESSE_MIN

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
  const c = await fetchKv<Courbatures>(userId, KEY, {})
  return c && typeof c === 'object' ? c : {}
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
  group: string,
  extra: number,
  load: GroupLoad,
): Courbatures {
  const next = { ...courbatures }
  if (extra === 0) delete next[group]
  else next[group] = { extra, lastWorked: dateDeLaSeance(load) }
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
  group: string,
  pret: boolean,
  load: GroupLoad,
): Courbatures {
  const next = { ...courbatures }
  if (pret) next[group] = { extra: 0, lastWorked: dateDeLaSeance(load), pret: true }
  else delete next[group]
  return next
}

/**
 * Applique l'ajustement déclaré.
 *
 * Positif, le muscle est traité comme s'il avait été travaillé plus récemment :
 * il reste rouge plus longtemps. Négatif, il avance — la même soustraction
 * marche dans les deux sens. Les déclarations devenues obsolètes (groupe
 * retravaillé depuis) sont ignorées.
 */
export function applyCourbatures(
  loads: Record<string, GroupLoad>,
  courbatures: Courbatures,
): Record<string, GroupLoad> {
  const out: Record<string, GroupLoad> = {}
  for (const [group, load] of Object.entries(loads)) {
    const c = courbatures[group]
    const perimee = !c || c.lastWorked !== dateDeLaSeance(load)
    // `=== 0` et non `<= 0` : c'est ce test qui bloquait les valeurs négatives.
    if (perimee || (c!.extra === 0 && !c!.pret)) {
      out[group] = load
      continue
    }
    // « Totalement bon » l'emporte sur tout, plafond orange compris. Ce plafond
    // existe pour empêcher le barème de sauter du rouge au vert tout seul ; il
    // n'a pas à t'empêcher, toi, de dire ce que tu ressens. C'est la seule
    // déclaration qui prime sur le calcul au lieu de le corriger.
    if (c!.pret) {
      out[group] = {
        ...load,
        effectiveDays: Math.max(load.effectiveDays, JOURS_TOTALEMENT_BON),
        effectiveDaysPrevus: load.effectiveDays,
        sorePret: true,
      }
      continue
    }
    out[group] = {
      ...load,
      effectiveDays: Math.max(0, load.effectiveDays - c!.extra),
      // Ce que le barème disait avant ta correction : on le garde tel quel, la
      // base d'observations en a besoin exact et le plancher à 0 ci-dessus rend
      // le calcul inverse impossible.
      effectiveDaysPrevus: load.effectiveDays,
      soreExtra: c!.extra,
    }
  }
  return out
}
