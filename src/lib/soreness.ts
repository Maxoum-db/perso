import { fetchKv, saveKv } from './kv'
import type { GroupLoad } from './muscu'

// Courbatures déclarées à la main. Le calcul automatique part de l'intensité de
// l'exercice, mais certains jours ça tire beaucoup plus que prévu : on ajoute
// alors du temps de récupération sur le groupe concerné.
//
// La déclaration est rattachée à la séance qui l'a provoquée (sa date). Dès que
// le groupe est retravaillé, l'ancienne déclaration ne s'applique plus — sinon
// elle collerait au muscle indéfiniment.

export interface Courbature {
  /** Jours de récupération ajoutés. */
  extra: number
  /** Date de la séance qui a provoqué ces courbatures (YYYY-MM-DD). */
  lastWorked: string
}

export type Courbatures = Record<string, Courbature>

const KEY = 'muscu_courbatures'

export const PALIERS = [1, 2, 3] as const

export async function loadCourbatures(userId: string): Promise<Courbatures> {
  const c = await fetchKv<Courbatures>(userId, KEY, {})
  return c && typeof c === 'object' ? c : {}
}

export async function saveCourbatures(userId: string, c: Courbatures): Promise<void> {
  await saveKv(userId, KEY, c)
}

/** Date de la séance à l'origine d'une charge : aujourd'hui moins ses jours. */
export function dateDeLaSeance(load: GroupLoad): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - load.days)
  return d.toLocaleDateString('en-CA')
}

/**
 * Applique les courbatures déclarées : le muscle est traité comme s'il avait été
 * travaillé plus récemment, donc il reste rouge plus longtemps. Les
 * déclarations devenues obsolètes (groupe retravaillé depuis) sont ignorées.
 */
export function applyCourbatures(
  loads: Record<string, GroupLoad>,
  courbatures: Courbatures,
): Record<string, GroupLoad> {
  const out: Record<string, GroupLoad> = {}
  for (const [group, load] of Object.entries(loads)) {
    const c = courbatures[group]
    if (!c || c.extra <= 0 || c.lastWorked !== dateDeLaSeance(load)) {
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
