import { useState } from 'react'
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
  [0, 20, 52, 30], //     marron — encore brûlant, la séance vient de finir
  [0.5, 12, 64, 38], //   marron rouge — le soir de la séance
  [1, 4, 76, 47], //      rouge
  [1.5, 12, 80, 49], //   rouge vif
  [2, 20, 84, 50], //     rouge orangé — dernier cran « en récup »
  [2.5, 27, 86, 50], //   orange sombre
  [3, 34, 88, 50], //     orange
  [3.5, 40, 89, 50], //   orange ambré
  [4, 46, 90, 50], //     ambre — dernier cran « bientôt prêt »
  [4.5, 60, 76, 47], //   jaune lime
  [5, 74, 62, 44], //     lime : bascule sur « prêt »
  [6, 93, 58, 43], //     vert clair
  [7, 112, 55, 42], //    vert
  [10, 158, 55, 41], //   turquoise
  [14, 192, 58, 44], //   cyan
  [21, 212, 56, 46], //   bleu franc — froid, oublié
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
const BASE_CENTER =
  'M-31,63 C-34,80 -33,98 -30,112 C-28,124 -27,134 -28,144 C-30,156 -32,166 -31,180 L31,180 C32,166 30,156 28,144 C27,134 28,124 30,112 C33,98 34,80 31,63 C26,55 14,50 8,48 L-8,48 C-14,50 -26,55 -31,63 Z'

