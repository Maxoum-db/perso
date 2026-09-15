import { mesureFiable } from './recupCardiaque'
import type { MesureRepos } from './cardioSeance'

// Ce que le capteur a fini par apprendre sur toi.
//
// ── Pourquoi ce module existe ───────────────────────────────────────────────
//
// Chaque mesure du matin était rangée, lue une fois pour un verdict du jour, et
// plus jamais regardée. L'application accumulait donc des dizaines de relevés
// sans jamais en tirer les deux chiffres qui décrivent VRAIMENT un cœur : la
// fréquence au repos, et l'écart entre ce repos et le maximum.
//
// Rien n'est demandé ici : tout se déduit de ce qui est déjà enregistré. C'est
// la différence entre un profil qu'on remplit et un profil qui se remplit.
//
// ── Pourquoi la MÉDIANE et pas la moyenne ───────────────────────────────────
//
// Une mesure prise après avoir monté les escaliers, ou pendant qu'on parle,
// sort à vingt battements au-dessus des autres. Sur sept mesures, elle tire la
// moyenne de trois battements — durablement, et sans que rien ne le signale.
// La médiane, elle, ne bouge pas : il faudrait que la MOITIÉ des matins soient
// ratés pour la déplacer.
//
// C'est le bon choix précisément parce qu'on ne contrôle pas le protocole. Une
// moyenne suppose des mesures propres ; une médiane suppose seulement qu'il y
// en a plus de bonnes que de mauvaises.

/** La fenêtre qui décrit « maintenant », en jours. */
export const FENETRE_J = 30

/**
 * Combien de mesures fiables il faut pour oser un chiffre.
 *
 * Trois. En dessous, la médiane est soit une mesure unique, soit celle du
 * milieu de deux — autant dire la mesure elle-même, avec l'autorité en plus
 * d'un chiffre présenté comme un profil.
 */
export const MESURES_MIN = 3

export type OrigineFcMax = 'relevée' | 'estimée'

/**
 * D'où vient le VO2max affiché.
 *
 *   · `'test Polar'` — le test de condition physique de l'application Polar
 *     Flow, cinq minutes allongé avec le brassard. Ce n'est pas une mesure
 *     directe de consommation d'oxygène — aucun chiffre obtenu sans masque n'en
 *     est une — mais c'est mieux que le nôtre : il repose sur une variabilité
 *     relevée dans les conditions du test, et sur un modèle que Polar a calibré
 *     sur sa propre population ;
 *   · `'rapport des fréquences'` — notre estimation, qui multiplie deux
 *     approximations (cf. `FACTEUR_UTH`).
 *
 * Le premier l'emporte quand il existe. Afficher le nôtre alors qu'une mesure
 * meilleure dort dans le KV serait garder le pire des deux par habitude.
 */
export type OrigineVo2max = 'test Polar' | 'rapport des fréquences'

/** Ce que Polar sait, quand le compte y est relié et que le test a été passé. */
export interface ApportPolar {
  vo2max: number | null
  fcRepos: number | null
  fcMax: number | null
  date: string | null
}

export interface ProfilCardiaque {
  /** Médiane des battements au repos sur la fenêtre. `null` faute de mesures. */
  fcRepos: number | null
  /** Sur combien de mesures fiables elle repose. */
  mesures: number
  fcMax: number | null
  origineFcMax: OrigineFcMax | null
  /** FC max − FC repos : l'amplitude dont le cœur dispose réellement. */
  reserve: number | null
  /**
   * VO2max estimé, en ml/kg/min. `null` dès qu'un des deux chiffres manque —
   * ou que la maximale n'est qu'estimée (cf. plus bas).
   */
  vo2max: number | null
  /** `null` quand il n'y a pas de VO2max à montrer. */
  origineVo2max: OrigineVo2max | null
  /**
   * Dérive de la FC de repos : médiane des trente derniers jours moins celle
   * des trente précédents, en battements. Positif = le repos monte.
   */
  tendance: number | null
  /** Ce que Polar dit, quand il dit quelque chose — à côté du nôtre, pas à la place. */
  polar: ApportPolar | null
}

