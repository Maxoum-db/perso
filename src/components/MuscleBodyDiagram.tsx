import { useRef, useState } from 'react'
import { fmtAnciennete, PAS_HEURES, PAS_JOURS, type GroupLoad } from '../lib/muscu'
import { AJUST_MAX, AJUST_MIN, AJUST_PAS, fmtAjust } from '../lib/soreness'
import { MUSCLE_LABELS, SOLLICITATION_MARQUEUR, type MuscleRegion, type Sollicitation } from '../lib/muscles'
import { VITESSE_RECUP, fmtDelai, reposParMuscle, resteAvantPret, type ReposMuscle } from '../lib/recuperation'
import { exercicesPourMuscle } from '../lib/exercicesParMuscle'
import { morphPath, type Sexe } from '../lib/morphologie'
import { historiqueParMuscle, type DernierExo, type HistoriqueMuscle } from '../lib/historiqueMuscle'
import { INTENSITES } from '../lib/intensite'
import type { MuscuSession } from '../lib/muscu'

export { MUSCLE_LABELS, regionsForGroup, sollicitation, SOLLICITATION_MARQUEUR } from '../lib/muscles'
export type { MuscleRegion, Sollicitation } from '../lib/muscles'

// Mannequin de récupération, façon planche anatomique : chaque muscle est un
// tracé distinct (une trentaine), coloré sur un spectre continu selon
// l'ancienneté de son dernier travail pondérée par l'intensité :
//   0-2 j  → rouge          (en récupération)
//   3-4 j  → orange, ambre  (bientôt prêt)
//   5-7 j  → lime, vert     (prêt)
//   ≥ 10 j → turquoise      (en attente / jamais travaillé)
//
// L'échelle avance par sections de 12 h (cf. PAS_JOURS) : chaque journée porte
// deux couleurs, le matin et le soir. La rampe pose donc un point de repère à
// chaque demi-journée sur toute la partie chaude — là où l'état change vite —
// et s'étale ensuite, une fois le muscle prêt.
//
// Les tracés sont exprimés dans un repère centré (x = 0 au milieu du corps) :
// on ne décrit qu'une moitié, l'autre est obtenue par symétrie (scale(-1,1)).

/**
 * Les parties non suivies : tête, mains, genoux, pieds, bassin.
 *
 * Elles étaient en gris CLAIR sur un fond quasi noir — donc l'élément le plus
 * lumineux de l'écran, alors qu'elles ne portent aucune information. L'œil
 * allait aux mains et aux pieds avant d'aller aux muscles. En les enfonçant
 * dans un graphite chaud, le rapport s'inverse : le corps devient une
 * silhouette et les muscles deviennent le sujet, ce qu'ils sont.
 *
 * Assez clair tout de même pour rester distinct du fond (#171310) et de la
 * carte (#262019) : c'est un corps, pas un trou.
 */
const NEUTRAL = '#544B44'

/**
 * Rampe de couleurs du mannequin, lue comme une échelle de température :
 * marron brûlant pour ce qui vient d'être martelé, puis rouge, orange, ambre,
 * lime, vert, turquoise, et bleu froid pour ce qui n'a plus servi depuis
 * longtemps. Un vrai spectre plutôt que trois pastilles à comparer.
 *
 * Les paliers validés restent lisibles : chaud jusqu'à 2 j, ambre à 3-4 j,
 * bascule dans les froides à partir de 5 j. Entre deux paliers, la demi-journée
 * a sa propre teinte — deux sections voisines ne se confondent jamais.
 */
const RAMPE: Array<[jours: number, h: number, s: number, l: number]> = [
  // La moitié froide était nettement moins saturée que la chaude : les verts
  // et les bleus tiraient vers le gris-vert, alors que ce sont eux qu'on
  // regarde pour décider quoi travailler. Une échelle doit être aussi lisible
  // à ses deux bouts, et un muscle frais mérite d'être franchement vert.
  [0, 18, 58, 29], //     marron — encore brûlant, la séance vient de finir
  [0.5, 10, 70, 38], //   marron rouge — le soir de la séance
  [1, 2, 82, 48], //      rouge
  [1.5, 10, 86, 51], //   rouge vif
  [2, 20, 90, 52], //     rouge orangé — dernier cran « en récup »
  [2.5, 28, 92, 52], //   orange sombre
  [3, 35, 94, 52], //     orange
  [3.5, 42, 95, 52], //   orange ambré
  [4, 50, 95, 52], //     ambre — dernier cran « bientôt prêt »
  [4.5, 66, 82, 50], //   jaune lime
  [5, 84, 68, 47], //     lime : bascule sur « prêt »
  [6, 104, 66, 46], //    vert clair
  [7, 130, 64, 44], //    vert franc
  [10, 162, 66, 44], //   turquoise
  [14, 190, 74, 48], //   cyan
  [21, 210, 76, 52], //   bleu franc — froid, oublié
]

/**
 * Bornes de section affichées dans la légende : une case par 12 h tant que le
 * muscle récupère, puis les trois paliers froids. Le dégradé continu masquait
 * justement ce que l'échelle a de discret.
 */
const SECTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 10, 14, 21]

/** Position d'un muscle sur la barre de sections, en % — centre de sa case. */
function positionSpectre(jours: number | undefined): number {
  if (jours === undefined) return ((SECTIONS.length - 0.5) / SECTIONS.length) * 100
  let i = 0
  while (i + 1 < SECTIONS.length && SECTIONS[i + 1] <= jours) i++
  return ((i + 0.5) / SECTIONS.length) * 100
}

/** Le côté du corps affiché en plein écran. */
type Face = 'front' | 'back'

/**
 * Les cinq états, chacun large de ses propres sections — un libellé réparti à
 * intervalles égaux tomberait à côté de sa couleur, la queue froide écrasant
 * l'échelle. La somme des `cases` vaut exactement SECTIONS.length.
 */
const ETATS: Array<{ label: string; cases: number; align: string }> = [
  { label: 'brûlant', cases: 1, align: 'text-left' }, //         0 j
  { label: 'en récup', cases: 4, align: 'text-center' }, //      0,5 → 2 j
  { label: 'bientôt prêt', cases: 4, align: 'text-center' }, //  2,5 → 4 j
  { label: 'prêt', cases: 6, align: 'text-center' }, //          4,5 → 7 j
  { label: 'froid', cases: 3, align: 'text-right' }, //          10 → 21 j
]

