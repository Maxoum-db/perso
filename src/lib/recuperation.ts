import { regionsForGroup, type MuscleRegion } from './muscles'
import type { GroupLoad } from './muscu'
import type { IntensiteId } from './intensite'

// Tous les muscles ne récupèrent pas au même rythme, et trois paliers pour
// trente-huit muscles ne suffisaient pas : le palier moyen à lui seul en
// contenait vingt — plus de la moitié du corps rendait la même réponse.
//
// Quatre déterminants séparent réellement un muscle d'un autre :
//
//   • la part de fibres lentes — un muscle oxydatif encaisse et revient vite ;
//   • la masse — plus il y a de tissu, plus il y a à réparer ;
//   • l'usage quotidien — un muscle qui tient la posture ou marche toute la
//     journée est déjà adapté à une charge continue ;
//   • l'exposition à l'excentrique — c'est le mode qui abîme le plus, et il
//     frappe surtout les muscles bi-articulaires.
//
// Sept paliers, de 2,5 à 7,5 jours avant le vert. Le coefficient multiplie les
// jours « ressentis » : au-dessus de 1 le muscle est prêt plus tôt.

/**
 * Jours « ressentis » à partir desquels un muscle est prêt à retravailler.
 *
 * Ici et non dans le mannequin : ce n'est pas une règle de dessin mais une règle
 * de récupération, et « totalement bon » a besoin de savoir à partir de quand un
 * muscle est prêt pour pouvoir l'y placer.
 *
 * C'est la borne exacte de la quatrième case du spectre : le compte à rebours
 * affiché et le libellé d'état basculent au même instant, sinon la fiche se
 * contredit elle-même. Déclaré avant les paliers parce que ce sont EUX qui
 * s'expriment par rapport à lui, et non l'inverse.
 */
export const SEUIL_PRET = 4.5

/**
 * Pas de temps de la récupération : une demi-journée.
 *
 * En marches de 24 h, un muscle gardait la même couleur du réveil au coucher
 * puis changeait d'un coup pendant la nuit — alors qu'entre une séance du matin
 * et le soir même il s'est passé l'essentiel de la première phase de
 * récupération. À 12 h, chaque journée porte deux états.
 *
 * Vit ici et non dans le journal des séances : c'est le pas du BARÈME, et le
 * plafond du jour J s'exprime avec (muscu.ts les ré-exporte pour ne rien casser).
 */
export const PAS_HEURES = 12
export const PAS_JOURS = PAS_HEURES / 24

/**
 * Le jour même, aucun muscle sollicité n'affiche « prêt » : on le bloque au
 * dernier cran avant le seuil, quelle que soit sa part dans l'exercice.
 *
 * Appliqué ICI, par muscle, et non sur les jours ressentis : là-bas la vitesse
 * de la zone n'est pas encore connue, il fallait donc caler le plafond sur la
 * zone la PLUS RAPIDE du barème, et toutes les autres en héritaient d'un
 * plafond trop bas. Depuis que les jambes descendent à 1,5 j, ça tirait tout le
 * corps vers le rouge le jour de la séance. Exprimé en jours ressentis finaux,
 * le plafond vaut pour chaque zone exactement ce qu'il annonce.
 */
export const PLAFOND_JOUR_J = SEUIL_PRET - PAS_JOURS

/**
 * Le coefficient qui rend un muscle prêt EXACTEMENT un jour plus tôt que le
 * palier donné.
 *
 * Les paliers ne sont pas espacés d'un jour — 0,6 j en haut de l'échelle, 1,1 j
 * en bas —, donc « descendre d'un cran » ne veut pas dire « gagner un jour ».
 * Quand on veut le jour, on le calcule.
 */
function unJourDeMoins(palier: number): number {
  return SEUIL_PRET / (SEUIL_PRET / palier - 1)
}

/** ~2,5 j — minuscules, posturaux, en service du matin au soir. */
const TRES_RAPIDE = 1.8
/** ~3,1 j — petits et endurants, forte proportion de fibres lentes. */
const RAPIDE = 1.45
/** ~3,8 j — taille moyenne, usage quotidien réel, excentrique modéré. */
const PLUTOT_RAPIDE = 1.2
/** ~4,5 j — la référence : grosse masse, mais bien vascularisée et très utilisée. */
const MOYEN = 1
/** ~5,3 j — grosses masses qui ne servent à rien entre deux séances. */
const PLUTOT_LENT = 0.85
/** ~6,4 j — bi-articulaires très chargés en excentrique, ou en isométrie permanente. */
const LENT = 0.7
/** ~7,5 j — petit mais très tendineux et mal vascularisé. */
const TRES_LENT = 0.6

