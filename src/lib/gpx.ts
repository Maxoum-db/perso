import { accumulateurVide, accumuler, bilan, distanceM, motifRejet, type ModeTrajet, type PointGps } from './gps'

// Lire un trajet enregistré ailleurs.
//
// ── Pourquoi le GPX et pas une liaison directe ──────────────────────────────
//
// Calimoto n'a pas d'interface de programmation publique : aucun portail
// développeur, rien dans sa documentation. Aucune application ne peut donc
// aller chercher ses trajets toute seule, et prétendre le contraire serait
// promettre ce qui n'existe pas.
//
// Ce qu'elle sait faire, en revanche, c'est exporter. Un trajet TERMINÉ sort en
// GPX avec ses points de trace — la trace réelle, seconde par seconde. Un
// trajet PLANIFIÉ sort avec des points d'itinéraire, sans horodatage : on peut
// en tirer une distance, jamais une durée ni une vitesse.
//
// ── Ce qu'on garde du fichier ───────────────────────────────────────────────
//
// Des nombres. La trace est lue, mesurée, et JETÉE — elle n'est écrite nulle
// part. C'est la même règle que pour l'enregistreur : pour des kilomètres et
// une durée, la trace n'apporte rien, et c'est l'adresse du domicile, celle du
// travail et les heures où la maison est vide.

/**
 * La précision qu'on prête à un point de GPX, faute de mieux.
 *
 * ⚠️ C'est une HYPOTHÈSE, pas une mesure : le format GPX ne porte aucun champ
 * d'incertitude. Dix mètres est l'ordre de grandeur d'un récepteur civil en
 * conditions ordinaires.
 *
 * Elle ne sert qu'au filtre de bruit, donc elle ne change presque rien sur un
 * trajet en mouvement : à 60 km/h, une seconde fait seize mètres et tous les
 * segments passent. Elle compte à l'ARRÊT — un feu rouge, une pause — où la
 * position continue de danser et où sommer naïvement ajouterait des mètres
 * qu'on n'a pas parcourus.
 */
export const PRECISION_GPX_M = 10

export interface LectureGpx {
  /** Nom de la trace, tel que le fichier le donne. */
  nom: string | null
  /** Points de trace lus dans le fichier. */
  points: number
  metres: number
  /** `null` quand le fichier ne porte pas d'horodatage (trajet planifié). */
  secondes: number | null
  vitesseMoyenneKmh: number | null
  /** Date ISO du premier point horodaté. */
  debut: string | null
}

/** Le fichier est-il lisible comme un GPX ? */
export class GpxIllisible extends Error {}

/**
 * Les points de trace d'un document GPX.
 *
 * On lit `<trkpt>` et rien d'autre. `<rtept>` et `<wpt>` décrivent un
 * itinéraire à suivre, pas un chemin parcouru : les mesurer reviendrait à
 * annoncer comme « roulé » ce qui n'a été que prévu — et l'écart n'est pas
 * anodin, un itinéraire ne compte que quelques dizaines de points pour des
 * centaines de kilomètres.
 */
export function pointsDuDocument(doc: Document, precision = PRECISION_GPX_M): PointGps[] {
  if (doc.querySelector('parsererror')) throw new GpxIllisible('Ce fichier n’est pas un GPX lisible.')
  const trkpts = Array.from(doc.getElementsByTagName('trkpt'))
  const out: PointGps[] = []
  for (const el of trkpts) {
    const lat = Number(el.getAttribute('lat'))
    const lon = Number(el.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const t = el.getElementsByTagName('time')[0]?.textContent?.trim()
    // `Date.parse` d'une chaîne vide rend NaN, pas 0 : un point sans horodatage
    // reçoit `NaN` et sera reconnu comme non horodaté plus bas, au lieu de se
    // retrouver daté du 1er janvier 1970 et de créer un trou d'un demi-siècle.
    const instant = t ? Date.parse(t) : NaN
    out.push({ lat, lon, precision, instant })
  }
  return out
}

export function nomDuDocument(doc: Document): string | null {
  const n = doc.querySelector('trk > name')?.textContent?.trim()
  return n || null
}

/**
 * Mesure une trace.
 *
 * Deux chemins, et c'est le fichier qui décide :
 *
 *   · HORODATÉ — on emploie exactement l'accumulateur de l'enregistreur en
 *     direct. Les deux mesures sont alors comparables, ce qui est tout
 *     l'intérêt : un trajet importé et un trajet enregistré ici doivent pouvoir
 *     s'additionner sans qu'on se demande lequel compte comment ;
 *   · SANS HORODATAGE — plus de durée, plus de vitesse, et surtout plus de
 *     garde-fou sur la vitesse ni sur les trous. On somme les segments qui
 *     dépassent le bruit, et on annonce l'absence de durée plutôt que d'en
 *     inventer une.
 */
export function mesurerTrace(points: PointGps[], mode: ModeTrajet): LectureGpx {
  const horodates = points.filter((p) => Number.isFinite(p.instant))
  // Il faut que la trace SOIT horodatée, pas qu'un point isolé le soit : un
  // fichier où trois points sur mille portent une heure ne donne pas une durée,
  // il donne une illusion de durée.
  const horodatee = horodates.length >= points.length * 0.9 && horodates.length >= 2

  if (horodatee) {
    let acc = accumulateurVide()
    for (const p of horodates) acc = accumuler(acc, p, mode)
    const b = bilan(acc)
    return {
      nom: null,
      points: points.length,
      metres: b?.metres ?? 0,
      secondes: b?.secondes ?? 0,
      vitesseMoyenneKmh: b?.vitesseMoyenneKmh ?? null,
      debut: new Date(horodates[0].instant).toISOString(),
    }
  }

  // Sans horodatage, `motifRejet` ne sait rien dire : il commence par exiger un
  // écart de temps positif, et rendrait « trou » pour tout. On n'applique donc
  // que le filtre de bruit, à la main, et on l'écrit ici plutôt que d'ajouter
  // un mode muet à une fonction qui a déjà trois règles.
  let metres = 0
  let ref: PointGps | null = null
  for (const p of points) {
    if (ref === null) {
      ref = p
      continue
    }
    const d = distanceM(ref, p)
    if (d <= Math.max(ref.precision, p.precision)) continue
    metres += d
    ref = p
  }
  return { nom: null, points: points.length, metres: Math.round(metres), secondes: null, vitesseMoyenneKmh: null, debut: null }
}

/** Lit un fichier GPX de bout en bout. */
export function lireGpx(xml: string, mode: ModeTrajet, doc?: Document): LectureGpx {
  const d = doc ?? new DOMParser().parseFromString(xml, 'application/xml')
  const lecture = mesurerTrace(pointsDuDocument(d), mode)
  if (!lecture.points) throw new GpxIllisible('Aucun point de trace dans ce fichier — un trajet planifié ne contient que l’itinéraire, pas le chemin parcouru.')
  return { ...lecture, nom: nomDuDocument(d) }
}

/** Le motif de rejet d'un segment, réexporté pour que les contrôles y accèdent. */
export { motifRejet }