/**
 * La médiane d'une série. Sur un nombre pair, la moyenne des deux du milieu.
 */
export function mediane(xs: number[]): number | null {
  if (!xs.length) return null
  const t = [...xs].sort((a, b) => a - b)
  const m = t.length >> 1
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}

/**
 * Les mesures fiables d'une tranche de jours, comptée depuis `maintenant`.
 *
 * `maintenant` est un paramètre et non un `Date.now()` interne : une fonction
 * qui lit l'heure elle-même ne se contrôle pas — on ne peut pas lui faire jouer
 * deux mois en trois millisecondes.
 */
export function dansLaFenetre(
  historique: MesureRepos[],
  maintenant: number,
  depuisJ: number,
  jusquaJ: number,
): MesureRepos[] {
  const debut = maintenant - jusquaJ * 86400000
  const fin = maintenant - depuisJ * 86400000
  return historique.filter((m) => {
    const t = new Date(m.date).getTime()
    // Une date illisible est écartée plutôt que laissée tomber dans une tranche
    // au hasard.
    //
    // ⚠️ Cette ligne est INERTE aujourd'hui, et c'est assumé : `getTime()` rend
    // NaN sur une date abîmée, et toute comparaison avec NaN est fausse — les
    // deux tests ci-dessous l'écartent donc déjà. Aucune mutation ne la fait
    // tomber, et c'est normal, pas un trou dans les contrôles.
    //
    // Gardée quand même : elle écrit l'intention. Le jour où la fenêtre se
    // réécrit avec une négation — « garder tout ce qui n'est PAS hors bornes » —
    // les NaN passeraient tous, et cette ligne serait la seule barrière.
    if (!Number.isFinite(t)) return false
    return t > debut && t <= fin && mesureFiable(m)
  })
}

/**
 * Le facteur de la méthode du rapport des fréquences — Uth, Sørensen,
 * Overgaard et Pedersen (2004), Eur J Appl Physiol 91(1) : 111-115.
 *
 *   VO2max ≈ 15,3 × (FC max / FC repos)
 *
 * ⚠️ D'où elle vient, et ce que ça implique : elle a été établie sur QUARANTE-SIX
 * HOMMES BIEN ENTRAÎNÉS. Chez des sédentaires, la même formule SURESTIME — les
 * travaux de reprise trouvent environ 2 ml/kg/min de trop avec ce facteur, et
 * l'écart se referme avec un facteur propre à la population. Elle surestime
 * aussi ceux qui ont un repos très bas ou une maximale très haute, puisque
 * c'est leur rapport qu'elle multiplie.
 *
 * Ce n'est donc pas une mesure. C'est un ordre de grandeur, et il est présenté
 * comme tel à l'écran. Un vrai chiffre se mesure à l'effort, ou s'obtient par le
 * test de condition physique de Polar.
 */
export const FACTEUR_UTH = 15.3

/**
 * Le profil, déduit de ce qui est déjà enregistré.
 *
 * ── Pourquoi le VO2max exige une maximale RELEVÉE ───────────────────────────
 *
 * La formule multiplie un rapport. Si les deux termes sont estimés, l'erreur
 * de l'un se multiplie par celle de l'autre, et le résultat a l'exactitude
 * d'aucune des deux tout en ayant l'allure d'une mesure. L'estimation de Tanaka
 * porte un écart-type de ±10 bpm ; la méthode d'Uth surestime déjà chez qui
 * n'est pas un coureur entraîné. Les empiler donnerait un nombre qu'on ne
 * pourrait défendre.
 *
 * Alors on n'affiche rien, et l'écran dit ce qui manque — ce qui a l'avantage
 * d'indiquer quoi faire : relever une vraie maximale en côte.
 */