// Les jambes, un jour plus tôt que le barème général.
//
// Le barème sortait de la littérature générale ; le ressenti sur le terrain,
// lui, est que les jambes reviennent plus vite que ça — et c'est le ressenti qui
// tranche, puisque c'est la seule mesure directe qu'on ait. On garde donc les
// paliers, avec le même classement relatif entre muscles, mais on retire un jour
// plein à tout le bas du corps. Les ischios restent les derniers à revenir, les
// stabilisateurs de cheville les premiers : c'est l'échelle qui glisse, pas
// l'ordre.
const JAMBES_TRES_RAPIDE = unJourDeMoins(TRES_RAPIDE) //   2,5 j → 1,5 j
const JAMBES_RAPIDE = unJourDeMoins(RAPIDE) //             3,1 j → 2,1 j
const JAMBES_PLUTOT_RAPIDE = unJourDeMoins(PLUTOT_RAPIDE) // 3,8 j → 2,8 j
const JAMBES_MOYEN = unJourDeMoins(MOYEN) //               4,5 j → 3,5 j
const JAMBES_PLUTOT_LENT = unJourDeMoins(PLUTOT_LENT) //   5,3 j → 4,3 j

export const VITESSE_RECUP: Record<MuscleRegion, number> = {
  // ── Très rapides ────────────────────────────────────────────────────────
  // Quelques dizaines de grammes, posturaux, sollicités en permanence : la
  // main tient quelque chose toute la journée, le tibial et les fibulaires
  // stabilisent chaque pas, le tenseur du fascia lata aussi.
  forearmFlex: TRES_RAPIDE,
  forearmExt: TRES_RAPIDE,
  tibialis: JAMBES_TRES_RAPIDE,
  fibularis: JAMBES_TRES_RAPIDE,
  tfl: JAMBES_TRES_RAPIDE,

  // ── Rapides ─────────────────────────────────────────────────────────────
  // Petits, très oxydatifs, en service continu. Le soléaire est ici et non
  // avec les jumeaux : c'est le muscle le plus riche en fibres lentes du
  // corps, et il tient debout toute la journée.
  soleus: JAMBES_RAPIDE,
  rectus: RAPIDE,
  obliques: RAPIDE,
  serratus: RAPIDE,
  deltLat: RAPIDE,
  gluteMed: JAMBES_RAPIDE,
  brachioradialis: RAPIDE,
  // Le cou est minuscule et postural, mais sous le heaume il prend cher :
  // on ne le pousse pas au palier au-dessus.
  neck: RAPIDE,

  // ── Plutôt rapides ──────────────────────────────────────────────────────
  // Taille moyenne, usage quotidien réel, peu d'excentrique lourd.
  biceps: PLUTOT_RAPIDE,
  brachialis: PLUTOT_RAPIDE,
  tricepsLat: PLUTOT_RAPIDE,
  deltAnt: PLUTOT_RAPIDE,
  deltPost: PLUTOT_RAPIDE,
  pecUpper: PLUTOT_RAPIDE,
  teres: PLUTOT_RAPIDE,
  rhomboids: PLUTOT_RAPIDE,
  trapsMid: PLUTOT_RAPIDE,
  trapsLow: PLUTOT_RAPIDE,
  hipFlexors: JAMBES_PLUTOT_RAPIDE,
  // Bi-articulaires : les jumeaux prennent de l'excentrique à chaque foulée,
  // et ils sont bien plus riches en fibres rapides que le soléaire.
  gastroc: JAMBES_PLUTOT_RAPIDE,

  // ── Moyens ──────────────────────────────────────────────────────────────
  // Grosses masses, mais parmi les mieux vascularisées et les plus utilisées
  // du corps : le quadriceps et le fessier travaillent à chaque pas.
  rectusFemoris: JAMBES_MOYEN,
  vastusLat: JAMBES_MOYEN,
  vastusMed: JAMBES_MOYEN,
  gluteMax: JAMBES_MOYEN,
  // La longue portion du triceps est bi-articulaire, contrairement à la
  // latérale : elle encaisse davantage.
  tricepsLong: MOYEN,
  // Le trapèze supérieur tient la tête toute la journée — et le heaume par-dessus.
  trapsUpper: MOYEN,

  // ── Plutôt lents ────────────────────────────────────────────────────────
  // Grosses masses qui, elles, ne servent à rien entre deux séances : rien
  // dans une journée ordinaire ne fait travailler un grand dorsal.
  pecLower: PLUTOT_LENT,
  lats: PLUTOT_LENT,

  // Les adducteurs étaient au palier moyen avec les quadriceps. Ils n'y ont pas
  // leur place : l'insertion haute sur le pubis est le point le plus lent à
  // récupérer de la cuisse, et une élongation même légère se compte en semaines
  // là où un quadriceps se compte en jours. C'est aussi la blessure la plus
  // fréquente dans les sports de contact et de changement d'appui — donc
  // exactement le profil du béhourd.
  // https://complete-physio.co.uk/groin-strain-adductor-tendinopathy/
  adductors: JAMBES_PLUTOT_LENT,

  // Les ischios sont bi-articulaires et prennent l'essentiel de l'excentrique
  // — soulevé roumain, freinage de course —, le mode qui abîme le plus. Ils
  // restent les derniers à revenir après une séance de jambes, d'un palier.
  bicepsFemoris: JAMBES_PLUTOT_LENT,
  hamsInner: JAMBES_PLUTOT_LENT,

  // ── Lents ───────────────────────────────────────────────────────────────
  // Cas à part : les érecteurs travaillent en isométrie sur presque tous les
  // mouvements — squat, soulevé, tirage, portage. Ils sont donc rechargés
  // avant d'avoir fini de récupérer, ce qu'aucun autre muscle ne subit.
  erectors: LENT,

  // ── Très lents ──────────────────────────────────────────────────────────
  // Petite, mais très tendineuse et mal vascularisée : le tendon met beaucoup
  // plus longtemps que le muscle. Sur une épaule qui a déjà lâché, se tromper
  // dans ce sens-là ne coûte rien ; dans l'autre, si.
  rotatorCuff: TRES_LENT,
}