/** Couleur interpolée sur la rampe, teinte, saturation et clarté comprises. */
function surLaRampe(jours: number): [number, number, number] {
  if (jours <= RAMPE[0][0]) return [RAMPE[0][1], RAMPE[0][2], RAMPE[0][3]]
  for (let k = 1; k < RAMPE.length; k++) {
    const [j0, h0, s0, l0] = RAMPE[k - 1]
    const [j1, h1, s1, l1] = RAMPE[k]
    if (jours <= j1) {
      const t = (jours - j0) / (j1 - j0)
      return [h0 + (h1 - h0) * t, s0 + (s1 - s0) * t, l0 + (l1 - l0) * t]
    }
  }
  const last = RAMPE[RAMPE.length - 1]
  return [last[1], last[2], last[3]]
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`
}

/** Couleur continue de la rampe — sert au ressenti, réglé au pourcentage. */
function couleurContinue(jours: number, intensity = 1): string {
  const [h, s, l] = surLaRampe(jours)
  if (jours > 4) return hsl(h, s, l)
  // Sur la partie chaude, l'intensité du dernier travail éclaircit la teinte :
  // un moteur principal reste dense, un stabilisateur tire vers le clair — mais
  // tous deux gardent leur couleur. L'écart doit rester lisible côte à côte
  // dans la légende, où les trois pastilles partagent la même section.
  const appoint = 1 - Math.max(0, Math.min(1, intensity))
  return hsl(h, s - 24 * appoint, l + 22 * appoint)
}

/**
 * Couleur d'un muscle. La position sur la rampe porte l'état de récupération,
 * ramenée à sa section de 12 h : entre le matin et le soir la couleur change,
 * mais à l'intérieur d'une même demi-journée elle est stable — sans quoi on
 * verrait le corps dériver en permanence sans jamais pouvoir dire où il en est.
 *
 * Sur la partie froide, la position suffit : plus le muscle attend, plus il
 * descend vers le bleu.
 */
/**
 * Orientation des fibres d'un muscle, déduite de la forme de son tracé.
 *
 * Un muscle est une forme allongée et ses fibres courent dans sa longueur : la
 * boîte englobante suffit donc à choisir la trame, sans écrire une valeur à la
 * main pour chacun des cinquante-quatre — et un cinquante-cinquième muscle
 * ajouté demain sera strié correctement sans qu'on y pense.
 *
 * Trois cas seulement : nettement plus haut que large (fibres verticales),
 * nettement plus large que haut (horizontales), et le reste en oblique.
 */
function trameDuTrace(d: string): string {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity
  for (const paire of d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) {
    const x = Number(paire[1]), y = Number(paire[2])
    if (x < xMin) xMin = x
    if (x > xMax) xMax = x
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }
  const largeur = xMax - xMin, hauteur = yMax - yMin
  if (!isFinite(largeur) || !isFinite(hauteur)) return 'mb-fibres-v'
  if (hauteur > largeur * 1.6) return 'mb-fibres-v'
  if (largeur > hauteur * 1.6) return 'mb-fibres-h'
  return 'mb-fibres-o'
}

export function recoveryColor(effectiveDays: number | undefined, intensity = 1): string {
  // Jamais travaillé sur la période : le plus froid de l'échelle.
  if (effectiveDays === undefined) return couleurContinue(21)
  const section = Math.max(0, Math.floor(effectiveDays / PAS_JOURS) * PAS_JOURS)
  return couleurContinue(section, intensity)
}

/**
 * Couleur d'un effort déclaré, sur la même échelle que le mannequin : 100 % de
 * ce qu'on peut donner = marron brûlant, 0 % = vert reposé. Le ressenti et le
 * corps parlent ainsi le même langage visuel.
 *
 * Ici pas de section : un curseur au pourcentage doit répondre à chaque cran.
 */
export function effortColor(pourcent: number): string {
  const p = Math.max(0, Math.min(1, pourcent))
  return couleurContinue(7 * (1 - p))
}

// ── Tracés (repère centré, moitié gauche du corps) ──────────────────────────
//
// Planche anatomique plutôt que pictogramme : chaque muscle a le galbe de son
// corps charnu et l'effilement de ses tendons. Le canon fait 7,5 têtes pour
// 335 unités, l'homme est en position anatomique (bras légèrement écartés,
// paumes vers l'avant) — c'est la pose des planches, et celle qui dégage les
// aisselles, le grand dorsal et la face interne des bras.
//
// On ne décrit qu'une moitié : l'autre vient par symétrie (scale(-1,1)).

/** Silhouette du tronc, sous les muscles — sinon le fond passe entre les tracés. */
/**
 * Le tronc : épaules larges, taille reprise, hanches ouvertes.
 *
 * C'était une boîte aux coins arrondis, et le corps entier s'en ressentait —
 * on posait des muscles sculptés sur une caisse. Un tronc humain a trois
 * accidents et pas un de moins : le galbe du deltoïde en haut, le
 * rétrécissement à la taille, l'évasement aux crêtes iliaques.
 */
const BASE_CENTER =
  'M-8,47 C-17,49 -28,54 -35,63 C-38,76 -37,92 -34,105 C-31,116 -28,126 -26,136 ' +
  'C-25,142 -25,147 -26,152 C-28,161 -31,170 -30,180 L30,180 ' +
  'C31,170 28,161 26,152 C25,147 25,142 26,136 C28,126 31,116 34,105 ' +
  'C37,92 38,76 35,63 C28,54 17,49 8,47 Z'

const BASE_HALF: string[] = [
  // Le bras, d'un seul trait : galbe du deltoïde à l'épaule, resserrement au
  // coude, renflement des fléchisseurs à l'avant-bras, poignet fin, main.
  // C'était un tube d'épaisseur constante — un manche, pas un bras.
  'M-30.1,64.4 C-39.8,67.9 -47.4,77.8 -50.4,90.5 C-52.5,103.4 -52.7,117.5 -53.6,129.5 ' +
    'C-57.1,139.1 -61.1,151.6 -63.1,164.4 C-65.0,176.3 -65.6,186.3 -65.0,195.5 ' +
    'C-65.3,203.6 -56.4,205.0 -54.2,197.3 C-51.8,188.5 -51.2,178.5 -49.3,166.6 ' +
    'C-47.3,153.8 -46.2,140.8 -45.7,130.8 C-43.8,118.9 -39.6,105.4 -36.6,92.7 ' +
    'C-32.7,81.2 -27.4,72.9 -22.3,66.6 Z',
  // La jambe : cuisse pleine, genou repris, mollet renflé, cheville fine, pied.
  'M-30,171 C-34,190 -35,212 -33,232 C-32,244 -30,251 -27,256 ' +
    'C-26,268 -28,282 -27,296 C-26,308 -24,318 -22,326 ' +
    'C-20,334 -7,334 -5,326 C-4,318 -5,308 -5,296 ' +
    'C-5,282 -4,268 -4,256 C-3,244 -2,228 -2,210 ' +
    'C-2,194 -2,180 -2,172 Z',
]

// Repères verticaux partagés par les deux faces — sans quoi les deux corps
// n'ont pas les mêmes genoux ni les mêmes pieds côte à côte :
//   43 menton · 63 épaules · 100 bas des pectoraux · 152 crêtes iliaques
//   172 haut de cuisse · 254 genou · 266 mollet · 312 cheville · 323 pied

/** Exportés pour que le banc puisse vérifier qu'aucun muscle n'est sans tracé. */
export const FRONT_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  // Chaque muscle est un VENTRE : effilé en tendon aux deux bouts, renflé au
  // milieu, et bordé de courbes sur toute sa longueur. Aucun segment droit,
  // aucun angle vif — un muscle n'a ni l'un ni l'autre, et les dalles
  // rectangulaires d'avant se voyaient pour ce qu'elles étaient.
  ['scalenes', 'M-12,49 C-15,53 -16,58 -15,64 C-13,65 -11,63 -11,58 C-11,54 -11,51 -12,49 Z'],
  // Sterno-cléido-mastoïdien : la sangle oblique de la mastoïde au sternum.
  ['neck', 'M-9,43 C-12,49 -12,56 -9,62 C-6,63 -4,60 -4,55 C-4,50 -5,46 -6,43 C-7,42.5 -8,42.5 -9,43 Z'],
  // Trapèze supérieur : la pente cou → épaule, en éventail qui s'élargit.
  ['trapsUpper', 'M-9,47 C-17,52 -25,59 -30,66 C-28,70 -25,72 -21,73 C-18,64 -13,54 -9,47 Z'],
  ['deltLat', 'M-35.0,63.6 C-43.6,66.3 -50.1,75.4 -52.9,87.1 C-54.3,96.0 -53.4,103.2 -51.1,107.6 C-48.0,107.1 -45.1,101.5 -43.8,93.6 C-42.3,83.7 -39.6,73.0 -36.3,65.4 C-36.0,63.4 -34.9,62.6 -35.0,63.6 Z'],
  ['deltAnt', 'M-26.3,66.0 C-33.8,68.9 -40.3,78.0 -43.2,89.6 C-44.5,97.5 -44.4,103.6 -43.1,107.9 C-40.8,106.2 -38.8,100.5 -36.6,92.7 C-34.2,84.0 -30.5,73.4 -27.4,66.8 C-27.3,65.8 -26.1,65.0 -26.3,66.0 Z'],
  // Petit pectoral, sous la clavicule : petit éventail court.
  ['pecMinor', 'M-23,68 C-17,71 -12,75 -9,79 C-12,82 -18,82 -22,79 C-24,75 -24,70 -23,68 Z'],
  ['subscapularis', 'M-35.0,79 C-32.0,83 -30.0,87 -29.0,91 C-32.0,93 -35.0,92 -37.0,90 C-37.0,85 -36.0,81 -35.0,79 Z'],
  // Grand pectoral : faisceau claviculaire en éventail, à bords bombés.
  ['pecUpper', 'M-2,63 C-12,63 -22,66 -29,71 C-32,76 -33,81 -31,85 C-23,86 -13,87 -4,87 C-2,83 -2,73 -2,63 Z'],
  // …puis la masse sterno-costale, qui plonge en s'arrondissant vers l'aisselle.
  ['pecLower', 'M-3,89 C-13,90 -23,94 -30,100 C-33,106 -32,112 -29,115 C-21,117 -12,113 -6,107 C-3,102 -3,96 -3,89 Z'],
  // Obliques : nappe du flanc, plus large en haut, effilée vers la crête iliaque.
  ['obliques', 'M-20.4,145.9 C-21.5,144.9 -25.9,144.3 -26.7,139.8 C-27.6,135.4 -26.9,121.1 -25.3,119.3 C-23.7,117.4 -18.8,124.8 -17.2,128.7 C-15.6,132.6 -15.3,139.8 -15.9,142.7 C-16.4,145.6 -19.7,145.4 -20.4,145.9 C-21.2,146.5 -19.4,146.9 -20.4,145.9 Z'],
  // Dentelé antérieur : les digitations en doigts de gant, chacune arrondie.
  ['serratus', 'M-17.3,128.2 C-18.8,125.9 -25.0,118.9 -26.3,114.7 C-27.6,110.5 -26.1,105.5 -25.0,103.0 C-23.8,100.5 -21.0,100.2 -19.5,99.8 C-18.0,99.3 -16.2,95.4 -15.9,100.1 C-15.5,104.8 -17.1,123.5 -17.3,128.2 C-17.6,132.8 -15.8,130.4 -17.3,128.2 Z'],
  // Transverse : la sangle horizontale profonde, en croissant.
  ['transversus', 'M-20,132 C-13,129 -6,129 -1,131 C-1,137 -1,142 -1,146 C-8,148 -15,147 -20,143 C-22,139 -22,135 -20,132 Z'],
  ['coracobrachialis', 'M-40.7,99.2 C-43.9,106.7 -45.3,115.6 -45.4,122.7 C-43.6,124.0 -41.8,119.2 -40.6,111.3 C-39.5,104.4 -38.8,100.5 -40.7,99.2 Z'],
  ['biceps', 'M-50.2,101.7 C-55.5,110.0 -57.6,122.8 -56.0,132.2 C-52.2,133.8 -49.0,126.2 -47.3,115.3 C-46.0,107.4 -46.2,102.3 -50.2,101.7 Z'],
  ['brachialis', 'M-46.4,116.5 C-49.7,124.1 -50.9,132.0 -50.9,138.0 C-48.9,138.4 -46.8,131.6 -45.6,123.7 C-44.8,118.8 -45.4,116.6 -46.4,116.5 Z'],
  ['brachioradialis', 'M-53.6,129.5 C-59.8,136.6 -63.3,146.2 -65.0,157.1 C-65.3,165.1 -64.1,170.4 -62.3,171.7 C-59.7,168.0 -57.1,158.3 -54.4,147.6 C-52.0,138.9 -50.9,132.0 -53.6,129.5 Z'],
  ['pronators', 'M-51.4,134.9 C-55.1,139.4 -57.1,145.2 -56.8,150.3 C-53.9,150.7 -51.1,146.1 -49.2,140.3 C-47.7,137.5 -48.3,134.4 -51.4,134.9 Z'],
  ['forearmFlex', 'M-53.4,147.8 C-58.9,157.0 -61.8,168.7 -62.8,181.7 C-61.6,187.0 -58.7,187.4 -57.1,183.6 C-54.1,170.9 -52.2,159.1 -50.8,150.2 C-50.0,145.3 -51.8,144.0 -53.4,147.8 Z'],
  ['fingerFlex', 'M-53.0,164.0 C-56.3,172.6 -57.6,180.5 -57.7,187.6 C-56.0,189.9 -54.1,184.1 -52.9,176.2 C-51.8,169.3 -51.0,164.3 -53.0,164.0 Z'],
  // Main : dos de la main renflé, pouce détaché vers l'intérieur, doigts
  // refermés. Hors muscles suivis, mais reconnaissable comme une main.
  // Dos de la main : la paume, puis les quatre doigts en éventail serré, puis
  // le pouce à part, tourné vers l'intérieur.
  ['neutral', 'M-68.0,195.1 C-68.6,199.0 -70.5,204.8 -70.3,209.9 C-69.0,214.1 -65.4,216.7 -62.1,215.2 ' +
    'C-59.6,212.6 -57.9,207.8 -57.1,202.9 C-56.5,198.9 -58.0,195.6 -60.9,195.2 C-62.9,194.9 -63.9,194.7 -65.0,195.5 Z'],
  ['neutral', 'M-69.4,210.0 C-71.1,214.8 -71.9,219.8 -71.4,222.9 C-69.6,224.2 -68.1,221.4 -67.5,217.4 C-67.0,214.5 -67.5,211.3 -69.4,210.0 Z'],
  ['neutral', 'M-66.5,211.5 C-68.5,217.3 -69.3,222.2 -68.7,225.3 C-66.9,226.6 -65.5,223.8 -64.7,218.9 C-64.1,214.9 -64.6,211.8 -66.5,211.5 Z'],
  ['neutral', 'M-63.6,212.0 C-65.5,217.7 -66.3,222.7 -65.8,225.8 C-64.0,227.1 -62.3,223.3 -61.7,219.3 C-61.1,215.4 -61.6,212.3 -63.6,212.0 Z'],
  ['neutral', 'M-60.5,211.4 C-62.2,216.2 -63.0,221.2 -62.3,223.3 C-60.5,224.6 -59.1,221.8 -58.4,217.8 C-58.0,214.9 -58.5,211.8 -60.5,211.4 Z'],
  ['neutral', 'M-56.9,201.9 C-54.3,204.3 -53.9,208.4 -55.5,212.2 C-57.8,213.9 -59.6,212.6 -59.2,209.6 C-58.5,205.7 -58.1,202.7 -56.9,201.9 Z'],
  // Psoas : fuseau profond qui plonge vers le petit trochanter.
  ['hipFlexors', 'M-17,139 C-16,153 -13,167 -9,178 C-5,181 -2,179 -2,174 C-4,162 -8,150 -11,140 C-14,136 -16,136 -17,139 Z'],
  // Tenseur du fascia lata : lame effilée sur le bord de la hanche.
  ['tfl', 'M-27,160 C-31,170 -31,182 -29,193 C-27,194 -25,190 -25,185 C-25,176 -25,167 -26,161 C-26,159 -27,159 -27,160 Z'],
  // Quadriceps : trois ventres renflés au tiers supérieur, effilés au genou.
  ['vastusLat', 'M-12.4,229.1 C-13.0,228.6 -15.1,227.8 -15.9,225.9 C-16.6,224.0 -15.5,219.4 -16.8,217.7 C-18.0,216.0 -21.8,215.3 -23.3,215.6 C-24.8,215.9 -25.0,220.0 -25.5,219.6 C-26.0,219.2 -25.5,214.6 -26.3,213.1 C-27.1,211.5 -30.2,211.1 -30.5,210.2 C-30.8,209.3 -28.1,208.2 -28.3,207.7 C-28.4,207.2 -30.8,210.1 -31.4,207.1 C-32.0,204.0 -33.3,192.7 -32.1,189.3 C-30.8,185.9 -25.1,188.2 -23.9,186.9 C-22.6,185.6 -23.7,182.5 -24.5,181.5 C-25.4,180.6 -28.9,183.6 -29.0,181.1 C-29.0,178.6 -26.1,169.0 -24.9,166.8 C-23.6,164.5 -23.2,164.2 -21.6,167.6 C-20.1,170.9 -16.4,179.2 -15.4,186.6 C-14.4,194.1 -15.9,206.5 -15.6,212.4 C-15.4,218.3 -15.1,219.7 -14.1,221.9 C-13.1,224.2 -10.2,224.7 -9.9,225.9 C-9.6,227.1 -12.0,228.6 -12.4,229.1 C-12.9,229.7 -11.9,229.7 -12.4,229.1 Z'],
  ['rectusFemoris', 'M-18,181 C-22,203 -22,230 -17,250 C-13,252 -9,250 -9,245 C-8,221 -9,200 -10,182 C-13,178 -16,178 -18,181 Z'],
  ['adductors', 'M-8,182 C-13,200 -13,220 -10,236 C-7,238 -4,236 -3,232 C-3,214 -3,196 -4,183 C-5,179 -7,179 -8,182 Z'],
  ['gracilis', 'M-6,183 C-8,203 -8,225 -5,245 C-3,246 -2,243 -2,238 C-2,218 -2,199 -3,184 C-4,181 -5,181 -6,183 Z'],
  ['vastusMed', 'M-9.8,225.8 C-10.3,225.4 -12.1,223.6 -13.1,223.6 C-14.1,223.6 -15.5,226.5 -16.0,225.6 C-16.4,224.7 -14.9,219.5 -15.9,218.2 C-16.8,216.9 -20.5,218.3 -21.5,217.8 C-22.6,217.3 -22.7,216.6 -22.3,215.3 C-21.9,214.0 -20.2,210.6 -19.1,210.1 C-18.0,209.5 -16.3,212.6 -15.6,211.7 C-14.9,210.8 -15.9,205.4 -14.9,204.7 C-13.8,204.0 -10.3,204.0 -9.4,207.5 C-8.6,211.0 -9.7,222.8 -9.8,225.8 C-9.8,228.9 -9.2,226.2 -9.8,225.8 Z'],
  // Genou : la rotule, plaque ovale posée sur l'interligne.
  ['neutral', 'M-26,252 C-21,258 -11,258 -6,252 C-4,257 -5,263 -7,267 ' +
    'C-13,272 -21,271 -25,266 C-27,262 -27,256 -26,252 Z'],
  ['neutral', 'M-20,254 C-15,252 -10,253 -8,256 C-9,261 -13,264 -17,264 C-20,263 -21,258 -20,254 Z'],
  ['fibularis', 'M-26,267 C-28,286 -27,302 -24,312 C-21,312 -21,294 -22,278 C-23,269 -24,266 -26,267 Z'],
  ['tibialis', 'M-19.5,298.8 C-20.0,298.4 -21.0,301.9 -22.5,296.1 C-24.0,290.2 -28.2,273.0 -28.5,263.9 C-28.9,254.8 -26.0,242.3 -24.6,241.6 C-23.2,240.8 -20.9,249.7 -20.1,259.2 C-19.2,268.8 -19.6,292.2 -19.5,298.8 C-19.4,305.4 -19.0,299.3 -19.5,298.8 Z'],
  ['tibPost', 'M-10,270 C-12,285 -11,300 -8,311 C-5,311 -4,296 -5,282 C-6,273 -8,268 -10,270 Z'],
  ['gastroc', 'M-14.9,297.7 C-15.2,290.9 -17.5,265.9 -17.0,256.8 C-16.5,247.6 -13.3,241.2 -12.0,242.7 C-10.7,244.1 -8.5,256.3 -9.0,265.4 C-9.5,274.6 -13.9,292.3 -14.9,297.7 C-15.8,303.1 -14.5,304.5 -14.9,297.7 Z'],
  // Pied de face : la cheville, le coup de pied bombé, puis les orteils —
  // le gros orteil en dedans, les quatre autres décroissants.
  ['neutral', 'M-22,317 C-25,322 -25,329 -22,333 C-15,336 -8,335 -5,331 ' +
    'C-3,327 -4,322 -6,318 C-11,315 -17,315 -22,317 Z'],
  ['neutral', 'M-7,330 C-4,331 -2,334 -3,337 C-5,339 -8,338 -9,335 C-9,333 -8,331 -7,330 Z'],
  ['neutral', 'M-11,333 C-9,334 -8,337 -9,339 C-11,340 -13,339 -13,337 C-13,335 -12,333 -11,333 Z'],
  ['neutral', 'M-15,334 C-13,335 -12,337 -13,339 C-15,340 -17,339 -17,337 C-17,335 -16,334 -15,334 Z'],
  ['neutral', 'M-19,334 C-17,335 -16,337 -17,339 C-19,340 -21,338 -21,336 C-21,335 -20,334 -19,334 Z'],
]

export const BACK_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  // Même règle qu'à la face : des ventres, pas des dalles. Les tracés du dos
  // sont plus larges et se recouvrent en couches, comme dans le corps —
  // profonds d'abord, superficiels par-dessus.
  ['neckExt', 'M-6,43 C-8,50 -8,57 -6,63 C-3,64 -1,60 -1,54 C-1,49 -1,45 -2,43 C-3,42.5 -5,42.5 -6,43 Z'],
  ['neck', 'M-10,44 C-12,50 -12,57 -10,62 C-8,63 -7,59 -7,53 C-7,48 -7,45 -8,43 C-9,43 -10,43 -10,44 Z'],
  ['levator', 'M-7,50 C-11,56 -15,62 -17,68 C-15,70 -13,71 -11,71 C-10,64 -8,56 -7,50 Z'],
  ['deltLat', 'M-35.0,63.6 C-43.6,66.3 -50.1,75.4 -52.9,87.1 C-54.3,96.0 -53.4,103.2 -51.1,107.6 C-48.0,107.1 -45.1,101.5 -43.8,93.6 C-42.3,83.7 -39.6,73.0 -36.3,65.4 C-36.0,63.4 -34.9,62.6 -35.0,63.6 Z'],
  ['deltPost', 'M-27.4,66.8 C-35.0,69.7 -41.5,78.8 -44.3,90.5 C-45.6,98.4 -45.5,104.5 -44.2,108.7 C-41.9,107.1 -40.0,101.3 -37.7,93.5 C-35.3,84.8 -31.7,74.3 -28.6,67.7 C-28.4,66.7 -27.3,65.8 -27.4,66.8 Z'],
  // Trapèze : le grand losange en trois étages, aux bords tous incurvés.
  ['trapsUpper', 'M-3.5,110.6 C-5.3,106.0 -11.8,86.9 -14.5,83.0 C-17.2,79.2 -17.2,88.6 -19.5,87.6 C-21.8,86.6 -28.2,80.1 -28.4,77.0 C-28.5,73.9 -22.7,69.5 -20.7,68.9 C-18.6,68.2 -17.1,73.1 -16.3,73.0 C-15.5,72.9 -16.9,69.3 -16.1,68.3 C-15.3,67.3 -12.0,67.8 -11.6,66.7 C-11.2,65.7 -13.8,62.8 -13.6,61.8 C-13.4,60.9 -10.9,62.6 -10.3,60.9 C-9.6,59.2 -10.8,53.8 -9.6,51.6 C-8.4,49.3 -4.0,37.6 -3.0,47.4 C-2.0,57.3 -3.4,100.1 -3.5,110.6 C-3.5,121.1 -1.6,115.2 -3.5,110.6 Z'],
  ['trapsMid', 'M0,54 C-9,65 -18,75 -25,83 C-24,91 -22,98 -21,105 C-14,99 -7,94 0,90 C0,78 0,66 0,54 Z'],
  ['trapsLow', 'M0,92 C-8,97 -15,103 -21,108 C-17,119 -12,129 -8,136 C-5,131 -2,128 0,127 C0,115 0,103 0,92 Z'],
  // Grand dorsal : le V, large sous l'aisselle, effilé vers la crête iliaque.
  ['lats', 'M-15.1,136.5 C-16.7,133.6 -22.3,124.7 -25.0,118.8 C-27.7,112.9 -30.3,105.4 -31.3,101.1 C-32.2,96.9 -33.9,94.6 -30.7,93.2 C-27.5,91.8 -16.0,90.8 -11.9,93.0 C-7.9,95.1 -7.0,100.9 -6.5,106.0 C-6.0,111.2 -7.5,118.6 -8.9,123.7 C-10.4,128.8 -14.0,134.4 -15.1,136.5 C-16.1,138.6 -13.4,139.5 -15.1,136.5 Z'],
  ['rhomboids', 'M-4,72 C-10,78 -15,83 -17,88 C-16,93 -15,98 -14,102 C-10,98 -7,94 -4,91 C-4,85 -4,78 -4,72 Z'],
  // Fosse sus-épineuse : au-dessus de l'épine de l'omoplate.
  ['supraspinatus', 'M-30.0,68 C-24.0,70 -20.0,74 -18.0,79 C-22.0,82 -26.0,83 -29.0,83 C-30.0,78 -30.0,72 -30.0,68 Z'],
  ['rotatorCuff', 'M-31.0,74 C-25.0,78 -21.0,82 -19.0,87 C-23.0,90 -27.0,91 -30.0,92 C-31.0,86 -31.0,79 -31.0,74 Z'],
  // Petit rond puis grand rond : deux bandelettes empilées, chacune bombée.
  ['teresMinor', 'M-32.0,86 C-27.0,89 -23.0,92 -21.0,95 C-24.0,98 -28.0,99 -31.0,99 C-32.0,95 -32.0,90 -32.0,86 Z'],
  ['teres', 'M-30,99 C-25,102 -21,105 -19,108 C-22,112 -26,113 -29,112 C-30,108 -30,103 -30,99 Z'],
  // Multifides collés aux vertèbres, érecteurs en colonnes, carré des lombes
  // en dehors : trois couches du plus profond au plus superficiel.
  ['multifidus', 'M-5,124 C-7,140 -7,155 -5,165 C-3,166 -1,164 -1,158 C-1,145 -1,131 -1,124 C-2,122 -4,122 -5,124 Z'],
  ['erectors', 'M-0.4,160.6 C-1.1,158.6 -5.8,156.8 -6.3,148.7 C-6.7,140.5 -3.8,118.0 -2.7,111.8 C-1.6,105.7 -0.4,115.6 -0.4,111.6 C-0.4,107.6 -1.0,86.5 -0.6,87.8 C-0.4,89.2 -0.4,114.0 -0.4,119.9 C-0.4,125.7 -0.4,122.2 -0.4,123.0 C-0.4,123.8 -0.4,120.9 -0.4,124.8 C-0.4,128.7 -0.4,143.2 -0.4,146.4 C-0.4,149.7 -0.4,141.8 -0.4,144.2 C-0.4,146.6 -0.4,157.9 -0.4,160.6 C-1.7,163.4 -0.4,162.6 -0.4,160.6 Z'],
  ['quadratusLumborum', 'M-19,130 C-21,143 -21,155 -18,164 C-15,165 -13,163 -13,158 C-13,148 -13,138 -14,129 C-16,127 -18,127 -19,130 Z'],
  ['tricepsLong', 'M-42.0,101.0 C-46.6,111.4 -49.1,127.2 -48.7,137.4 C-46.9,138.7 -44.7,130.9 -43.0,120.1 C-41.5,111.2 -40.3,103.3 -42.0,101.0 Z'],
  ['tricepsLat', 'M-50.3,102.7 C-55.8,111.9 -58.2,126.8 -56.6,136.1 C-53.7,136.6 -50.8,124.9 -48.9,113.0 C-47.8,106.1 -48.2,102.0 -50.3,102.7 Z'],
  ['brachioradialis', 'M-53.6,129.5 C-59.8,136.6 -63.3,146.2 -65.0,157.1 C-65.3,165.1 -64.1,170.4 -62.3,171.7 C-59.7,168.0 -57.1,158.3 -54.4,147.6 C-52.0,138.9 -50.9,132.0 -53.6,129.5 Z'],
  ['forearmExt', 'M-57.1,145.2 C-63.7,155.2 -66.7,167.9 -66.9,182.1 C-64.6,186.5 -61.5,186.0 -59.7,181.2 C-57.7,168.3 -55.8,156.5 -54.6,148.6 C-53.8,143.7 -55.6,142.4 -57.1,145.2 Z'],
  // Main de dos : le dos de la main est plus large, les doigts plus visibles.
  ['neutral', 'M-66.0,195.4 C-69.6,198.9 -71.7,205.6 -70.5,210.9 C-69.1,215.1 -65.4,216.7 -62.1,215.2 ' +
    'C-59.6,212.6 -57.7,206.8 -56.9,201.9 C-56.3,197.9 -58.0,195.6 -60.9,195.2 C-62.9,194.9 -64.9,194.5 -66.0,195.4 Z'],
  ['neutral', 'M-69.4,210.0 C-71.3,215.8 -72.1,220.7 -71.5,223.9 C-69.7,225.2 -68.3,222.4 -67.5,217.4 C-66.9,213.5 -67.4,210.3 -69.4,210.0 Z'],
  ['neutral', 'M-66.5,211.5 C-68.5,217.3 -69.4,223.2 -68.9,226.3 C-67.1,227.6 -65.5,223.8 -64.7,218.9 C-64.1,214.9 -64.6,211.8 -66.5,211.5 Z'],
  ['neutral', 'M-63.6,212.0 C-65.5,217.7 -66.4,223.7 -65.9,226.8 C-64.1,228.1 -62.5,224.3 -61.7,219.3 C-61.1,215.4 -61.6,212.3 -63.6,212.0 Z'],
  ['neutral', 'M-60.5,211.4 C-62.4,217.2 -63.2,222.2 -62.5,224.3 C-60.7,225.6 -59.1,221.8 -58.4,217.8 C-57.8,213.9 -58.5,211.8 -60.5,211.4 Z'],
  // Moyen fessier en éventail, rotateurs profonds en barre, grand fessier en
  // masse ronde par-dessus.
  ['gluteMed', 'M-27,155 C-31,163 -32,173 -29,181 C-25,181 -22,178 -21,174 C-22,168 -23,161 -24,156 C-25,154 -26,153 -27,155 Z'],
  ['hipRotators', 'M-22,172 C-16,174 -10,176 -6,177 C-6,180 -6,182 -6,183 C-12,184 -18,182 -22,179 C-23,177 -23,174 -22,172 Z'],
  ['gluteMax', 'M-26,167 C-33,180 -32,198 -22,208 C-11,212 -2,203 -1,189 C-1,180 -1,172 -2,167 C-11,162 -21,162 -26,167 Z'],
  ['bicepsFemoris', 'M-11.5,234.5 C-12.0,230.9 -13.3,213.6 -14.6,212.6 C-16.0,211.7 -18.4,225.9 -19.6,228.6 C-20.9,231.3 -21.4,233.8 -22.1,228.6 C-22.8,223.4 -23.9,204.9 -23.9,197.4 C-23.9,189.8 -22.8,185.9 -21.9,183.3 C-20.9,180.6 -19.3,180.5 -18.2,181.4 C-17.1,182.2 -17.2,187.0 -15.1,188.3 C-12.9,189.6 -6.0,181.4 -5.4,189.1 C-4.8,196.8 -10.5,227.0 -11.5,234.5 C-12.5,242.1 -11.0,238.2 -11.5,234.5 Z'],
  ['hamsInner', 'M-16,209 C-18,230 -16,249 -13,262 C-9,264 -6,261 -5,255 C-4,236 -6,219 -9,210 C-12,206 -14,206 -16,209 Z'],
  ['neutral', 'M-27,262 C-20,269 -9,269 -4,262 C-3,266 -4,270 -5,273 C-12,278 -21,277 -26,272 C-27,269 -27,265 -27,262 Z'],
  // Les deux chefs du jumeau, chacun bombé, puis le soléaire qui déborde.
  ['gastroc', 'M-16.0,279.8 C-16.6,279.0 -17.9,274.8 -19.5,274.7 C-21.1,274.6 -23.4,281.0 -25.6,279.2 C-27.7,277.3 -31.7,269.2 -32.4,263.7 C-33.0,258.1 -31.1,250.8 -29.5,246.0 C-27.8,241.3 -23.9,235.6 -22.4,235.2 C-20.9,234.8 -21.3,243.3 -20.4,243.7 C-19.5,244.1 -17.9,238.2 -17.1,237.4 C-16.2,236.7 -16.7,236.0 -15.4,239.3 C-14.2,242.6 -10.6,251.8 -9.6,257.2 C-8.6,262.6 -9.3,268.4 -9.6,271.9 C-9.9,275.5 -10.5,277.1 -11.6,278.4 C-12.7,279.7 -15.2,279.6 -16.0,279.8 C-16.7,280.1 -15.4,280.7 -16.0,279.8 Z'],
  ['gastroc', 'M-14,271 C-16,284 -16,299 -12,311 C-9,315 -6,311 -6,303 C-6,291 -7,280 -9,272 C-11,268 -13,268 -14,271 Z'],
  ['soleus', 'M-24,300 C-27,309 -27,318 -24,325 C-19,328 -12,327 -8,323 C-6,317 -6,309 -8,302 C-13,299 -20,298 -24,300 Z'],
  // Pied de dos : le talon, plus haut et plus étroit que l'avant-pied.
  ['neutral', 'M-23,324 C-25,330 -23,335 -18,336 C-11,336 -6,334 -5,330 ' +
    'C-4,326 -5,322 -7,320 C-13,319 -19,320 -23,324 Z'],
]


/**
 * Trames, dégradés et relief, définis UNE SEULE FOIS pour toute la page.
 *
 * Ils vivaient dans le SVG de la vignette. En plein écran, c'est un autre SVG :
 * les références n'y résolvaient que par accident, tant que la vignette restait
 * montée derrière. Les dupliquer donnerait deux fois les mêmes identifiants
 * dans le document, ce qui n'est pas valide — d'où ce composant unique.
 */
function MannequinDefs() {
  return (
      <defs>
        {/* Un halo clair sans décalage détoure la silhouette : le corps est
            devenu sombre, l'ombre portée seule ne le décollait plus d'un fond
            sombre. Puis l'ombre, qui donne l'assise.

            Réglé en unités RELATIVES à la boîte du tracé : la vignette fait
            360 unités de large et le plein écran 160, donc un rayon absolu
            donnait un liseré discret d'un côté et une auréole envahissante de
            l'autre. */}
        <filter
          id="mb-relief"
          x="-14%"
          y="-8%"
          width="128%"
          height="118%"
          primitiveUnits="objectBoundingBox"
        >
          <feDropShadow dx="0" dy="0" stdDeviation="0.006" floodColor="#F5EFE7" floodOpacity="0.22" />
          <feDropShadow dx="0" dy="0.006" stdDeviation="0.010" floodColor="#000" floodOpacity="0.55" />
        </filter>
        <linearGradient id="mb-volume" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.09" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.01" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
        <radialGradient id="mb-galbe" cx="38%" cy="26%" r="78%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.11" />
          <stop offset="58%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
        </radialGradient>
        {/* Trames de fibres. Des traits sombres très fins et très espacés :
            à la taille d'une vignette, une trame dense vire au gris uni et
            mange la couleur, qui est la seule information portée. */}
        {[
          ['mb-fibres-v', 'M0,0 L0,4', 0],
          ['mb-fibres-h', 'M0,0 L4,0', 0],
          ['mb-fibres-o', 'M0,0 L0,4', 32],
        ].map(([id, trait, angle]) => (
          <pattern
            key={String(id)}
            id={String(id)}
            width="2.1"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${angle})`}
          >
            <path d={String(trait)} stroke="rgba(20,16,13,0.30)" strokeWidth="0.55" fill="none" />
          </pattern>
        ))}
      </defs>
  )
}