export function profilCardiaque(
  historique: MesureRepos[],
  fcMax: number | null,
  origine: OrigineFcMax | null,
  maintenant: number = Date.now(),
  polar: ApportPolar | null = null,
): ProfilCardiaque {
  const recentes = dansLaFenetre(historique, maintenant, 0, FENETRE_J)
  const fcRepos = recentes.length >= MESURES_MIN ? Math.round(mediane(recentes.map((m) => m.bpm)) as number) : null

  const avant = dansLaFenetre(historique, maintenant, FENETRE_J, 2 * FENETRE_J)
  const fcAvant = avant.length >= MESURES_MIN ? Math.round(mediane(avant.map((m) => m.bpm)) as number) : null

  const reserve = fcRepos !== null && fcMax !== null ? fcMax - fcRepos : null

  // Le nôtre, sous condition — cf. plus haut : deux estimations multipliées ne
  // rendent pas une mesure.
  const estime =
    fcRepos !== null && fcMax !== null && origine === 'relevée' && fcRepos > 0
      ? Math.round(FACTEUR_UTH * (fcMax / fcRepos))
      : null

  // Celui de Polar l'emporte quand il existe. C'est la seule règle de priorité
  // du module, et elle va dans le sens de la meilleure mesure — pas dans celui
  // du chiffre qu'on a produit soi-même.
  const mesure = polar?.vo2max ?? null

  // ── Le chiffre et son étiquette sortent de la MÊME décision ──────────────
  //
  // Ils étaient calculés par deux expressions séparées, chacune refaisant la
  // priorité de son côté. Les deux disaient la même chose, jusqu'au jour où
  // l'une changerait sans l'autre : l'écran aurait alors affiché notre
  // estimation sous l'étiquette « test Polar ». Pas une approximation — un
  // mensonge, et du genre qu'on ne repère pas, puisque les deux nombres sont
  // plausibles.
  //
  // Une seule expression, donc, et l'étiquette ne peut plus mentir sur la
  // provenance du chiffre qu'elle accompagne.
  const vo2: { valeur: number | null; origine: OrigineVo2max | null } =
    mesure !== null
      ? { valeur: mesure, origine: 'test Polar' }
      : estime !== null
        ? { valeur: estime, origine: 'rapport des fréquences' }
        : { valeur: null, origine: null }

  return {
    fcRepos,
    mesures: recentes.length,
    fcMax,
    origineFcMax: fcMax === null ? null : origine,
    reserve,
    vo2max: vo2.valeur,
    origineVo2max: vo2.origine,
    tendance: fcRepos !== null && fcAvant !== null ? fcRepos - fcAvant : null,
    polar: polar && (polar.vo2max !== null || polar.fcRepos !== null || polar.fcMax !== null) ? polar : null,
  }
}

/**
 * Ce qu'une dérive du repos veut dire — et à partir de quand elle veut dire
 * quelque chose.
 *
 * Cinq battements. En dessous, on lit le bruit : la FC de repos bouge de deux
 * ou trois battements d'un mois à l'autre selon la saison, l'heure du réveil
 * et le sommeil de la veille. Au-delà, chez quelqu'un dont le protocole ne
 * change pas, c'est un signal — vers le haut, quelque chose coûte ; vers le
 * bas, l'endurance progresse.
 */
export const DERIVE_MIN = 5

export function lireTendance(bpm: number | null): { texte: string; sens: 'haut' | 'bas' | 'stable' } | null {
  if (bpm === null) return null
  if (bpm >= DERIVE_MIN) {
    return { sens: 'haut', texte: 'Ton repos est monté depuis le mois dernier — fatigue accumulée, mauvais sommeil ou début d’infection.' }
  }
  if (bpm <= -DERIVE_MIN) {
    return { sens: 'bas', texte: 'Ton repos est descendu depuis le mois dernier — c’est le signe d’une endurance qui progresse.' }
  }
  return { sens: 'stable', texte: 'Stable depuis le mois dernier.' }
}
