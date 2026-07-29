import { fetchKv, saveKv } from './kv'
import type { MuscleRegion } from './muscles'

// Priorité du moment : le point faible qu'on veut rattraper. Elle pèse dans le
// générateur de séance (score et place réservée) et dans l'alerte des muscles
// négligés, qui devient plus impatiente sur ces muscles-là.

export type FocusId = 'core' | 'prehension' | 'cou' | 'jambes' | 'haut' | 'aucun'

export interface Focus {
  label: string
  emoji: string
  regions: MuscleRegion[]
}

export const FOCUS: Record<FocusId, Focus> = {
  core: {
    label: 'Ceinture abdominale',
    emoji: '🌀',
    regions: ['rectus', 'obliques', 'erectors', 'serratus'],
  },
  prehension: {
    label: 'Préhension',
    emoji: '✊',
    regions: ['forearmFlex', 'forearmExt'],
  },
  cou: {
    label: 'Cou & trapèzes',
    emoji: '🪖',
    regions: ['neck', 'trapsUpper'],
  },
  jambes: {
    label: 'Jambes',
    emoji: '🦵',
    regions: ['gluteMax', 'gluteMed', 'vastusLat', 'vastusMed', 'bicepsFemoris', 'hamsInner'],
  },
  haut: {
    label: 'Haut du corps',
    emoji: '💪',
    regions: ['pecUpper', 'pecLower', 'lats', 'deltAnt', 'deltLat', 'deltPost', 'trapsMid'],
  },
  aucun: {
    label: 'Aucune',
    emoji: '⚖️',
    regions: [],
  },
}

export const FOCUS_IDS: FocusId[] = ['core', 'prehension', 'cou', 'jambes', 'haut', 'aucun']

/**
 * Le point faible déclaré par défaut. La ceinture abdominale est ce qui limite
 * le plus en armure : sans elle, la force des jambes ne remonte pas aux bras.
 */
export const FOCUS_PAR_DEFAUT: FocusId = 'core'

/** Multiplicateur de score appliqué aux muscles du focus. */
export const POIDS_FOCUS = 1.8

const FOCUS_KEY = 'muscu_focus'

export async function loadFocus(userId: string): Promise<FocusId> {
  const id = await fetchKv<FocusId>(userId, FOCUS_KEY, FOCUS_PAR_DEFAUT)
  return id in FOCUS ? id : FOCUS_PAR_DEFAUT
}

export async function saveFocus(userId: string, id: FocusId): Promise<void> {
  await saveKv(userId, FOCUS_KEY, id)
}
