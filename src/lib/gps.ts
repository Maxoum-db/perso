// Le trajet, mesuré au GPS du téléphone.
//
// Tout ce fichier est PUR : pas d'API de géolocalisation, pas de React, pas de
// réseau. On lui donne des points, il rend une distance. C'est indispensable
// ici, parce qu'une distance fausse ressemble exactement à une distance juste —
// et qu'on ne peut pas aller marcher trois kilomètres à chaque modification
// pour vérifier.
//
// ── Pourquoi ce n'est PAS « additionner les distances entre points » ────────
//
// C'est le piège de toutes les applications de suivi faites à la maison, et il
// donne toujours le même symptôme : le compteur monte alors qu'on est ARRÊTÉ.
//
// Un GPS de téléphone ne rend pas une position, il rend une position ET son
// incertitude. Immobile sur un trottoir avec une précision de ±15 m, les points
// successifs sautent au hasard dans un cercle de quinze mètres de rayon. Chaque
// saut fait quelques mètres ; additionnés à raison d'un par seconde, ils font
// un kilomètre par quart d'heure sans qu'on ait bougé d'un pas.
//
// Trois filtres répondent à ça, et aucun n'est superflu :
//
//   1. la PRÉCISION du point : au-delà d'un certain flou, le point ne dit rien
//      et on ne le garde pas du tout ;
//   2. le DÉPLACEMENT MINIMAL : un segment plus court que l'incertitude de ses
//      propres extrémités n'est pas un déplacement, c'est du bruit ;
//   3. la VITESSE IMPLIQUÉE : un saut qui demanderait 300 km/h est une erreur
//      du récepteur, pas un trajet.
//
// Et un quatrième garde-fou, de nature différente : le TROU. Un tunnel, un
// écran éteint, et deux points séparés de dix minutes. Les relier en ligne
// droite inventerait un déplacement dont on ne sait rien.

export type ModeTrajet = 'marche' | 'moto'

export interface PointGps {
  /** Degrés décimaux. */
  lat: number
  lon: number
  /** Rayon d'incertitude en mètres, tel que le navigateur le donne. */
  precision: number
  /** Horodatage en millisecondes. */
  instant: number
}

/**
 * Au-delà de ce flou, le point est jeté.
 *
 * Trente mètres. En ville, entre deux immeubles, un téléphone annonce
 * couramment ±20 m ; au-delà de trente il ne sait plus dans quelle rue on est,
 * et le garder ne fait qu'ajouter du bruit à la somme.
 */
export const PRECISION_MAX_M = 30

/**
 * Le trou au-delà duquel on ne relie plus deux points.
 *
 * Trente secondes. Le GPS rend un point par seconde quand tout va bien ; trente
 * secondes de silence veulent dire tunnel, poche, ou écran verrouillé. Ce qui
 * s'est passé entre les deux est inconnu, et une ligne droite serait une
 * invention — presque toujours trop courte, d'ailleurs, puisqu'elle coupe.
 *
 * Ce plafond joue un SECOND rôle depuis que la référence reste en place tant
 * que le seuil de bruit n'est pas franchi : il remet les compteurs à zéro quand
 * on ne bouge plus. Sans lui, une pause de dix minutes finirait par produire un
 * segment de dix minutes le jour où la dérive franchit le seuil.
 *
 * Il fixe du même coup la vitesse la plus lente détectable : le seuil de bruit
 * divisé par trente secondes, soit environ 0,5 m/s avec un récepteur à ±15 m.
 * Plus lent que ça — moins de deux kilomètres-heure — n'est pas enregistré.
 */
export const TROU_MAX_S = 30

/**
 * La vitesse au-delà de laquelle un segment est une erreur, par mode.
 *
 * Marche : 15 km/h. On ne marche pas à quinze, on court — et même en courant
 * vite, ce plafond n'est pas atteint sur une moyenne de segment. Ce qui le
 * dépasse est un saut du récepteur.
 *
 * Moto : 200 km/h. Assez pour tout ce qui se fait sur route, trop peu pour un
 * saut GPS, qui produit typiquement des centaines de km/h.
 */
