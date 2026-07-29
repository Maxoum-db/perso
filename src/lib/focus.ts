import { fetchKv, saveKv } from './kv'
import type { MuscleRegion } from './muscles'

// Priorité du moment : le point faible qu'on veut rattraper. Elle pèse dans le
// générateur de séance (score et place réservée) et dans l'alerte des muscles
// négligés, qui devient plus impatiente sur ces muscles-là.

export type FocusId = 'core' | 'prehension' | 'cou' | 'jambes' | 'haut' | 'recup' | 'aucun'

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
  /**
   * Cas à part : il ne vise pas un muscle mais un ÉTAT. Le générateur bascule
   * alors en mode récupération — il ne compose plus avec des exercices de
   * force, mais avec des étirements et de la mobilité, et il vise justement
   * les muscles encore courbaturés au lieu de les éviter.
   */
  recup: {
    label: 'Passer les courbatures',
    emoji: '🧊',
    regions: [],
  },
  aucun: {
    label: 'Aucune',
    emoji: '⚖️',
    regions: [],
  },
}

export const FOCUS_IDS: FocusId[] = ['core', 'prehension', 'cou', 'jambes', 'haut', 'recup', 'aucun']

/**
 * Le point faible déclaré par défaut. La ceinture abdominale est ce qui limite
 * le plus en armure : sans elle, la force des jambes ne remonte pas aux bras.
 */
export const FOCUS_PAR_DEFAUT: FocusId = 'core'

/** Le focus « récupération » change le mode du générateur, pas sa pondération. */
export const FOCUS_RECUP: FocusId = 'recup'

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