const BASE_HALF: string[] = [
  // bras : épaule → coude → poignet → main, en une seule masse
  'M-31,64 C-43,71 -49,90 -46,113 C-44,133 -50,162 -48,188 C-47,203 -35,205 -34,189 C-32,162 -37,133 -35,113 C-33,93 -25,73 -23,65 Z',
  // jambe : hanche → genou → mollet → cheville → pied
  'M-30,170 C-34,196 -32,230 -27,256 C-25,278 -26,302 -22,326 C-20,334 -6,334 -4,326 C-3,302 -5,278 -5,256 C-5,222 -3,196 -2,172 Z',
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
  ['deltLat', 'M-33,65 C-43,72 -47,89 -44,103 C-40,105 -37,96 -35,84 C-34,76 -33,69 -33,65 Z'],
  ['deltAnt', 'M-26,67 C-35,74 -38,87 -36,99 C-32,100 -29,90 -27,79 C-26,73 -26,69 -26,67 Z'],
  // Petit pectoral, sous la clavicule : petit éventail court.
  ['pecMinor', 'M-22,66 C-15,68 -10,71 -8,75 C-11,78 -16,78 -20,77 C-21,73 -22,69 -22,66 Z'],
  ['subscapularis', 'M-32,79 C-29,83 -27,87 -26,91 C-29,93 -32,92 -34,90 C-34,85 -33,81 -32,79 Z'],
  // Grand pectoral : faisceau claviculaire en éventail, à bords bombés.
  ['pecUpper', 'M-27,69 C-19,63 -7,63 -2,70 C-3,76 -4,80 -5,84 C-12,86 -20,86 -25,84 C-27,79 -28,73 -27,69 Z'],
  // …puis la masse sterno-costale, qui plonge en s'arrondissant vers l'aisselle.
  ['pecLower', 'M-25,86 C-17,84 -9,84 -5,87 C-4,95 -6,102 -9,107 C-19,112 -28,105 -30,93 C-30,89 -27,86 -25,86 Z'],
  // Obliques : nappe du flanc, plus large en haut, effilée vers la crête iliaque.
  ['obliques', 'M-20,106 C-24,120 -25,137 -23,152 C-19,153 -13,153 -11,151 C-12,136 -13,122 -15,108 C-17,106 -19,105 -20,106 Z'],
  // Dentelé antérieur : les digitations en doigts de gant, chacune arrondie.
  ['serratus', 'M-29,95 C-25,101 -22,108 -21,115 C-21,121 -22,126 -24,130 C-27,121 -29,109 -29,95 Z'],
  // Transverse : la sangle horizontale profonde, en croissant.
  ['transversus', 'M-18,133 C-12,130 -6,130 -1,132 C-1,137 -1,140 -1,142 C-7,144 -13,144 -18,141 C-19,138 -19,135 -18,133 Z'],
  ['coracobrachialis', 'M-30,101 C-33,110 -33,119 -32,126 C-30,127 -29,122 -29,114 C-29,107 -29,103 -30,101 Z'],
  ['biceps', 'M-36,101 C-43,111 -45,127 -41,139 C-37,141 -35,133 -35,121 C-35,111 -35,104 -36,101 Z'],
  ['brachialis', 'M-43,116 C-47,126 -47,135 -45,141 C-42,141 -41,133 -41,124 C-41,119 -42,116 -43,116 Z'],
  ['brachioradialis', 'M-42,133 C-49,145 -50,160 -48,173 C-45,173 -43,159 -42,147 C-41,140 -41,135 -42,133 Z'],
  ['pronators', 'M-40,139 C-44,146 -45,152 -44,157 C-41,157 -39,151 -37,145 C-36,142 -37,139 -40,139 Z'],
  ['forearmFlex', 'M-39,143 C-46,157 -47,173 -45,188 C-41,189 -38,174 -37,158 C-36,150 -36,145 -39,143 Z'],
  ['fingerFlex', 'M-37,160 C-41,172 -42,182 -41,190 C-38,191 -36,181 -35,171 C-34,164 -34,160 -37,160 Z'],
  // Main : galet arrondi, hors muscles suivis.
  ['neutral', 'M-45,190 C-51,196 -51,207 -45,211 C-39,207 -39,196 -45,190 Z'],
  // Psoas : fuseau profond qui plonge vers le petit trochanter.
  ['hipFlexors', 'M-16,138 C-15,151 -13,164 -10,174 C-7,179 -4,177 -3,173 C-5,161 -8,149 -10,139 C-12,137 -15,136 -16,138 Z'],
  // Tenseur du fascia lata : lame effilée sur le bord de la hanche.
  ['tfl', 'M-28,158 C-32,169 -32,181 -30,192 C-27,193 -26,190 -26,186 C-26,176 -26,166 -27,160 C-27,158 -28,157 -28,158 Z'],
  // Quadriceps : trois ventres renflés au tiers supérieur, effilés au genou.
  ['vastusLat', 'M-27,172 C-33,196 -32,223 -27,244 C-23,249 -20,246 -19,241 C-20,213 -21,191 -22,173 C-24,170 -26,170 -27,172 Z'],
  ['rectusFemoris', 'M-17,172 C-22,199 -21,227 -16,248 C-12,250 -9,248 -9,244 C-8,219 -9,194 -10,173 C-13,170 -15,170 -17,172 Z'],
  ['adductors', 'M-8,175 C-13,197 -13,217 -10,232 C-7,234 -4,233 -3,230 C-3,212 -3,192 -4,176 C-5,173 -7,173 -8,175 Z'],
  ['gracilis', 'M-6,178 C-8,200 -8,224 -5,244 C-3,245 -1,243 -1,238 C-1,217 -1,196 -2,178 C-3,176 -5,176 -6,178 Z'],
  ['vastusMed', 'M-18,225 C-17,239 -13,249 -7,252 C-3,251 -2,246 -4,242 C-9,238 -13,234 -14,225 C-16,222 -18,222 -18,225 Z'],
  // Genou : rotule arrondie, hors muscles suivis.
  ['neutral', 'M-27,254 C-20,261 -10,261 -5,254 C-4,259 -5,263 -6,266 C-13,271 -21,270 -26,265 C-27,261 -27,257 -27,254 Z'],
  ['fibularis', 'M-25,268 C-27,285 -26,300 -23,309 C-20,309 -20,293 -21,279 C-22,271 -23,267 -25,268 Z'],
  ['tibialis', 'M-21,264 C-24,284 -22,302 -19,313 C-15,314 -13,296 -15,277 C-16,268 -18,262 -21,264 Z'],
  ['tibPost', 'M-9,266 C-11,283 -10,299 -7,310 C-4,310 -3,293 -4,278 C-5,269 -7,264 -9,266 Z'],
  ['gastroc', 'M-12,264 C-14,283 -12,300 -9,311 C-5,312 -3,293 -5,276 C-6,267 -9,262 -12,264 Z'],
  // Pied : galet allongé, hors muscles suivis.
  ['neutral', 'M-25,320 C-27,329 -24,334 -18,335 C-11,335 -5,333 -4,328 C-3,323 -4,319 -6,317 C-13,317 -21,317 -25,320 Z'],
]