export const VITESSE_MAX_KMH: Record<ModeTrajet, number> = { marche: 15, moto: 200 }

/**
 * Distance orthodromique entre deux points, en mètres — formule de haversine.
 *
 * Le rayon employé est le rayon moyen de l'UGGI, 6 371 008,8 m. La Terre n'est
 * pas une sphère et l'erreur de haversine atteint 0,5 % aux pires latitudes ;
 * sur un trajet de dix kilomètres cela fait cinquante mètres, ce qui est bien
 * en dessous de l'incertitude du récepteur lui-même. Vincenty serait plus juste
 * et ne changerait rien de visible.
 */
export const RAYON_TERRE_M = 6371008.8

export function distanceM(a: PointGps, b: PointGps): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const lat1 = a.lat * rad
  const lat2 = b.lat * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * RAYON_TERRE_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Un point dont le flou dépasse le plafond ne sert à rien. */
export function pointUtilisable(p: PointGps): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.precision) && p.precision <= PRECISION_MAX_M
}

export type Rejet = 'trou' | 'bruit' | 'saut' | null

/**
 * Faut-il compter ce segment, et sinon pourquoi ?
 *
 * Le motif est rendu plutôt qu'un simple `false` : à l'écran il ne sert à rien,
 * mais ici il permet de vérifier que chaque filtre attrape bien CE qu'il doit
 * attraper. Trois règles qui rendent toutes `false` sont trois règles dont on
 * ne sait pas laquelle a agi — et dont deux peuvent être mortes sans que rien
 * ne le dise.
 */
export function motifRejet(a: PointGps, b: PointGps, mode: ModeTrajet): Rejet {
  const dt = (b.instant - a.instant) / 1000
  if (!(dt > 0) || dt > TROU_MAX_S) return 'trou'
  const d = distanceM(a, b)
  // Le seuil de bruit est l'incertitude la PLUS GRANDE des deux points, pas
  // leur moyenne : si l'un des deux est flou à quinze mètres, un déplacement de
  // dix mètres reste indiscernable du bruit, même si l'autre point était net.
  if (d <= Math.max(a.precision, b.precision)) return 'bruit'
  if ((d / dt) * 3.6 > VITESSE_MAX_KMH[mode]) return 'saut'
  return null
}

export interface AccumulateurGps {
  /** Mètres retenus. */
  metres: number
  /** Secondes de déplacement réellement comptées — hors trous et hors arrêts. */
  secondes: number
  /** Nombre de points reçus, filtres compris : dit si la mesure vaut quelque chose. */
  points: number
  /** Points effectivement retenus comme déplacement. */
  segments: number
  dernier: PointGps | null
  /** Le premier point utilisable, pour dater le trajet. */
  debut: number | null
  /** Vitesse du dernier segment retenu, en km/h. */
  vitesseKmh: number | null
}

export function accumulateurVide(): AccumulateurGps {
  return { metres: 0, secondes: 0, points: 0, segments: 0, dernier: null, debut: null, vitesseKmh: null }
}