export function MuscleBodyDiagram({
  loads,
  sessions = [],
  sexe = 'H',
  maintenant = Date.now(),
  onSoreness,
  onPret,
  onExercice,
  onSeance,
}: {
  loads: Record<string, GroupLoad>
  /** Journal, pour nommer ce qui a chargé ou soulagé chaque muscle. */
  sessions?: MuscuSession[]
  /** Silhouette à dessiner — vient du sexe déclaré dans Poids › profil. */
  sexe?: Sexe
  /**
   * L'instant que le mannequin représente. Il avance quand on projette.
   *
   * Passé jusqu'ici et pas seulement dans `loads` : la fiche d'un muscle date
   * aussi son dernier travail. Sans ce paramètre, une projection à +2 j aurait
   * affiché « prêt » en tête et « il y a 1 j » juste en dessous — deux horloges
   * dans le même encart, celle qui a raison n'étant plus devinable.
   */
  maintenant?: number
  /**
   * Déclare des courbatures sur un groupe : + N jours de récup (0 = annuler).
   * La région suit, parce que c'est elle que la base d'observations indexe — un
   * libellé de groupe couvre plusieurs zones, aux vitesses différentes.
   */
  onSoreness?: (region: MuscleRegion, extra: number) => void
  /** Déclare le muscle totalement remis (ou annule cette déclaration). */
  onPret?: (region: MuscleRegion, pret: boolean) => void
  /** Ouvre une séance sur un exercice proposé depuis la fiche d'un muscle. */
  onExercice?: (name: string) => void
  /** Ramène au journal, sur une séance déjà enregistrée. */
  onSeance?: (sessionId: string) => void
}) {
  const [selected, setSelected] = useState<MuscleRegion | null>(null)
  // Corps affiché en plein écran, ou null pour la vue à deux vignettes.
  const [zoom, setZoom] = useState<Face | null>(null)

  // Repos par muscle, vitesse de récupération de la zone comprise. Calcul
  // partagé avec le générateur de séance : une seule définition.
  const byRegion = reposParMuscle(loads)
  // Ce qui a chargé et ce qui a soulagé chaque muscle, nommément.
  const histo = historiqueParMuscle(sessions, maintenant)

  const fill = (r: MuscleRegion | 'neutral') =>
    r === 'neutral' ? NEUTRAL : recoveryColor(byRegion[r]?.jours, byRegion[r]?.intensite)

  return (
    <div className="space-y-2">
      <svg
        viewBox="0 0 360 356"
        className="mx-auto w-full max-w-md"
        stroke="rgba(23,19,16,0.55)"
        strokeWidth="0.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-label="Récupération musculaire"
      >
        {/* Volume et détourage. Le mannequin restait un aplat découpé : les
            muscles se lisaient un par un, mais le corps ne se lisait pas comme
            un corps. Trois effets, aucun ne touche à la teinte — la couleur
            porte l'information, elle ne doit pas être décorée.

            • une ombre portée décolle la silhouette du fond ;
            • un dégradé vertical très léger creuse le volume, plus clair en
              haut où la lumière tombe ;
            • un liseré interne adoucit la découpe des plaques. */}
        <MannequinDefs />
        <Figure cx={90} half={FRONT_HALF} fill={fill} back={false} sexe={sexe} onZoom={() => setZoom('front')} />
        <Figure cx={270} half={BACK_HALF} fill={fill} back sexe={sexe} onZoom={() => setZoom('back')} />
        <text x="90" y="350" textAnchor="middle" fill="#a8a29e" fontSize="11" stroke="none">
          Face
        </text>
        <text x="270" y="350" textAnchor="middle" fill="#a8a29e" fontSize="11" stroke="none">
          Dos
        </text>
      </svg>
      <p className="text-center text-[10px] text-muted">🔍 Touche un corps pour l'agrandir et viser un muscle</p>

      {/* Spectre en sections de 12 h : une case par demi-journée tant que le
          muscle récupère. Le dégradé continu laissait croire à une dérive
          lente ; les cases disent qu'on avance par crans, deux par jour. */}
      <div className="px-1">
        <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full">
          {SECTIONS.map((j) => (
            <div
              key={j}
              className="h-full flex-1"
              style={{ background: recoveryColor(j) }}
              title={j < 1 ? `${j * 24} h` : `${j} j`}
            />
          ))}
        </div>
        <div className="mt-0.5 flex text-[10px] text-muted">
          {ETATS.map((e) => (
            <span key={e.label} className={`${e.align} whitespace-nowrap`} style={{ flexGrow: e.cases, flexBasis: 0 }}>
              {e.label}
            </span>
          ))}
        </div>
        <p className="mt-0.5 text-center text-[9px] text-muted">
          Une case = {PAS_HEURES} h · le corps change de couleur deux fois par jour
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted">
        <span className="font-semibold">Intensité du dernier travail :</span>
        {(['principal', 'secondaire', 'leger'] as Sollicitation[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded"
              style={{ background: recoveryColor(PAS_JOURS, s === 'principal' ? 1 : s === 'secondaire' ? 0.6 : 0.3) }}
            />
            {SOLLICITATION_MARQUEUR[s]} {s === 'leger' ? 'appoint' : s}
          </span>
        ))}
      </div>

      {Object.keys(loads).length === 0 ? (
        <p className="text-center text-[11px] text-muted">
          Enregistre des séances avec un groupe visé : le mannequin se colorera tout seul.
        </p>
      ) : null}

      {zoom ? (
        <ZoomBody
          face={zoom}
          fill={fill}
          sexe={sexe}
          onFace={setZoom}
          onPick={setSelected}
          onClose={() => setZoom(null)}
        />
      ) : null}

      {selected ? (
        <MuscleSheet
          region={selected}
          info={byRegion[selected]}
          histo={histo[selected]}
          onSoreness={onSoreness}
          onPret={onPret}
          onSeance={
            onSeance
              ? (id) => {
                  setZoom(null) // remonter au journal sort du plein écran
                  onSeance(id)
                }
              : undefined
          }
          onExercice={
            onExercice
              ? (name) => {
                  setZoom(null) // ouvrir une séance sort du plein écran
                  onExercice(name)
                }
              : undefined
          }
          onClose={() => setSelected(null)}
        />
      ) : null}

    </div>
  )
}