export const BACK_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  // Même règle qu'à la face : des ventres, pas des dalles. Les tracés du dos
  // sont plus larges et se recouvrent en couches, comme dans le corps —
  // profonds d'abord, superficiels par-dessus.
  ['neckExt', 'M-6,43 C-8,50 -8,57 -6,63 C-3,64 -1,60 -1,54 C-1,49 -1,45 -2,43 C-3,42.5 -5,42.5 -6,43 Z'],
  ['neck', 'M-10,44 C-12,50 -12,57 -10,62 C-8,63 -7,59 -7,53 C-7,48 -7,45 -8,43 C-9,43 -10,43 -10,44 Z'],
  ['levator', 'M-7,50 C-11,56 -15,62 -17,68 C-15,70 -13,71 -11,71 C-10,64 -8,56 -7,50 Z'],
  ['deltLat', 'M-34,65 C-44,72 -47,89 -44,102 C-40,104 -37,95 -35,83 C-34,75 -34,68 -34,65 Z'],
  ['deltPost', 'M-27,66 C-36,74 -39,86 -37,97 C-33,98 -30,89 -28,78 C-27,72 -27,68 -27,66 Z'],
  // Trapèze : le grand losange en trois étages, aux bords tous incurvés.
  ['trapsUpper', 'M0,42 C-4,43 -7,45 -9,46 C-19,52 -27,59 -31,67 C-28,70 -24,72 -21,73 C-15,63 -8,55 0,50 C0,47 0,44 0,42 Z'],
  ['trapsMid', 'M0,55 C-8,65 -16,74 -22,81 C-21,88 -20,95 -19,101 C-13,96 -6,92 0,88 C0,77 0,66 0,55 Z'],
  ['trapsLow', 'M0,90 C-7,95 -13,100 -18,104 C-15,114 -11,124 -8,131 C-5,127 -2,124 0,123 C0,112 0,101 0,90 Z'],
  // Grand dorsal : le V, large sous l'aisselle, effilé vers la crête iliaque.
  ['lats', 'M-30,90 C-34,109 -30,131 -19,147 C-13,152 -5,150 -3,145 C-9,131 -15,114 -21,100 C-24,96 -28,88 -30,90 Z'],
  ['rhomboids', 'M-4,72 C-10,78 -15,83 -17,88 C-16,93 -15,98 -14,102 C-10,98 -7,94 -4,91 C-4,85 -4,78 -4,72 Z'],
  // Fosse sus-épineuse : au-dessus de l'épine de l'omoplate.
  ['supraspinatus', 'M-27,68 C-21,70 -17,74 -15,79 C-19,82 -23,83 -26,83 C-27,78 -27,72 -27,68 Z'],
  ['rotatorCuff', 'M-28,74 C-22,78 -18,82 -16,87 C-20,90 -24,91 -27,92 C-28,86 -28,79 -28,74 Z'],
  // Petit rond puis grand rond : deux bandelettes empilées, chacune bombée.
  ['teresMinor', 'M-29,86 C-24,89 -20,92 -18,95 C-21,98 -25,99 -28,99 C-29,95 -29,90 -29,86 Z'],
  ['teres', 'M-30,99 C-25,102 -21,105 -19,108 C-22,112 -26,113 -29,112 C-30,108 -30,103 -30,99 Z'],
  // Multifides collés aux vertèbres, érecteurs en colonnes, carré des lombes
  // en dehors : trois couches du plus profond au plus superficiel.
  ['multifidus', 'M-5,124 C-7,140 -7,155 -5,165 C-3,166 -1,164 -1,158 C-1,145 -1,131 -1,124 C-2,122 -4,122 -5,124 Z'],
  ['erectors', 'M-11,126 C-13,141 -13,155 -11,165 C-8,166 -4,166 -2,164 C-2,150 -2,136 -2,124 C-6,122 -9,123 -11,126 Z'],
  ['quadratusLumborum', 'M-19,130 C-21,143 -21,155 -18,164 C-15,165 -13,163 -13,158 C-13,148 -13,138 -14,129 C-16,127 -18,127 -19,130 Z'],
  ['tricepsLong', 'M-35,100 C-39,113 -38,131 -36,140 C-33,141 -31,133 -31,122 C-31,112 -32,104 -35,100 Z'],
  ['tricepsLat', 'M-42,102 C-47,114 -46,132 -42,141 C-39,141 -38,127 -38,114 C-38,106 -39,101 -42,102 Z'],
  ['brachioradialis', 'M-42,133 C-49,145 -50,160 -48,173 C-45,173 -43,159 -42,147 C-41,140 -41,135 -42,133 Z'],
  ['forearmExt', 'M-40,143 C-47,157 -49,173 -46,188 C-42,189 -39,174 -38,158 C-37,150 -37,145 -40,143 Z'],
  ['neutral', 'M-45,190 C-51,196 -51,207 -45,211 C-39,207 -39,196 -45,190 Z'],
  // Moyen fessier en éventail, rotateurs profonds en barre, grand fessier en
  // masse ronde par-dessus.
  ['gluteMed', 'M-28,156 C-32,166 -32,177 -28,184 C-24,183 -22,180 -21,177 C-22,170 -23,163 -24,157 C-25,155 -27,154 -28,156 Z'],
  ['hipRotators', 'M-22,172 C-16,174 -10,176 -6,177 C-6,180 -6,182 -6,183 C-12,184 -18,182 -22,179 C-23,177 -23,174 -22,172 Z'],
  ['gluteMax', 'M-24,166 C-30,181 -27,198 -18,205 C-8,206 -2,195 -2,182 C-2,175 -2,170 -3,167 C-10,163 -19,162 -24,166 Z'],
  ['bicepsFemoris', 'M-27,204 C-31,227 -29,247 -24,260 C-20,262 -17,259 -17,254 C-17,232 -18,214 -20,205 C-23,202 -25,202 -27,204 Z'],
  ['hamsInner', 'M-15,205 C-17,228 -15,247 -13,260 C-9,262 -5,259 -4,254 C-3,234 -5,215 -8,204 C-11,202 -13,202 -15,205 Z'],
  ['neutral', 'M-27,262 C-20,269 -9,269 -4,262 C-3,266 -4,270 -5,273 C-12,278 -21,277 -26,272 C-27,269 -27,265 -27,262 Z'],
  // Les deux chefs du jumeau, chacun bombé, puis le soléaire qui déborde.
  ['gastroc', 'M-25,274 C-29,291 -26,304 -22,309 C-18,310 -16,296 -17,282 C-17,275 -22,270 -25,274 Z'],
  ['gastroc', 'M-14,274 C-15,291 -13,304 -11,309 C-7,310 -5,296 -6,282 C-6,275 -11,270 -14,274 Z'],
  ['soleus', 'M-24,310 C-26,318 -23,323 -19,324 C-13,325 -8,324 -6,321 C-4,318 -4,313 -6,310 C-12,308 -19,308 -24,310 Z'],
  ['neutral', 'M-24,325 C-26,332 -23,335 -18,335 C-11,335 -6,334 -5,330 C-4,327 -4,324 -5,322 C-11,322 -19,322 -24,325 Z'],
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
            320 unités de large et le plein écran 120, donc un rayon absolu
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
        viewBox="40 0 320 356"
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
        <Figure cx={105} half={FRONT_HALF} fill={fill} back={false} sexe={sexe} onZoom={() => setZoom('front')} />
        <Figure cx={295} half={BACK_HALF} fill={fill} back sexe={sexe} onZoom={() => setZoom('back')} />
        <text x="105" y="350" textAnchor="middle" fill="#a8a29e" fontSize="11" stroke="none">
          Face
        </text>
        <text x="295" y="350" textAnchor="middle" fill="#a8a29e" fontSize="11" stroke="none">
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

      <svg
        viewBox="-60 0 120 342"
        className="min-h-0 w-full flex-1"
        stroke="rgba(23,19,16,0.55)"
        strokeWidth="0.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-label={face === 'front' ? 'Corps de face' : 'Corps de dos'}
      >
        <Figure
          cx={0}
          half={face === 'front' ? FRONT_HALF : BACK_HALF}
          fill={fill}
          back={face === 'back'}
          sexe={sexe}
          onPick={onPick}
        />
      </svg>

      <p className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-1 text-center text-[11px] text-muted">
        Touche un muscle pour son état de récupération et les exercices qui le visent.
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
          'M0,4.5 C7.5,4.5 12.8,10 13.5,17.5 C13.9,22 13.2,26.5 12,30.5 ' +
            'C10.8,35 8,39.5 4.8,42.5 C4.8,45.5 4.8,48.5 3.6,50.5 ' +
            'C3.6,50.5 -3.6,50.5 -3.6,50.5 C-4.8,48.5 -4.8,45.5 -4.8,42.5 ' +
            'C-8,39.5 -10.8,35 -12,30.5 C-13.2,26.5 -13.9,22 -13.5,17.5 ' +
            'C-12.8,10 -7.5,4.5 0,4.5 Z',
        )}
        fill={NEUTRAL}
        stroke="none"
      />
      <path
        d={m('M-6.5,46 C-6.5,49 -8,51.5 -10,54 L10,54 C8,51.5 6.5,49 6.5,46 Z')}
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

