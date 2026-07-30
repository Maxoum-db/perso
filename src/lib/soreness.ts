import { fetchKv, saveKv } from './kv'
import type { GroupLoad } from './muscu'

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
    // `=== 0` et non `<= 0` : c'est ce test qui bloquait les valeurs négatives.
    if (!c || c.extra === 0 || c.lastWorked !== dateDeLaSeance(load)) {
      out[group] = load
      continue
    }
    out[group] = {
      ...load,
      effectiveDays: Math.max(0, load.effectiveDays - c.extra),
      soreExtra: c.extra,
    }
  }
  return out
}
