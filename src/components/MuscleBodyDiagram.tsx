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
  'M-8,47 C-16,49 -26,54 -32,63 C-35,76 -34,92 -32,105 C-30,116 -28,126 -27,136 ' +
  'C-26,143 -26,148 -27,153 C-29,161 -31,170 -30,180 L30,180 ' +
  'C31,170 29,161 27,153 C26,148 26,143 27,136 C28,126 30,116 32,105 ' +
  'C34,92 35,76 32,63 C26,54 16,49 8,47 Z'

const BASE_HALF: string[] = [
  // Le bras, d'un seul trait : galbe du deltoïde à l'épaule, resserrement au
  // coude, renflement des fléchisseurs à l'avant-bras, poignet fin, main.
  // C'était un tube d'épaisseur constante — un manche, pas un bras.
  'M-31,64 C-40,69 -46,80 -47,93 C-47,106 -45,120 -44,132 ' +
    'C-46,142 -48,155 -48,168 C-48,180 -47,190 -45,199 ' +
    'C-44,207 -35,207 -34,199 C-33,190 -34,180 -34,168 ' +
    'C-34,155 -35,142 -36,132 C-36,120 -34,106 -33,93 ' +
    'C-31,81 -27,72 -23,65 Z',
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
  ['deltLat', 'M-33,64 C-41,68 -46,78 -47,90 C-47,99 -45,106 -42,110 C-39,109 -37,103 -37,95 C-37,85 -36,74 -34,66 C-34,64 -33,63 -33,64 Z'],
  ['deltAnt', 'M-24,65 C-31,69 -36,79 -37,91 C-37,99 -36,105 -34,109 C-32,107 -31,101 -30,93 C-29,84 -27,73 -25,66 C-25,65 -24,64 -24,65 Z'],
  // Petit pectoral, sous la clavicule : petit éventail court.
  ['pecMinor', 'M-23,68 C-17,71 -12,75 -9,79 C-12,82 -18,82 -22,79 C-24,75 -24,70 -23,68 Z'],
  ['subscapularis', 'M-32,79 C-29,83 -27,87 -26,91 C-29,93 -32,92 -34,90 C-34,85 -33,81 -32,79 Z'],
  // Grand pectoral : faisceau claviculaire en éventail, à bords bombés.
  ['pecUpper', 'M-2,63 C-12,63 -22,66 -29,71 C-32,76 -33,81 -31,85 C-23,86 -13,87 -4,87 C-2,83 -2,73 -2,63 Z'],
  // …puis la masse sterno-costale, qui plonge en s'arrondissant vers l'aisselle.
  ['pecLower', 'M-3,89 C-13,90 -23,94 -30,100 C-33,106 -32,112 -29,115 C-21,117 -12,113 -6,107 C-3,102 -3,96 -3,89 Z'],
  // Obliques : nappe du flanc, plus large en haut, effilée vers la crête iliaque.
  ['obliques', 'M-22,104 C-27,120 -28,138 -25,155 C-20,157 -15,156 -13,153 C-14,137 -15,122 -17,107 C-19,103 -21,103 -22,104 Z'],
  // Dentelé antérieur : les digitations en doigts de gant, chacune arrondie.
  ['serratus', 'M-31,94 C-26,101 -23,109 -22,117 C-22,124 -23,130 -25,134 C-29,124 -31,110 -31,94 Z'],
  // Transverse : la sangle horizontale profonde, en croissant.
  ['transversus', 'M-20,132 C-13,129 -6,129 -1,131 C-1,137 -1,142 -1,146 C-8,148 -15,147 -20,143 C-22,139 -22,135 -20,132 Z'],
  ['coracobrachialis', 'M-33,100 C-35,108 -35,117 -34,124 C-32,125 -31,120 -31,112 C-31,105 -31,101 -33,100 Z'],
  ['biceps', 'M-42,104 C-46,113 -46,126 -43,135 C-39,136 -37,128 -37,117 C-37,109 -38,104 -42,104 Z'],
  ['brachialis', 'M-36,118 C-38,126 -38,134 -37,140 C-35,140 -34,133 -34,125 C-34,120 -35,118 -36,118 Z'],
  ['brachioradialis', 'M-42,134 C-47,145 -47,159 -45,171 C-42,171 -41,158 -40,146 C-39,139 -39,135 -42,134 Z'],
  ['pronators', 'M-39,138 C-43,144 -44,150 -43,155 C-40,155 -38,150 -37,144 C-36,141 -37,138 -39,138 Z'],
  ['forearmFlex', 'M-40,146 C-46,157 -47,171 -45,186 C-41,187 -39,172 -38,157 C-37,150 -37,146 -40,146 Z'],
  ['fingerFlex', 'M-37,162 C-40,172 -41,181 -40,189 C-37,190 -36,180 -35,170 C-35,164 -35,162 -37,162 Z'],
  // Main : dos de la main renflé, pouce détaché vers l'intérieur, doigts
  // refermés. Hors muscles suivis, mais reconnaissable comme une main.
  ['neutral', 'M-44,198 C-48,201 -50,208 -49,215 C-48,221 -44,224 -40,222 ' +
    'C-37,220 -35,214 -35,207 C-35,202 -36,199 -38,198 C-40,197 -42,197 -44,198 Z'],
  ['neutral', 'M-35,203 C-33,205 -32,209 -33,212 C-34,214 -36,214 -36,211 C-36,208 -36,205 -35,203 Z'],
  // Psoas : fuseau profond qui plonge vers le petit trochanter.
  ['hipFlexors', 'M-17,139 C-16,153 -13,167 -9,178 C-5,181 -2,179 -2,174 C-4,162 -8,150 -11,140 C-14,136 -16,136 -17,139 Z'],
  // Tenseur du fascia lata : lame effilée sur le bord de la hanche.
  ['tfl', 'M-27,160 C-31,170 -31,182 -29,193 C-27,194 -25,190 -25,185 C-25,176 -25,167 -26,161 C-26,159 -27,159 -27,160 Z'],
  // Quadriceps : trois ventres renflés au tiers supérieur, effilés au genou.
  ['vastusLat', 'M-28,181 C-34,201 -34,226 -29,247 C-24,251 -20,248 -19,242 C-20,214 -21,196 -22,182 C-25,178 -27,178 -28,181 Z'],
  ['rectusFemoris', 'M-18,181 C-22,203 -22,230 -17,250 C-13,252 -9,250 -9,245 C-8,221 -9,200 -10,182 C-13,178 -16,178 -18,181 Z'],
  ['adductors', 'M-8,182 C-13,200 -13,220 -10,236 C-7,238 -4,236 -3,232 C-3,214 -3,196 -4,183 C-5,179 -7,179 -8,182 Z'],
  ['gracilis', 'M-6,183 C-8,203 -8,225 -5,245 C-3,246 -2,243 -2,238 C-2,218 -2,199 -3,184 C-4,181 -5,181 -6,183 Z'],
  ['vastusMed', 'M-19,224 C-18,240 -13,251 -6,254 C-2,253 -1,247 -3,243 C-9,239 -14,235 -15,224 C-17,220 -19,220 -19,224 Z'],
  // Genou : la rotule, plaque ovale posée sur l'interligne.
  ['neutral', 'M-26,252 C-21,258 -11,258 -6,252 C-4,257 -5,263 -7,267 ' +
    'C-13,272 -21,271 -25,266 C-27,262 -27,256 -26,252 Z'],
  ['neutral', 'M-20,254 C-15,252 -10,253 -8,256 C-9,261 -13,264 -17,264 C-20,263 -21,258 -20,254 Z'],
  ['fibularis', 'M-26,267 C-28,286 -27,302 -24,312 C-21,312 -21,294 -22,278 C-23,269 -24,266 -26,267 Z'],
  ['tibialis', 'M-22,263 C-25,285 -23,304 -19,316 C-14,317 -12,297 -14,276 C-15,266 -19,261 -22,263 Z'],
  ['tibPost', 'M-9,266 C-11,283 -10,299 -7,310 C-4,310 -3,293 -4,278 C-5,269 -7,264 -9,266 Z'],
  ['gastroc', 'M-13,263 C-15,284 -13,303 -9,315 C-5,316 -3,294 -5,275 C-6,265 -10,261 -13,263 Z'],
  // Pied de face : coup de pied bombé, orteils devant, talon en arrière.
  ['neutral', 'M-23,318 C-26,323 -26,330 -23,334 C-16,337 -8,336 -4,332 ' +
    'C-2,329 -3,324 -5,320 C-11,317 -18,316 -23,318 Z'],
]