/**
 * Range un point.
 *
 * ── Ce que devient la RÉFÉRENCE, et pourquoi c'est tout le sujet ────────────
 *
 * La référence est le point depuis lequel se mesure le segment suivant. Ce
 * qu'on en fait après un rejet décide de la justesse de toute la mesure, et la
 * première version de ce fichier se trompait — d'une façon qui ne se voyait pas
 * en lisant le code.
 *
 * Elle avançait à chaque point, y compris quand le segment était jugé « bruit ».
 * Chaque pas était donc comparé au pas d'avant : à quatre-vingts centimètres de
 * marche par seconde et une incertitude de cinq mètres, AUCUN segment ne
 * franchissait jamais le seuil. Une marche de cinq minutes — quatre cent vingt
 * mètres réels — s'enregistrait à six mètres. Le compteur affichait zéro pendant
 * qu'on marchait, ce qui est exactement le contraire du défaut qu'on cherchait à
 * éviter.
 *
 * La référence RESTE donc en place tant que le seuil n'est pas franchi : les
 * petits déplacements se cumulent jusqu'à devenir mesurables, et c'est alors la
 * distance réelle depuis la dernière position sûre qui est comptée.
 *
 * Mesuré sur des trajets simulés, bruit gaussien et dérive errante :
 *
 *                                        vrai   avance   reste
 *   immobile 20 min, dérive ±15 m         0 m      0 m    64 m
 *   marche lente 20 min, ±15 m          720 m      0 m   722 m
 *   marche normale 20 min, ±5 m       1 680 m      0 m  1 699 m
 *
 * Immobile, la référence figée ne dérive pas : une erreur qui erre tourne autour
 * de sa position et ne s'en éloigne pas durablement. Les quelques dizaines de
 * mètres restants sur vingt minutes sont le prix honnête d'un récepteur civil,
 * et ils sont à comparer aux quatre kilomètres et demi qu'invente une somme
 * naïve sur cinq minutes.
 *
 * Trois rejets, trois traitements :
 *
 *   · BRUIT — la référence reste, c'est tout ce qui précède ;
 *   · SAUT  — la référence reste aussi : le point est faux, s'y raccrocher
 *     ferait partir le segment suivant d'une position qui n'existe pas ;
 *   · TROU  — la référence prend le nouveau point. Le lien est rompu (tunnel,
 *     écran verrouillé), mais la position, elle, est bonne : c'est de là qu'on
 *     repart. Sauf si le temps recule — un point antérieur ne peut pas servir
 *     de nouveau départ.
 */
export function accumuler(acc: AccumulateurGps, p: PointGps, mode: ModeTrajet): AccumulateurGps {
  const points = acc.points + 1
  if (!pointUtilisable(p)) return { ...acc, points }
  if (acc.dernier === null) return { ...acc, points, dernier: p, debut: p.instant }

  const motif = motifRejet(acc.dernier, p, mode)
  if (motif !== null) {
    const repart = motif === 'trou' && p.instant > acc.dernier.instant
    return { ...acc, points, dernier: repart ? p : acc.dernier }
  }

  const d = distanceM(acc.dernier, p)
  const dt = (p.instant - acc.dernier.instant) / 1000
  return {
    metres: acc.metres + d,
    secondes: acc.secondes + dt,
    points,
    segments: acc.segments + 1,
    dernier: p,
    debut: acc.debut,
    vitesseKmh: (d / dt) * 3.6,
  }
}

export interface BilanTrajet {
  metres: number
  /** Secondes de déplacement — pas la durée de l'enregistrement. */
  secondes: number
  segments: number
  points: number
  /** Moyenne sur le déplacement retenu, en km/h. */
  vitesseMoyenneKmh: number | null
}

export function bilan(acc: AccumulateurGps): BilanTrajet | null {
  if (!acc.segments) return null
  return {
    metres: Math.round(acc.metres),
    secondes: Math.round(acc.secondes),
    segments: acc.segments,
    points: acc.points,
    vitesseMoyenneKmh: acc.secondes > 0 ? Math.round(((acc.metres / acc.secondes) * 3.6) * 10) / 10 : null,
  }
}

/** « 4,2 km », « 840 m » — on ne montre pas trois décimales d'une mesure à ±10 m. */
export function fmtDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`
  return `${(Math.round(metres / 100) / 10).toFixed(1).replace('.', ',')} km`
}

/** « 1 h 12 », « 24 min », « 45 s ». */
export function fmtDuree(secondes: number): string {
  const s = Math.round(secondes)
  if (s < 60) return `${s} s`
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const reste = min % 60
  return reste ? `${h} h ${String(reste).padStart(2, '0')}` : `${h} h`
}
