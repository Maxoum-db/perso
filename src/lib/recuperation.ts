import { regionsForGroup, type MuscleRegion } from './muscles'
import type { GroupLoad } from './muscu'

// Tous les muscles ne récupèrent pas au même rythme.
//
// Les petits muscles très vascularisés et sollicités toute la journée (nuque,
// avant-bras, mollets, ceinture) encaissent une séance en 24-48 h. Les grosses
// masses (grand dorsal, pectoraux, quadriceps, ischios) demandent 48-72 h. Et
// les érecteurs du rachis, sollicités en isométrie lourde sur presque tous les
// mouvements, sont les plus lents à revenir.
//
// Le coefficient multiplie les jours « ressentis » : au-dessus de 1 le muscle
// est prêt plus vite, en dessous il traîne.

const RAPIDE = 1.6
const MOYEN = 1
const LENT = 0.75

export const VITESSE_RECUP: Record<MuscleRegion, number> = {
  // Rapides — petits, endurants, sollicités en continu
  neck: RAPIDE,
  forearmFlex: RAPIDE,
  forearmExt: RAPIDE,
  gastroc: RAPIDE,
  soleus: RAPIDE,
  tibialis: RAPIDE,
  rectus: RAPIDE,
  obliques: RAPIDE,
  serratus: RAPIDE,
  deltLat: RAPIDE,
  tfl: RAPIDE, //        petit, postural, sollicité à chaque pas
  fibularis: RAPIDE, //  stabilisateur de cheville, en service toute la journée

  // Moyens
  //
  // Quadriceps et grand fessier ont longtemps été classés lents parce qu'ils
  // sont gros. C'est le mauvais critère : ce sont aussi les muscles les plus
  // vascularisés du corps et les seuls à travailler à chaque pas, chaque
  // escalier, chaque relevé de chaise. Ils reviennent en 48-72 h, pas en six
  // jours — un pectoral, lui, ne sert à rien entre deux séances.
  rectusFemoris: MOYEN,
  vastusLat: MOYEN,
  gluteMax: MOYEN,
  biceps: MOYEN,
  brachialis: MOYEN,
  brachioradialis: MOYEN,
  tricepsLong: MOYEN,
  tricepsLat: MOYEN,
  deltAnt: MOYEN,
  deltPost: MOYEN,
  trapsUpper: MOYEN,
  trapsMid: MOYEN,
  trapsLow: MOYEN,
  teres: MOYEN,
  rhomboids: MOYEN,
  hipFlexors: MOYEN,
  pecUpper: MOYEN,
  adductors: MOYEN,
  gluteMed: MOYEN,
  vastusMed: MOYEN,

  // Lents — ce qui traîne vraiment : la chaîne postérieure, très sollicitée en
  // excentrique (le mode qui abîme le plus), les grosses masses du haut qui ne
  // servent à rien entre deux séances, plus la coiffe : petite, mais
  // très tendineuse et peu vascularisée, elle est longue à revenir. La traiter
  // comme un petit muscle rapide serait exactement la mauvaise consigne sur une
  // épaule qui a déjà lâché.
  rotatorCuff: LENT,
  pecLower: LENT,
  lats: LENT,
  erectors: LENT,
  bicepsFemoris: LENT,
  hamsInner: LENT,
}

export interface ReposMuscle {
  /** Jours ressentis, vitesse de la zone comprise. */
  jours: number
  /** Intensité de la sollicitation la plus fraîche qui touche ce muscle. */
  intensite: number
  /** Libellé de groupe à l'origine, pour la fiche au clic. */
  label: string
  /** Jours réellement écoulés depuis la séance. */
  joursReels: number
  /** Jours ajoutés à la main (courbatures déclarées). */
  soreExtra?: number
}

/**
 * Repos de chaque muscle, à partir des charges par groupe. Un muscle couvert
 * par plusieurs libellés prend la sollicitation la plus fraîche.
 *
 * Source unique : le mannequin et le générateur de séance lisaient chacun leur
 * version de ce calcul, ce qui les faisait diverger dès qu'on touchait à l'un.
 */
export function reposParMuscle(loads: Record<string, GroupLoad>): Partial<Record<MuscleRegion, ReposMuscle>> {
  const out: Partial<Record<MuscleRegion, ReposMuscle>> = {}
  for (const [label, load] of Object.entries(loads)) {
    for (const region of regionsForGroup(label)) {
      const jours = load.effectiveDays * VITESSE_RECUP[region]
      const cur = out[region]
      if (!cur || jours < cur.jours) {
        out[region] = {
          jours,
          intensite: load.intensity,
          label,
          joursReels: load.days,
          soreExtra: load.soreExtra,
        }
      }
    }
  }
  return out
}