export const BACK_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  // Même règle qu'à la face : des ventres, pas des dalles. Les tracés du dos
  // sont plus larges et se recouvrent en couches, comme dans le corps —
  // profonds d'abord, superficiels par-dessus.
  ['neckExt', 'M-6,43 C-8,50 -8,57 -6,63 C-3,64 -1,60 -1,54 C-1,49 -1,45 -2,43 C-3,42.5 -5,42.5 -6,43 Z'],
  ['neck', 'M-10,44 C-12,50 -12,57 -10,62 C-8,63 -7,59 -7,53 C-7,48 -7,45 -8,43 C-9,43 -10,43 -10,44 Z'],
  ['levator', 'M-7,50 C-11,56 -15,62 -17,68 C-15,70 -13,71 -11,71 C-10,64 -8,56 -7,50 Z'],
  ['deltLat', 'M-33,64 C-41,68 -46,78 -47,90 C-47,99 -45,106 -42,110 C-39,109 -37,103 -37,95 C-37,85 -36,74 -34,66 C-34,64 -33,63 -33,64 Z'],
  ['deltPost', 'M-25,66 C-32,70 -37,80 -38,92 C-38,100 -37,106 -35,110 C-33,108 -32,102 -31,94 C-30,85 -28,74 -26,67 C-26,66 -25,65 -25,66 Z'],
  // Trapèze : le grand losange en trois étages, aux bords tous incurvés.
  ['trapsUpper', 'M0,42 C-4,43 -7,45 -9,46 C-19,52 -27,59 -31,67 C-28,70 -24,72 -21,73 C-15,63 -8,55 0,50 C0,47 0,44 0,42 Z'],
  ['trapsMid', 'M0,54 C-9,65 -18,75 -25,83 C-24,91 -22,98 -21,105 C-14,99 -7,94 0,90 C0,78 0,66 0,54 Z'],
  ['trapsLow', 'M0,92 C-8,97 -15,103 -21,108 C-17,119 -12,129 -8,136 C-5,131 -2,128 0,127 C0,115 0,103 0,92 Z'],
  // Grand dorsal : le V, large sous l'aisselle, effilé vers la crête iliaque.
  ['lats', 'M-31,93 C-33,103 -32,114 -28,124 C-24,138 -16,150 -7,158 C-3,159 -1,156 -1,151 C-2,140 -5,128 -11,116 C-17,105 -24,95 -29,91 C-31,90 -32,91 -31,93 Z'],
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
  ['erectors', 'M-12,126 C-14,142 -14,157 -12,168 C-8,169 -4,169 -2,166 C-2,151 -2,136 -2,124 C-6,121 -10,122 -12,126 Z'],
  ['quadratusLumborum', 'M-19,130 C-21,143 -21,155 -18,164 C-15,165 -13,163 -13,158 C-13,148 -13,138 -14,129 C-16,127 -18,127 -19,130 Z'],
  ['tricepsLong', 'M-34,102 C-37,113 -37,129 -35,139 C-33,140 -32,132 -32,121 C-32,112 -32,104 -34,102 Z'],
  ['tricepsLat', 'M-42,105 C-46,115 -46,130 -43,139 C-40,139 -39,127 -39,115 C-39,108 -40,104 -42,105 Z'],
  ['brachioradialis', 'M-42,134 C-47,145 -47,159 -45,171 C-42,171 -41,158 -40,146 C-39,139 -39,135 -42,134 Z'],
  ['forearmExt', 'M-40,146 C-46,157 -47,171 -45,186 C-41,187 -39,172 -38,157 C-37,150 -37,146 -40,146 Z'],
  ['neutral', 'M-45,190 C-51,196 -51,207 -45,211 C-39,207 -39,196 -45,190 Z'],
  // Moyen fessier en éventail, rotateurs profonds en barre, grand fessier en
  // masse ronde par-dessus.
  ['gluteMed', 'M-27,155 C-31,163 -32,173 -29,181 C-25,181 -22,178 -21,174 C-22,168 -23,161 -24,156 C-25,154 -26,153 -27,155 Z'],
  ['hipRotators', 'M-22,172 C-16,174 -10,176 -6,177 C-6,180 -6,182 -6,183 C-12,184 -18,182 -22,179 C-23,177 -23,174 -22,172 Z'],
  ['gluteMax', 'M-26,167 C-33,180 -32,198 -22,208 C-11,212 -2,203 -1,189 C-1,180 -1,172 -2,167 C-11,162 -21,162 -26,167 Z'],
  ['bicepsFemoris', 'M-27,209 C-31,230 -30,249 -25,262 C-21,264 -18,261 -18,255 C-18,234 -19,218 -21,210 C-24,206 -26,206 -27,209 Z'],
  ['hamsInner', 'M-16,209 C-18,230 -16,249 -13,262 C-9,264 -6,261 -5,255 C-4,236 -6,219 -9,210 C-12,206 -14,206 -16,209 Z'],
  ['neutral', 'M-27,262 C-20,269 -9,269 -4,262 C-3,266 -4,270 -5,273 C-12,278 -21,277 -26,272 C-27,269 -27,265 -27,262 Z'],
  // Les deux chefs du jumeau, chacun bombé, puis le soléaire qui déborde.
  ['gastroc', 'M-26,273 C-30,292 -27,307 -22,313 C-18,314 -16,297 -17,281 C-17,273 -23,269 -26,273 Z'],
  ['gastroc', 'M-15,273 C-16,292 -14,307 -11,313 C-7,314 -5,297 -6,281 C-6,273 -12,269 -15,273 Z'],
  ['soleus', 'M-25,312 C-27,320 -24,325 -19,326 C-13,327 -8,326 -6,323 C-4,320 -4,314 -6,311 C-13,309 -20,309 -25,312 Z'],
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