/**
 * Corps en plein écran.
 *
 * À la taille des vignettes, viser le deltoïde postérieur plutôt que le trapèze
 * relève du hasard : c'est ici, et seulement ici, que les muscles se touchent
 * un par un. Les deux faces restent accessibles sans repasser par la vue
 * d'ensemble — on tourne autour du corps.
 */
function ZoomBody({
  face,
  fill,
  sexe,
  onFace,
  onPick,
  onClose,
}: {
  face: Face
  fill: (r: MuscleRegion | 'neutral') => string
  sexe: Sexe
  onFace: (f: Face) => void
  onPick: (r: MuscleRegion) => void
  onClose: () => void
}) {
  const cadre = useRef<HTMLDivElement>(null)
  const dessin = useRef<SVGSVGElement>(null)
  const [vue, setVue] = useState({ k: 1, x: 0, y: 0 })
  const gestes = useRef({
    pointeurs: new Map<number, { x: number; y: number }>(),
    // Écart et centre au moment où le second doigt s'est posé : tout le geste
    // se calcule PAR RAPPORT à cet instant, pas image par image. Cumuler des
    // deltas fait dériver le dessin sous les doigts.
    ecart0: 0,
    centre0: { x: 0, y: 0 },
    vue0: { k: 1, x: 0, y: 0 },
    // Le dernier appui simple : pour distinguer un double-tape d'un clic.
    dernierTap: 0,
  })

  const local = (e: React.PointerEvent) => {
    const svg = dessin.current
    const ctm = svg?.getScreenCTM?.()
    if (!svg || !ctm) return { x: e.clientX, y: e.clientY }
    const p = svg.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    const u = p.matrixTransform(ctm.inverse())
    return { x: u.x, y: u.y }
  }
  const paires = () => [...gestes.current.pointeurs.values()]
  const ecart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y)
  const milieu = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  })

  function pointerDown(e: React.PointerEvent) {
    const g = gestes.current
    g.pointeurs.set(e.pointerId, local(e))
    console.log('DOWN', e.pointerId, g.pointeurs.size)
    if (g.pointeurs.size === 2) {
      const [a, b] = paires()
      g.ecart0 = ecart(a, b)
      g.centre0 = milieu(a, b)
      g.vue0 = vue
      // Capturer le pointeur garde le geste même si un doigt sort du cadre.
      // Sous try : la capture échoue si le pointeur n'est plus actif, et
      // l'exception remontait jusqu'à démonter le composant — on perdait le
      // mannequin entier pour un confort de geste.
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Sans capture, le geste reste piloté par la carte des pointeurs.
      }
    }
  }

  function pointerMove(e: React.PointerEvent) {
    const g = gestes.current
    if (!g.pointeurs.has(e.pointerId)) return
    g.pointeurs.set(e.pointerId, local(e))
    console.log('MOVE', g.pointeurs.size, g.ecart0)
    if (g.pointeurs.size < 2) return
    const [a, b] = paires()
    const d = ecart(a, b)
    if (g.ecart0 < 1) return
    // Bornes : sous 1 on repasserait sous la taille d'origine sans raison, et
    // au-delà de 6 un muscle occupe l'écran entier et on perd le corps.
    const k = Math.min(6, Math.max(1, g.vue0.k * (d / g.ecart0)))
    const c = milieu(a, b)
    // Le point pincé reste sous les doigts : c'est ce qui fait qu'on a
    // l'impression de tenir le dessin, et non de piloter un curseur.
    setVue({
      k,
      x: c.x - ((g.centre0.x - g.vue0.x) / g.vue0.k) * k,
      y: c.y - ((g.centre0.y - g.vue0.y) / g.vue0.k) * k,
    })
  }

  function pointerUp(e: React.PointerEvent) {
    const g = gestes.current
    g.pointeurs.delete(e.pointerId)
    if (g.pointeurs.size === 1) {
      // Un doigt relâché sur deux : on repart d'un geste neuf plutôt que de
      // laisser le dessin sauter au prochain mouvement.
      const [a] = paires()
      g.ecart0 = 0
      g.centre0 = a
      g.vue0 = vue
    }
    if (g.pointeurs.size === 0) {
      const t = e.timeStamp
      if (t - g.dernierTap < 320) {
        setVue({ k: 1, x: 0, y: 0 })
        g.dernierTap = 0
      } else {
        g.dernierTap = t
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* En PWA plein écran (viewport-fit=cover), le haut de l'overlay passe SOUS
          l'heure et la batterie de l'iPhone : la barre d'outils doit descendre
          de l'encoche. Idem en bas pour la barre d'accueil. */}
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex gap-1">
          {(['front', 'back'] as Face[]).map((f) => (
            <button
              key={f}
              onClick={() => onFace(f)}
              className={`chip text-xs font-bold transition ${
                face === f ? 'bg-copper text-white' : 'bg-white/5 text-muted hover:text-ink'
              }`}
            >
              {f === 'front' ? 'Face' : 'Dos'}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          aria-label="Quitter le plein écran"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg leading-none text-ink transition hover:bg-white/20"
        >
          ✕
        </button>
      </div>

      <div
        ref={cadre}
        className="min-h-0 w-full flex-1 overflow-hidden"
        style={{ touchAction: 'none' }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <svg
          ref={dessin}
          viewBox="-80 0 160 342"
          className="h-full w-full"
          stroke="rgba(23,19,16,0.55)"
          strokeWidth={0.5 / vue.k}
          strokeLinejoin="round"
          strokeLinecap="round"
          aria-label={face === 'front' ? 'Corps de face' : 'Corps de dos'}
        >
          {/* Le zoom est une TRANSFORMATION du dessin, pas un agrandissement de
              l'image : les tracés restent vectoriels et le trait s'affine à
              mesure qu'on grossit — sinon il épaissirait comme une loupe sur
              une photo. */}
          <g transform={`translate(${vue.x} ${vue.y}) scale(${vue.k})`}>
            <Figure
              cx={0}
              half={face === 'front' ? FRONT_HALF : BACK_HALF}
              fill={fill}
              back={face === 'back'}
              sexe={sexe}
              onPick={onPick}
            />
          </g>
        </svg>
      </div>

      <p className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-1 text-center text-[11px] text-muted">
        {vue.k > 1.05
          ? 'Deux doigts pour ajuster · double-tape pour revenir'
          : 'Touche un muscle · pince à deux doigts pour agrandir'}
      </p>
    </div>
  )
}


/**
 * Une ligne d'historique : ce qui a chargé le muscle, ou ce qui l'a soulagé.
 *
 * Au clic, on retourne à la séance DÉJÀ FAITE, pas vers un exercice vierge :
 * après avoir vu d'où vient la couleur, ce qu'on veut c'est relire ce qu'on a
 * réellement soulevé ce jour-là. La liste « pour le travailler », en dessous,
 * garde l'autre intention — commencer quelque chose de neuf.
 */
function Ligne({
  emoji,
  titre,
  exo,
  onSeance,
  onClose,
}: {
  emoji: string
  titre: string
  exo: DernierExo
  onSeance?: (sessionId: string) => void
  onClose: () => void
}) {
  const corps = (
    <>
      <span className="shrink-0">{emoji}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="text-muted">{titre} : </span>
        <span className="font-semibold text-ink">{exo.nom}</span>
      </span>
      <span className="shrink-0 text-[10px] text-muted">{fmtAnciennete(exo.jours)}</span>
    </>
  )
  const classes = 'flex w-full items-baseline gap-1.5 rounded-lg px-1.5 py-1 text-left text-xs'
  return onSeance ? (
    <button
      onClick={() => {
        onSeance(exo.sessionId)
        onClose()
      }}
      className={`${classes} transition hover:bg-copper/10`}
      title={`Revoir la séance « ${exo.seance} » · ${Math.round(exo.intensite * 100)} % de l’exercice pour ce muscle`}
    >
      {corps}
      <span className="shrink-0 text-[10px] text-copper">↗</span>
    </button>
  ) : (
    <div className={classes}>{corps}</div>
  )
}

/** Fiche affichée au clic sur un muscle du schéma. */
function MuscleSheet({
  region,
  info,
  histo,
  onExercice,
  onSeance,
  onSoreness,
  onPret,
  onClose,
}: {
  region: MuscleRegion
  info?: ReposMuscle
  /** Dernier travail et dernière récup — ce que la couleur seule ne dit pas. */
  histo?: HistoriqueMuscle
  /** Ouvre une séance sur cet exercice, quand la page sait le faire. */
  onExercice?: (name: string) => void
  /** Renvoie vers une séance déjà enregistrée du journal. */
  onSeance?: (sessionId: string) => void
  /** Déclare des courbatures — sur le GROUPE qui a produit cette sollicitation. */
  onSoreness?: (region: MuscleRegion, extra: number) => void
  /** Déclare le muscle totalement remis. */
  onPret?: (region: MuscleRegion, pret: boolean) => void
  onClose: () => void
}) {
  const [courbOuvert, setCourbOuvert] = useState(false)
  const propositions = exercicesPourMuscle(region, 8)
  const color = recoveryColor(info?.jours, info?.intensite)
  const reste = info ? resteAvantPret(info.jours, region) : 0
  const actuel = info?.soreExtra ?? 0
  const totalementBon = info?.sorePret === true
  // Rien à prolonger sur un muscle jamais travaillé : sans séance d'origine, il
  // n'y a pas de groupe auquel rattacher la déclaration.
  const declarable = Boolean(onSoreness && info)
  // Les cinq états sont ceux de la légende du spectre, dans le même ordre.
  const etat = !info
    ? 'Froid — jamais travaillé sur les séances chargées'
    : info.jours < PAS_JOURS
      ? 'Brûlant'
      : info.jours <= 2
        ? 'En récupération'
        : info.jours <= 4
          ? 'Bientôt prêt'
          : info.jours <= 10
            ? 'Prêt'
            : 'Froid'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-b-none p-5 sm:rounded-xl2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          {/* Le nom du muscle EST le bouton de déclaration. Le mur de pastilles
              qui servait à ça a disparu : on tient le muscle sous le doigt, il
              n'y a aucune raison d'aller le rechercher dans une liste. */}
          {declarable ? (
            <button
              onClick={() => setCourbOuvert((o) => !o)}
              className="min-w-0 text-left"
              title="Toucher pour ajuster le ressenti de ce muscle"
            >
              <h2 className="text-base font-extrabold text-ink">{MUSCLE_LABELS[region]}</h2>
              {/* Le repère du ressenti va sur la ligne du dessous, pas dans le
                  titre : « Pectoral supérieur (faisceau claviculaire) » remplit
                  déjà la largeur, et l'émoji finissait seul sur une ligne. Rien
                  d'affiché tant que rien n'est déclaré — un visage grimaçant sur
                  un muscle au barème automatique raconterait n'importe quoi. */}
              <span className="text-[10px] text-muted">
                {totalementBon ? (
                  <span style={{ color: 'rgb(var(--sage-dark))' }}>✅ déclaré totalement bon</span>
                ) : actuel !== 0 ? (
                  <span style={{ color: actuel < 0 ? 'rgb(var(--sage))' : 'rgb(var(--clay))' }}>
                    {actuel < 0 ? '🌿' : '😣'} ressenti ajusté : {fmtAjust(actuel)}
                  </span>
                ) : (
                  'toucher pour ajuster le ressenti'
                )}
              </span>
            </button>
          ) : (
            <h2 className="min-w-0 text-base font-extrabold text-ink">{MUSCLE_LABELS[region]}</h2>
          )}
          <button onClick={onClose} className="shrink-0 text-muted hover:text-ink">
            ✕
          </button>
        </div>

        {/* Curseur, ouvert au clic sur le nom. Le barème se trompe dans les deux
            sens : on peut donc ajouter du retard OU de l'avance. La déclaration
            porte sur le GROUPE qui a produit la sollicitation — c'est lui que le
            journal connaît —, et on le dit pour que l'effet ne surprenne pas. */}
        {declarable && courbOuvert ? (
          <div className="mb-2 rounded-xl2 border border-line/60 p-2.5">
            {/* Le texte suit l'état : « corrige-le » au-dessus d'une barre
                neutralisée se lirait comme une invitation qui ne marche pas. */}
            <div className="mb-2 text-[11px] text-muted">
              {totalementBon ? (
                <>
                  Déclaré remis sur <b className="text-ink">{MUSCLE_LABELS[region]}</b>. Annule ci-dessous pour revenir
                  à la barre.
                </>
              ) : (
                // Le muscle et rien d'autre. Ce texte annonçait le LIBELLÉ de la
                // séance — et c'était exact, la correction s'appliquait alors à
                // tout ce que le libellé couvre. Un ressenti au cou déclaré
                // après un portage noté « Corps entier » reculait le corps
                // entier ; maintenant il ne recule que le cou.
                <>
                  Le barème se trompe ? Corrige-le. S'applique à <b className="text-ink">{MUSCLE_LABELS[region]}</b>{' '}
                  seul — les autres muscles de la séance ne bougent pas.
                </>
              )}
            </div>
            {/* Neutralisée sous « totalement bon » : la barre serait à 0, donc
                elle afficherait « barème automatique » juste au-dessus d'un
                bouton qui dit le contraire. Les deux répondent à la même
                question, un seul peut parler à la fois. */}
            <input
              type="range"
              min={AJUST_MIN}
              max={AJUST_MAX}
              step={AJUST_PAS}
              value={actuel}
              disabled={totalementBon}
              onChange={(e) => onSoreness!(region, Number(e.target.value))}
              className={`h-1.5 w-full appearance-none rounded-full ${
                totalementBon ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
              }`}
              style={{
                // Vert du côté « ça va mieux », argile du côté « ça tire » : le
                // curseur dit dans quel sens on va avant même de lire le chiffre.
                background: `linear-gradient(to right, rgb(var(--sage)) 0%, rgb(var(--line)) ${
                  (100 * -AJUST_MIN) / (AJUST_MAX - AJUST_MIN)
                }%, rgb(var(--clay)) 100%)`,
                // Neutre pile au milieu : un pouce couleur argile sur un muscle
                // au barème automatique annoncerait des courbatures déclarées.
                accentColor:
                  actuel === 0 ? 'rgb(var(--muted))' : actuel < 0 ? 'rgb(var(--sage))' : 'rgb(var(--clay))',
              }}
            />
            <div className="mt-1 flex items-baseline justify-between text-[10px] text-muted">
              <span>{fmtAjust(AJUST_MIN)} · va mieux</span>
              <span
                className="text-xs font-bold"
                style={{ color: actuel === 0 ? 'rgb(var(--muted))' : actuel < 0 ? 'rgb(var(--sage))' : 'rgb(var(--clay))' }}
              >
                {totalementBon ? '—' : actuel === 0 ? 'barème automatique' : fmtAjust(actuel)}
              </span>
              <span>{fmtAjust(AJUST_MAX)} · ça tire</span>
            </div>

            {/* « Totalement bon » n'est pas un cran de plus à gauche de la barre :
                −1 j ne suffit pas toujours à dire qu'un muscle est prêt, et te
                faire tirer une barre jusqu'à une borne trop courte reviendrait à
                te faire déclarer autre chose que ce que tu ressens. Bouton à
                part, donc, et il court-circuite le barème au lieu de le corriger. */}
            {onPret ? (
              <button
                onClick={() => onPret(region, !totalementBon)}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl2 border py-2 text-xs font-bold transition"
                style={{
                  borderColor: totalementBon ? 'rgb(var(--sage-dark))' : 'rgb(var(--line))',
                  background: totalementBon ? 'rgb(var(--sage-dark) / .18)' : 'transparent',
                  color: totalementBon ? 'rgb(var(--sage-dark))' : 'rgb(var(--muted))',
                }}
              >
                ✅ {totalementBon ? 'Totalement bon — annuler' : 'C’est totalement bon'}
              </button>
            ) : null}
            {totalementBon ? (
              <p className="mt-1 text-[10px]" style={{ color: 'rgb(var(--sage-dark))' }}>
                Le muscle est traité comme prêt, quel que soit le barème. La déclaration
                s’effacera d’elle-même dès que tu retravailleras {MUSCLE_LABELS[region].toLowerCase()}.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* État de récupération : le libellé, sa place sur le spectre, et le
            temps qu'il reste à attendre — les trois questions qu'on se pose en
            touchant un muscle. */}
        <div className="rounded-xl2 border border-line/60 p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-bold" style={{ color }}>
              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
              {etat}
            </span>
            <span className="shrink-0 text-[11px] font-semibold text-muted">
              {!info
                ? 'disponible'
                : reste > 0
                  ? `prêt dans ~${fmtDelai(reste)}`
                  : 'prêt à travailler'}
            </span>
          </div>

          {/* Le même spectre que sous le mannequin, avec le curseur du muscle. */}
          <div className="relative mt-2">
            <div className="flex h-2 w-full gap-px overflow-hidden rounded-full">
              {SECTIONS.map((j) => (
                <div key={j} className="h-full flex-1" style={{ background: recoveryColor(j) }} />
              ))}
            </div>
            <span
              className="absolute -top-0.5 h-3 w-1 -translate-x-1/2 rounded-full border border-black/30 bg-white"
              style={{ left: `${positionSpectre(info?.jours)}%` }}
            />
          </div>
        </div>

        {/* Ce qui est arrivé au muscle, nommément. La couleur dit où il en est,
            pas pourquoi : entre un développé couché et vingt minutes de sangle,
            le pectoral affiche la même teinte sans que ça signifie la même chose. */}
        {histo?.travail || histo?.recup ? (
          <div className="mt-2 space-y-1">
            {histo.travail ? (
              <Ligne emoji="💪" titre="Dernier travail" exo={histo.travail} onSeance={onSeance} onClose={onClose} />
            ) : null}
            {histo.recup ? (
              <Ligne emoji="🧘" titre="Dernière récup" exo={histo.recup} onSeance={onSeance} onClose={onClose} />
            ) : null}
          </div>
        ) : null}

        {info ? (
          <p className="mt-2 text-xs text-muted">
            Compté <b className="text-ink">{fmtAnciennete(info.joursReels)}</b> via{' '}
            <b className="text-ink">{info.label}</b>
            {/* « Récupération plus rapide » était faux depuis que la part donne
                une avance de départ et non un temps accéléré : le muscle ne
                revient pas plus vite, il avait moins à réparer. La nuance compte
                — c'est elle qui explique pourquoi la couleur bouge peu ensuite. */}
            {info.intensite < 1
              ? ` — en secondaire (${Math.round(info.intensite * 100)} %), donc bien moins entamé : il part avec de l’avance.`
              : ' — en moteur principal.'}
            {/* Le muscle a pu être retouché depuis, plus légèrement : la ligne
                « Dernier travail » au-dessus le dit, et sans cette phrase les deux
                dates se contredisent à l'écran. C'est la sollicitation la plus
                lourde qui commande, pas la plus récente. */}
            {histo?.travail && histo.travail.date > info.dateSeance
              ? ' Depuis, la zone n’a été reprise que légèrement : c’est cette séance-là qui commande encore.'
              : ''}
            {VITESSE_RECUP[region] > 1
              ? ' Cette zone récupère vite.'
              : VITESSE_RECUP[region] < 1
                ? ' Cette zone est lente à revenir.'
                : ''}
            {/* L'intensité déclarée agit sur la couleur : sans cette phrase, deux
                séances identiques au journal donneraient deux teintes différentes
                sans qu'on puisse savoir pourquoi. */}
            {info.intensiteId && info.intensiteRecup ? (
              <>
                {' '}
                Séance déclarée{' '}
                <b className="text-ink">
                  {INTENSITES[info.intensiteId].emoji} {INTENSITES[info.intensiteId].label.toLowerCase()}
                </b>
                {` — ${fmtAjust(info.intensiteRecup)} de récupération.`}
              </>
            ) : null}
            {/* Même raison que pour l'intensité : le sommeil change la couleur,
                donc il doit être nommé. Sans cette phrase, un muscle qui recule
                d'un cran après une nuit blanche serait incompréhensible. */}
            {info.sommeilDelta ? (
              <>
                {' '}
                Sommeil depuis :{' '}
                <b style={{ color: info.sommeilDelta < 0 ? 'rgb(var(--clay))' : 'rgb(var(--sage-dark))' }}>
                  {fmtAjust(info.sommeilDelta)}
                </b>
                .
              </>
            ) : null}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Aucun exercice récent ne vise ce muscle. C'est peut-être l'occasion.
          </p>
        )}

        {propositions.length > 0 ? (
          <div className="mt-3 border-t border-line/60 pt-3">
            <div className="mb-1.5 text-xs font-bold text-ink">💡 Pour le travailler</div>
            <ul className="max-h-52 space-y-0.5 overflow-y-auto">
              {propositions.map((e) => {
                const ligne = (
                  <>
                    <span className="min-w-0 flex-1 truncate text-ink">{e.name}</span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {e.sets}×{e.reps}
                    </span>
                    <span
                      className="w-9 shrink-0 text-right text-[10px] font-bold"
                      style={{ color: recoveryColor(0, e.intensite) }}
                      title={`${Math.round(e.intensite * 100)} % de l'exercice pour ce muscle`}
                    >
                      {Math.round(e.intensite * 100)} %
                    </span>
                  </>
                )
                return (
                  <li key={e.name}>
                    {onExercice ? (
                      <button
                        onClick={() => {
                          onExercice(e.name)
                          onClose()
                        }}
                        className="flex w-full items-baseline gap-2 rounded-lg px-1.5 py-1 text-left text-xs transition hover:bg-copper/10"
                      >
                        {ligne}
                      </button>
                    ) : (
                      <div className="flex items-baseline gap-2 px-1.5 py-1 text-xs">{ligne}</div>
                    )}
                  </li>
                )
              })}
            </ul>
            {onExercice ? (
              <p className="mt-1 text-[10px] text-muted">Touche un exercice pour ouvrir une séance dessus.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Figure({
  cx,
  half,
  fill,
  back,
  sexe = 'H',
  onPick,
  onZoom,
}: {
  cx: number
  half: Array<[MuscleRegion | 'neutral', string]>
  fill: (r: MuscleRegion | 'neutral') => string
  back: boolean
  sexe?: Sexe
  /** Absent en vignette : à cette taille, viser un muscle relève du hasard. */
  onPick?: (r: MuscleRegion) => void
  /** Présent en vignette : tout le corps est une seule cible, vers le zoom. */
  onZoom?: () => void
}) {
  // Les zones non suivies (mains, genoux, pieds) ne sont jamais cliquables.
  const viser = (region: MuscleRegion | 'neutral') =>
    onPick && region !== 'neutral'
      ? { onClick: () => onPick(region), style: { cursor: 'pointer' } }
      : {}
  // Tout tracé passe par la morphologie : un seul jeu de muscles, deux
  // silhouettes. Pour 'H' c'est l'identité, la référence n'est pas déformée.
  const m = (d: string) => morphPath(d, sexe)
  const side = half.flatMap(([region, d], i) => {
    const trace = m(d)
    return [
      <path key={i} d={trace} fill={fill(region)} data-muscle={region} {...viser(region)} />,
      // Les stries par-dessus, transparentes au pointeur : elles décorent, elles
      // ne captent pas le clic — la leçon des intersections tendineuses.
      <path
        key={`f${i}`}
        d={trace}
        fill={`url(#${trameDuTrace(trace)})`}
        stroke="none"
        pointerEvents="none"
      />,
    ]
  })
  const base = BASE_HALF.map((d, i) => <path key={i} d={m(d)} fill={NEUTRAL} stroke="none" />)
  const voile = BASE_HALF.flatMap((d, i) => [
    <path key={`v${i}`} d={m(d)} fill="url(#mb-volume)" stroke="none" pointerEvents="none" />,
    <path key={`g${i}`} d={m(d)} fill="url(#mb-galbe)" stroke="none" pointerEvents="none" />,
  ])
  return (
    <g
      transform={`translate(${cx},0)`}
      onClick={onZoom}
      style={onZoom ? { cursor: 'zoom-in' } : undefined}
      filter="url(#mb-relief)"
    >
      {/* Silhouette de base, puis les muscles par-dessus */}
      <path d={m(BASE_CENTER)} fill={NEUTRAL} stroke="none" />
      {base}
      <g transform="scale(-1,1)">{base}</g>
      {/* Tête et cou, hors muscles suivis. Un seul tracé continu : l'ellipse
          posée sur un trapèze faisait deux primitives, et le raccord se
          voyait. Ici la boîte crânienne s'évase aux pariétaux, se resserre aux
          tempes, et la mâchoire descend dans le cou sans rupture. */}
      <path
        d={m(
          // Un crâne humain n'est pas un ovale : la boîte est large aux
          // pariétaux, se resserre aux tempes, la mâchoire redescend en angle
          // vers le menton, et l'occiput déborde en arrière. Un ovale se
          // reconnaît immédiatement comme un raccourci.
          'M0,3.5 C7,3.5 12,7 13.6,13 C14.4,17 14.2,21.5 13.4,25.5 ' +
            'C12.8,28.5 11.6,31 10,33 C9.4,36 8.6,39 7,41.5 ' +
            'C5.6,43.8 3.2,45.4 0,45.8 C-3.2,45.4 -5.6,43.8 -7,41.5 ' +
            'C-8.6,39 -9.4,36 -10,33 C-11.6,31 -12.8,28.5 -13.4,25.5 ' +
            'C-14.2,21.5 -14.4,17 -13.6,13 C-12,7 -7,3.5 0,3.5 Z',
        )}
        fill={NEUTRAL}
        stroke="none"
      />
      {/* Le cou : deux masses obliques qui descendent du crâne aux clavicules,
          et non un trapèze posé sous la tête. */}
      <path
        d={m('M-7,42 C-8,47 -9.5,51 -11.5,54 L11.5,54 C9.5,51 8,47 7,42 C4.6,44.6 -4.6,44.6 -7,42 Z')}
        fill={NEUTRAL}
        stroke="none"
      />
      {/* Grand droit : uniquement de face, avec ses intersections tendineuses.
          Il se rétrécit vers le pubis, comme sur les planches. */}
      {back ? null : (
        <>
          <path
            d={m('M-13,100 C-13,118 -13,136 -11,146 C-8,153 8,153 11,146 C13,136 13,118 13,100 C6,97 -6,97 -13,100 Z')}
            fill={fill('rectus')}
            data-muscle="rectus"
            {...viser('rectus')}
          />
          <path
            d={m('M-12.6,111 L12.6,111 M-12.8,121 L12.8,121 M-12.4,131 L12.4,131 M0,99 L0,150')}
            strokeWidth="0.7"
            fill="none"
            pointerEvents="none"
          />
          {/* Silhouette mammaire : elle repose SUR le grand pectoral, elle ne le
              remplace pas — un simple sillon sous-mammaire, sans remplissage,
              pour que la couleur du muscle reste lisible. */}
          {sexe === 'F' ? (
            <path
              d={m('M-24,74 C-24,88 -17,97 -7,97 M24,74 C24,88 17,97 7,97')}
              strokeWidth="0.9"
              fill="none"
              pointerEvents="none"
            />
          ) : null}
        </>
      )}
      {/* Bassin */}
      <path
        d={m(
          back
            ? 'M-17,150 C-19,158 -18,166 -16,173 L16,173 C18,166 19,158 17,150 Z'
            : 'M-17,150 C-19,162 -17,174 -13,183 L13,183 C17,174 19,162 17,150 Z',
        )}
        fill={NEUTRAL}
      />
      {side}
      <g transform="scale(-1,1)">{side}</g>
      {/* Voile de volume, tout en dernier et transparent au clic : il galbe le
          corps sans changer une teinte ni voler un clic au zoom.
          Posé sur la SILHOUETTE et non sur un rectangle — un rectangle laissait
          voir ses propres bords, un cadre plus clair autour du corps. */}
      {voile}
      <g transform="scale(-1,1)">{voile}</g>
      <path d={m(BASE_CENTER)} fill="url(#mb-volume)" stroke="none" pointerEvents="none" />
      <path d={m(BASE_CENTER)} fill="url(#mb-galbe)" stroke="none" pointerEvents="none" />
    </g>
  )
}

