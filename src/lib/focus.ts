import { fetchKv, saveKv } from './kv'
import type { MuscleRegion } from './muscles'

// Priorité du moment : le point faible qu'on veut rattraper. Elle pèse dans le
// générateur de séance (score et place réservée) et dans l'alerte des muscles
// négligés, qui devient plus impatiente sur ces muscles-là.

export type FocusId = 'core' | 'prehension' | 'cou' | 'dos' | 'jambes' | 'haut' | 'recup'

export interface Focus {
  label: string
  emoji: string
  regions: MuscleRegion[]
}

export const FOCUS: Record<FocusId, Focus> = {
  core: {
    label: 'Ceinture abdominale',
    emoji: '🌀',
    regions: ['rectus', 'obliques', 'transversus', 'erectors', 'multifidus', 'quadratusLumborum', 'serratus'],
  },
  prehension: {
    label: 'Préhension',
    emoji: '✊',
    regions: ['fingerFlex', 'forearmFlex', 'forearmExt', 'brachioradialis', 'pronators'],
  },
  cou: {
    label: 'Cou & trapèzes',
    emoji: '🪖',
    regions: ['neck', 'neckExt', 'scalenes', 'levator', 'trapsUpper'],
  },
  /**
   * Plus étroit que « Haut du corps », qui noie le dos au milieu des pectoraux,
   * des épaules et des bras : y mettre la priorité ne garantissait pas un seul
   * tirage. Ici, seuls les muscles qui tirent et qui tiennent l'omoplate.
   */
  dos: {
    label: 'Dos',
    emoji: '🔙',
    regions: ['lats', 'teres', 'rhomboids', 'trapsMid', 'trapsLow', 'trapsUpper', 'deltPost',
      'erectors', 'multifidus', 'rotatorCuff', 'teresMinor', 'levator'],
  },
  jambes: {
    label: 'Jambes',
    emoji: '🦵',
    regions: ['gluteMax', 'gluteMed', 'hipRotators', 'vastusLat', 'vastusMed', 'rectusFemoris', 'bicepsFemoris', 'hamsInner', 'adductors', 'gracilis', 'tfl', 'hipFlexors', 'gastroc', 'soleus', 'tibialis', 'tibPost', 'fibularis'],
  },
  haut: {
    label: 'Haut du corps',
    emoji: '💪',
    regions: ['pecUpper', 'pecLower', 'pecMinor', 'lats', 'teres', 'deltAnt', 'deltLat', 'deltPost', 'trapsMid', 'trapsLow', 'rhomboids', 'serratus', 'rotatorCuff', 'supraspinatus', 'teresMinor', 'subscapularis', 'biceps', 'brachialis', 'coracobrachialis', 'tricepsLong', 'tricepsLat'],
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
}

export const FOCUS_IDS: FocusId[] = ['core', 'prehension', 'cou', 'dos', 'jambes', 'haut', 'recup']

/**
 * Nombre de points faibles simultanés.
 *
 * Deux : au-delà, « point faible » ne veut plus rien dire — quatre groupes
 * prioritaires dans une séance de six exercices, c'est une séance sans priorité.
 */
export const FOCUS_MAX = 2

/**
 * La seule entrée qui ne se cumule avec rien.
 *
 * « Passer les courbatures » ne désigne pas un groupe mais un ÉTAT : il fait
 * basculer le générateur en mode récupération, où la notion de point faible n'a
 * plus cours.
 *
 * « Aucune » a disparu de la liste : décocher son dernier point faible SUFFIT à
 * dire qu'on n'en a pas. Une case pour dire « rien » à côté de cases qu'on peut
 * toutes décocher, c'était deux façons d'exprimer la même chose.
 */
export const FOCUS_EXCLUSIFS: FocusId[] = ['recup']

export function estExclusif(id: FocusId): boolean {
  return FOCUS_EXCLUSIFS.includes(id)
}

/**
 * Ajoute ou retire un point faible de la sélection.
 *
 * Trois règles : un choix exclusif remplace tout ; ajouter un groupe chasse les
 * exclusifs ; et au-delà de FOCUS_MAX, c'est le plus ancien qui part — refuser
 * le clic obligerait à décocher avant de cocher, pour rien.
 */
export function basculerFocus(actuels: FocusId[], id: FocusId): FocusId[] {
  if (estExclusif(id)) return [id]
  const sans = actuels.filter((x) => x !== id && !estExclusif(x))
  // Décocher le dernier laisse la sélection VIDE : c'est ainsi qu'on dit
  // « aucun point faible » depuis que la case « Aucune » n'existe plus.
  if (actuels.includes(id)) return sans
  return [...sans, id].slice(-FOCUS_MAX)
}

/**
 * Les muscles visés par la sélection, tous groupes confondus.
 *
 * Tolère un identifiant seul, et ignore ce qu'elle ne connaît pas. Le format est
 * passé d'une chaîne à une liste : une chaîne parcourue avec `for…of` rend ses
 * LETTRES, donc `FOCUS['c']` — un plantage à l'exécution là où on attendrait
 * simplement l'ancien comportement. Une donnée du KV écrite avant la migration
 * n'a pas à faire tomber l'écran.
 */
export function regionsDuFocus(ids: FocusId[] | FocusId): Set<MuscleRegion> {
  const liste = Array.isArray(ids) ? ids : [ids]
  const out = new Set<MuscleRegion>()
  for (const id of liste) for (const r of FOCUS[id]?.regions ?? []) out.add(r)
  return out
}

/** Vrai dès qu'un des points faibles choisis est le mode récupération. */
export function estModeRecup(ids: FocusId[] | FocusId): boolean {
  return Array.isArray(ids) ? ids.includes(FOCUS_RECUP) : ids === FOCUS_RECUP
}

/**
 * Le point faible déclaré par défaut. La ceinture abdominale est ce qui limite
 * le plus en armure : sans elle, la force des jambes ne remonte pas aux bras.
 */
export const FOCUS_PAR_DEFAUT: FocusId = 'core'

/** Le focus « récupération » change le mode du générateur, pas sa pondération. */
export const FOCUS_RECUP: FocusId = 'recup'

/**
 * Multiplicateur de score appliqué aux muscles du focus.
 *
 * 2,6 et non 1,8 : à 1,8 un exercice de gainage perdait encore contre n'importe
 * quel polyarticulaire qui touche cinq muscles au passage. Le focus est un choix
 * explicite, il doit peser plus qu'une somme de sollicitations accessoires.
 */
export const POIDS_FOCUS = 2.6

/**
 * Part de la séance réservée au focus.
 *
 * Le multiplicateur seul ne suffit pas — il agit sur un classement, donc un
 * exercice qui ne vise qu'un ou deux muscles reste battu par un mouvement large.
 * On garantit donc des places : 40 % de la séance, soit trois exercices sur six.
 */
export const PART_FOCUS = 0.4

/**
 * Part réservée quand DEUX groupes sont visés.
 *
 * Plus large, sinon les deux se partageraient les trois places d'un seul et
 * chacun n'en aurait qu'une et demie — autant n'en choisir qu'un. Quatre
 * exercices sur six, deux par groupe.
 */
export const PART_FOCUS_DOUBLE = 0.6

/** Places réservées au point faible, selon le nombre de groupes visés. */
export function placesFocus(count: number, nbGroupes: number): number {
  if (nbGroupes === 0) return 0
  const part = nbGroupes >= 2 ? PART_FOCUS_DOUBLE : PART_FOCUS
  return Math.max(nbGroupes + 1, Math.ceil(count * part))
}

/**
 * Nombre maximal d'exercices sur un même muscle du focus.
 *
 * La règle générale en autorise deux, ce qui empêche justement de « marquer » un
 * groupe. Sur le focus, on monte à trois : c'est la différence entre une séance
 * équilibrée qui l'effleure et une séance qui le vise.
 */
export const MAX_USAGE_FOCUS = 3

/**
 * Places réservées aux priorités béhourd en mode spécial, en part de la séance.
 *
 * Un tiers, contre une ou deux places fixes hors mode. Avec 40 % pour le point
 * faible, il reste de quoi composer : les deux réserves se recouvrent largement —
 * la ceinture abdominale est à la fois un focus et une priorité béhourd — et la
 * réserve béhourd ne prend que des muscles que la séance n'a pas encore touchés.
 */
export const PART_BEHOURD = 1 / 3

/**
 * Fraîcheur exigée pour qu'une place béhourd se déclenche.
 *
 * 5 jours ressentis hors mode spécial : on ne réservait une place au cou que
 * s'il était franchement disponible. En mode spécial on descend à 3 — « bientôt
 * prêt » —, sinon la case ne changerait presque jamais rien, ces muscles étant
 * sollicités par à peu près tout.
 */
export const REPOS_BEHOURD = 5
export const REPOS_BEHOURD_SPECIAL = 3

const FOCUS_KEY = 'muscu_focus'
const BEHOURD_KEY = 'muscu_behourd'

/**
 * Les points faibles enregistrés.
 *
 * Le format a changé — une chaîne autrefois, une liste maintenant. On accepte les
 * deux en lecture : sans ça, ton réglage se serait silencieusement remis sur la
 * valeur par défaut au premier chargement.
 */
export async function loadFocus(userId: string): Promise<FocusId[]> {
  const v = await fetchKv<FocusId | FocusId[]>(userId, FOCUS_KEY, [FOCUS_PAR_DEFAUT])
  const liste = Array.isArray(v) ? v : [v]
  const valides = liste.filter((id) => typeof id === 'string' && id in FOCUS)
  // Une liste vide reste vide : c'est « aucun point faible », et c'est aussi ce
  // que devient l'ancien réglage « Aucune » une fois filtré. La remettre sur la
  // valeur par défaut aurait changé son choix dans son dos. Le défaut ne
  // s'applique qu'à une clé ABSENTE, ce dont `fetchKv` se charge déjà.
  // Un exclusif dans la liste l'emporte : c'est la seule combinaison qui n'a pas
  // de sens, et une valeur écrite à la main pourrait la produire.
  const exclusif = valides.find(estExclusif)
  return exclusif ? [exclusif] : valides.slice(0, FOCUS_MAX)
}

export async function saveFocus(userId: string, ids: FocusId[]): Promise<void> {
  await saveKv(userId, FOCUS_KEY, ids)
}

// ── Mode béhourd ────────────────────────────────────────────────────────────
// Indépendant du point faible, et cumulable avec lui : le point faible dit QUEL
// groupe pousser, le mode béhourd dit POUR QUOI on s'entraîne. Les priorités
// béhourd pèsent déjà en fond de tableau ; la case les fait passer au premier
// plan.

export async function loadBehourd(userId: string): Promise<boolean> {
  return (await fetchKv<boolean>(userId, BEHOURD_KEY, false)) === true
}

export async function saveBehourd(userId: string, on: boolean): Promise<void> {
  await saveKv(userId, BEHOURD_KEY, on)
}
