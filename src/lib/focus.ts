import { fetchKv, saveKv } from './kv'
import type { MuscleRegion } from '../components/MuscleBodyDiagram'

// Priorité du moment : le point faible qu'on veut rattraper. Elle pèse dans le
// générateur de séance (score et place réservée) et dans l'alerte des muscles
// négligés, qui devient plus impatiente sur ces muscles-là.

export type FocusId = 'core' | 'prehension' | 'cou' | 'jambes' | 'haut' | 'aucun'

export interface Focus {
  label: string
  emoji: string
  regions: MuscleRegion[]
  /** Comment travailler ce point faible — affiché sous le sélecteur. */
  conseil: string
}

export const FOCUS: Record<FocusId, Focus> = {
  core: {
    label: 'Ceinture abdominale',
    emoji: '🌀',
    regions: ['rectus', 'obliques', 'erectors', 'serratus'],
    conseil:
      'Avec une antéversion du bassin et des érecteurs déjà forts, le gainage anti-extension (deadbug, hollow, roulette) vaut mieux que les crunchs : c’est le contrôle du bassin qui manque, pas la force en flexion. Vise 3 séances par semaine, en fin de séance.',
  },
  prehension: {
    label: 'Préhension',
    emoji: '✊',
    regions: ['forearmFlex', 'forearmExt'],
    conseil:
      'La poigne récupère vite : elle supporte 3 à 4 passages par semaine. Alterne serrage (anneau, suspension) et port lourd (marche du fermier), et compense avec des extensions de poignets.',
  },
  cou: {
    label: 'Cou & trapèzes',
    emoji: '🪖',
    regions: ['neck', 'trapsUpper'],
    conseil:
      'Progresse très lentement en durée et en charge sur la nuque, jamais en à-coups. Deux séances par semaine suffisent — c’est de la prévention de commotion, pas de la performance.',
  },
  jambes: {
    label: 'Jambes',
    emoji: '🦵',
    regions: ['gluteMax', 'gluteMed', 'vastusLat', 'vastusMed', 'bicepsFemoris', 'hamsInner'],
    conseil:
      'Avec la dysplasie rotulienne, privilégie le vaste médial et le moyen fessier (stabilisation) avant la charge pure, et garde le lourd à au moins 48 h du béhourd.',
  },
  haut: {
    label: 'Haut du corps',
    emoji: '💪',
    regions: ['pecUpper', 'pecLower', 'lats', 'deltAnt', 'deltLat', 'deltPost', 'trapsMid'],
    conseil:
      'Épaule AC droite : privilégie les prises neutres et les amplitudes courtes au-dessus de la ligne d’épaule, et compense chaque poussée par un tirage.',
  },
  aucun: {
    label: 'Aucune',
    emoji: '⚖️',
    regions: [],
    conseil: 'Séances équilibrées : le générateur suit uniquement la récupération et la priorité béhourd.',
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