/** La zone la plus lente du barème — celle qui fixe le pire cas. */
export const VITESSE_MIN = Math.min(...Object.values(VITESSE_RECUP))

export interface ReposMuscle {
  /** Jours ressentis, vitesse de la zone comprise. */
  jours: number
  /**
   * Jours ressentis que le barème prévoyait, avant déclaration manuelle. Égal à
   * `jours` quand rien n'est déclaré. C'est l'écart entre les deux que la base
   * d'observations mesure.
   */
  joursPrevus: number
  /** Intensité de la sollicitation la plus fraîche qui touche ce muscle. */
  intensite: number
  /** Libellé de groupe à l'origine, pour la fiche au clic. */
  label: string
  /** Jours réellement écoulés depuis la séance. */
  joursReels: number
  /** Date de la séance à l'origine — la clé d'une observation. */
  dateSeance: string
  /** Jours ajoutés à la main (courbatures déclarées). */
  soreExtra?: number
  /** Déclaré « totalement bon » à la main. */
  sorePret?: boolean
  /** Jours ajoutés par l'intensité déclarée de la séance, part du muscle comprise. */
  intensiteRecup?: number
  /** Intensité déclarée de cette séance, pour la nommer sur la fiche. */
  intensiteId?: IntensiteId
  /** Jours ajoutés (ou retirés) par le sommeil depuis la séance. */
  sommeilDelta?: number
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
      // Le plafond du jour J : le muscle a beau n'avoir été qu'effleuré, on ne
      // l'annonce pas prêt le soir même de la séance.
      const brut = load.effectiveDays * VITESSE_RECUP[region]
      const jours = load.days < 1 ? Math.min(brut, PLAFOND_JOUR_J) : brut
      const cur = out[region]
      if (!cur || jours < cur.jours) {
        out[region] = {
          jours,
          joursPrevus: Math.min(
            (load.effectiveDaysPrevus ?? load.effectiveDays) * VITESSE_RECUP[region],
            load.days < 1 ? PLAFOND_JOUR_J : Infinity,
          ),
          intensite: load.intensity,
          label,
          joursReels: load.days,
          dateSeance: load.date,
          soreExtra: load.soreExtra,
          sorePret: load.sorePret,
          intensiteRecup: load.intensiteRecup,
          intensiteId: load.intensiteId,
          sommeilDelta: load.sommeilDelta,
        }
      }
    }
  }
  return out
}
