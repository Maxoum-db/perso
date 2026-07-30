import { useState } from 'react'
import { fmtAnciennete, PAS_HEURES, PAS_JOURS, type GroupLoad } from '../lib/muscu'
import { AJUST_MAX, AJUST_MIN, AJUST_PAS, fmtAjust } from '../lib/soreness'
import { MUSCLE_LABELS, SOLLICITATION_MARQUEUR, type MuscleRegion, type Sollicitation } from '../lib/muscles'
import { SEUIL_PRET, VITESSE_RECUP, reposParMuscle, type ReposMuscle } from '../lib/recuperation'
import { exercicesPourMuscle } from '../lib/exercicesParMuscle'
import { deformerX, morphPath, type Sexe } from '../lib/morphologie'
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

const NEUTRAL = '#C9C4BD'

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

const FRONT_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  // Sterno-cléido-mastoïdien : la sangle oblique de la mastoïde au sternum.
  ['neck', 'M-9,44 C-11,50 -11,57 -8,62 C-5,62 -4,59 -4,55 C-4,50 -4,46 -4,43 Z'],
  // Trapèze supérieur : la seule pente cou → épaule, vue de face.
  ['trapsUpper', 'M-9,48 C-16,52 -24,58 -30,65 C-27,68 -24,70 -21,72 C-17,63 -12,54 -9,48 Z'],
  ['deltLat', 'M-31,64 C-42,71 -47,88 -44,103 C-40,104 -37,95 -35,83 C-34,75 -34,68 -34,66 Z'],
  ['deltAnt', 'M-26,67 C-34,73 -38,86 -36,99 C-32,99 -29,89 -27,78 C-26,72 -26,69 -26,68 Z'],
  // Grand pectoral : faisceau claviculaire en éventail haut…
  ['pecUpper', 'M-27,68 C-18,63 -6,63 -2,70 C-3,76 -4,80 -5,84 L-25,84 C-27,79 -28,72 -27,68 Z'],
  // …puis la masse sterno-costale, qui plonge vers l'aisselle.
  ['pecLower', 'M-25,86 L-5,86 C-4,94 -6,101 -9,106 C-19,111 -28,104 -30,93 C-31,89 -27,86 -25,86 Z'],
  // Obliques : la nappe du flanc, du gril costal à la crête iliaque.
  ['obliques', 'M-20,106 C-23,120 -25,136 -24,152 L-11,152 C-12,136 -13,122 -15,108 Z'],
  // Dentelé antérieur : les digitations en doigts de gant, par-dessus le flanc.
  ['serratus', 'M-29,95 C-25,100 -22,107 -21,114 C-21,120 -22,125 -24,129 C-27,120 -29,108 -29,95 Z'],
  ['biceps', 'M-35,101 C-42,110 -45,126 -41,139 C-37,141 -35,134 -35,122 C-35,112 -35,105 -35,101 Z'],
  ['brachialis', 'M-43,116 C-46,125 -47,134 -45,141 L-41,139 C-42,131 -42,123 -41,115 Z'],
  ['brachioradialis', 'M-42,133 C-48,144 -50,159 -48,173 L-44,172 C-43,157 -42,145 -40,135 Z'],
  ['forearmFlex', 'M-39,143 C-45,156 -47,172 -45,188 L-38,186 C-37,170 -37,156 -36,145 Z'],
  ['neutral', 'M-45,190 C-51,196 -51,207 -45,211 C-39,207 -39,196 -45,190 Z'],
  // Quadriceps : vaste latéral en dehors, droit fémoral au centre, vaste médial
  // en goutte au-dessus du genou. Les adducteurs ferment la face interne.
  ['hipFlexors', 'M-16,138 C-15,150 -13,163 -10,173 C-7,178 -4,177 -3,173 C-5,161 -7,149 -8,139 Z'],
  ['vastusLat', 'M-28,172 C-32,196 -31,222 -27,244 C-24,249 -20,247 -19,242 C-19,214 -20,192 -21,172 Z'],
  ['tfl', 'M-28,158 C-31,168 -31,180 -30,192 C-28,193 -26,191 -26,187 C-26,177 -26,167 -26,160 Z'],
  ['rectusFemoris', 'M-18,172 C-21,198 -20,226 -16,248 L-9,248 C-8,222 -9,196 -10,172 Z'],
  ['adductors', 'M-8,174 C-12,196 -13,216 -11,232 L-3,232 C-3,214 -3,192 -3,174 Z'],
  ['vastusMed', 'M-18,226 C-17,239 -13,249 -7,252 C-4,250 -3,246 -4,242 C-8,238 -12,234 -13,224 Z'],
  ['neutral', 'M-27,254 C-20,260 -10,260 -5,254 L-5,264 C-11,270 -21,270 -27,264 Z'],
  ['fibularis', 'M-25,268 C-26,284 -25,299 -23,309 L-20,308 C-20,292 -21,278 -22,266 Z'],
  ['tibialis', 'M-21,264 C-23,283 -21,301 -19,313 L-14,313 C-13,294 -14,277 -16,262 Z'],
  ['gastroc', 'M-12,264 C-13,282 -11,299 -9,311 L-4,311 C-3,292 -4,277 -5,263 Z'],
  ['neutral', 'M-25,320 C-26,328 -24,333 -19,334 L-4,334 C-3,330 -3,324 -4,318 Z'],
]

const BACK_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  ['neck', 'M-9,44 C-11,50 -11,57 -9,62 L-3,62 C-3,54 -3,48 -3,43 Z'],
  ['deltLat', 'M-32,64 C-43,71 -47,88 -44,102 C-40,103 -37,94 -35,82 C-34,74 -34,68 -34,66 Z'],
  ['deltPost', 'M-27,66 C-35,73 -39,85 -37,97 C-33,97 -30,88 -28,77 C-27,71 -27,68 -27,67 Z'],
  // Trapèze : le grand losange en trois étages, du crâne aux dernières dorsales.
  ['trapsUpper', 'M0,42 L-9,45 C-18,51 -26,58 -31,66 C-27,69 -24,71 -21,73 C-15,63 -7,54 0,50 Z'],
  ['trapsMid', 'M0,55 C-8,64 -16,73 -22,80 C-21,88 -20,95 -19,101 C-13,96 -6,91 0,88 Z'],
  ['trapsLow', 'M0,90 C-6,94 -12,99 -18,103 C-15,113 -11,123 -8,130 C-5,126 -2,124 0,123 Z'],
  // Grand dorsal : le V, de l'aisselle à la crête iliaque.
  ['lats', 'M-30,90 C-33,108 -30,130 -19,146 C-13,151 -5,150 -3,145 C-8,131 -14,114 -20,100 Z'],
  ['rhomboids', 'M-4,72 C-9,77 -14,82 -17,87 C-16,92 -15,97 -14,101 C-10,97 -7,94 -4,91 Z'],
  ['rotatorCuff', 'M-28,74 C-23,77 -18,81 -16,87 C-19,89 -23,90 -26,92 C-28,85 -28,78 -28,74 Z'],
  ['teres', 'M-30,94 C-25,96 -21,99 -19,104 C-21,107 -25,108 -28,109 C-30,103 -30,98 -30,94 Z'],
  // Érecteurs du rachis : les deux colonnes de part et d'autre des vertèbres.
  ['erectors', 'M-11,126 C-12,140 -12,154 -11,164 L-2,164 L-2,124 Z'],
  ['tricepsLong', 'M-35,100 C-38,112 -38,130 -36,140 C-33,141 -31,135 -31,124 C-31,113 -31,105 -31,100 Z'],
  ['tricepsLat', 'M-42,102 C-46,113 -46,131 -42,141 L-38,139 C-38,124 -38,113 -39,101 Z'],
  ['brachioradialis', 'M-42,133 C-48,144 -50,159 -48,173 L-44,172 C-43,157 -42,145 -40,135 Z'],
  ['forearmExt', 'M-40,143 C-47,156 -49,172 -46,188 L-39,186 C-38,170 -38,156 -38,145 Z'],
  ['neutral', 'M-45,190 C-51,196 -51,207 -45,211 C-39,207 -39,196 -45,190 Z'],
  ['gluteMed', 'M-28,156 C-31,166 -31,176 -28,183 C-25,182 -22,180 -21,178 C-22,170 -23,163 -23,157 Z'],
  ['gluteMax', 'M-24,166 C-29,180 -27,197 -18,204 C-8,205 -2,194 -2,182 L-2,168 Z'],
  ['bicepsFemoris', 'M-27,204 C-30,226 -29,246 -24,260 L-17,260 C-17,236 -18,216 -20,205 Z'],
  ['hamsInner', 'M-15,205 C-16,227 -15,246 -13,260 L-4,260 C-3,238 -5,216 -8,204 Z'],
  ['neutral', 'M-27,262 C-20,268 -9,268 -4,262 L-4,272 C-10,278 -21,278 -27,272 Z'],
  // Les deux chefs du jumeau, puis le soléaire qui déborde en dessous.
  ['gastroc', 'M-25,274 C-28,290 -26,303 -22,309 L-16,308 C-16,294 -17,283 -18,272 Z'],
  ['gastroc', 'M-14,274 C-14,290 -13,303 -11,309 L-5,308 C-4,294 -5,283 -6,272 Z'],
  ['soleus', 'M-24,310 C-25,317 -23,322 -19,323 L-7,323 C-4,319 -4,313 -5,309 Z'],
  ['neutral', 'M-24,325 C-25,331 -23,334 -19,334 L-4,334 C-3,331 -3,328 -4,323 Z'],
]

export function MuscleBodyDiagram({
  loads,
  sessions = [],
  sexe = 'H',
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
   * Déclare des courbatures sur un groupe : + N jours de récup (0 = annuler).
   * La région suit, parce que c'est elle que la base d'observations indexe — un
   * libellé de groupe couvre plusieurs zones, aux vitesses différentes.
   */
  onSoreness?: (group: string, extra: number, region: MuscleRegion) => void
  /** Déclare le muscle totalement remis (ou annule cette déclaration). */
  onPret?: (group: string, pret: boolean, region: MuscleRegion) => void
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
  const histo = historiqueParMuscle(sessions)

  const fill = (r: MuscleRegion | 'neutral') =>
    r === 'neutral' ? NEUTRAL : recoveryColor(byRegion[r]?.jours, byRegion[r]?.intensite)

  return (
    <div className="space-y-2">
      <svg
        viewBox="40 0 320 356"
        className="mx-auto w-full max-w-md"
        stroke="rgba(255,255,255,0.62)"
        strokeWidth="0.8"
        strokeLinejoin="round"
        aria-label="Récupération musculaire"
      >
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
        stroke="rgba(255,255,255,0.62)"
        strokeWidth="0.55"
        strokeLinejoin="round"
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
 * Temps restant avant que le muscle repasse « prêt », en jours réels.
 *
 * On repart de l'état courant plutôt que de refaire le calcul depuis la séance :
 * il porte déjà les courbatures déclarées et les récups actives. Au-delà du
 * plateau, les jours ressentis avancent de `vitesse ÷ intensité²` par jour réel
 * — il suffit d'inverser ce rapport.
 */
function resteAvantPret(info: ReposMuscle, region: MuscleRegion): number {
  if (info.jours >= SEUIL_PRET) return 0
  const i = Math.max(0.1, Math.min(1, info.intensite))
  const reste = ((SEUIL_PRET - info.jours) * i * i) / VITESSE_RECUP[region]
  // Arrondi à la section supérieure : mieux vaut annoncer une demi-journée de
  // trop qu'envoyer quelqu'un sur un muscle qui n'est pas encore revenu.
  return Math.max(PAS_JOURS, Math.ceil(reste / PAS_JOURS) * PAS_JOURS)
}

/** « 12 h », « 1 j », « 2 j ½ » — la même échelle que partout ailleurs. */
function fmtDuree(jours: number): string {
  if (jours < 1) return `${Math.round(jours * 24)} h`
  const pleins = Math.floor(jours)
  return `${pleins} j${jours - pleins >= PAS_JOURS ? ' ½' : ''}`
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
  onSoreness?: (group: string, extra: number, region: MuscleRegion) => void
  /** Déclare le muscle totalement remis. */
  onPret?: (group: string, pret: boolean, region: MuscleRegion) => void
  onClose: () => void
}) {
  const [courbOuvert, setCourbOuvert] = useState(false)
  const propositions = exercicesPourMuscle(region, 8)
  const color = recoveryColor(info?.jours, info?.intensite)
  const reste = info ? resteAvantPret(info, region) : 0
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
                  Déclaré remis sur <b className="text-ink">{info!.label}</b>. Annule ci-dessous pour revenir à la
                  barre.
                </>
              ) : (
                <>
                  Le barème se trompe ? Corrige-le. S'applique à <b className="text-ink">{info!.label}</b>, le groupe
                  déclaré dans la séance.
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
              onChange={(e) => onSoreness!(info!.label, Number(e.target.value), region)}
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
                onClick={() => onPret(info!.label, !totalementBon, region)}
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
                s’effacera d’elle-même dès que tu retravailleras {info!.label}.
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
                  ? `prêt dans ~${fmtDuree(reste)}`
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
            {info.intensite < 1
              ? ` — en secondaire (${Math.round(info.intensite * 100)} %), donc récupération plus rapide.`
              : ' — en moteur principal.'}
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
  const side = half.map(([region, d], i) => <path key={i} d={m(d)} fill={fill(region)} {...viser(region)} />)
  const base = BASE_HALF.map((d, i) => <path key={i} d={m(d)} fill={NEUTRAL} stroke="none" />)
  return (
    <g
      transform={`translate(${cx},0)`}
      onClick={onZoom}
      style={onZoom ? { cursor: 'zoom-in' } : undefined}
    >
      {/* Silhouette de base, puis les muscles par-dessus */}
      <path d={m(BASE_CENTER)} fill={NEUTRAL} stroke="none" />
      {base}
      <g transform="scale(-1,1)">{base}</g>
      {/* Tête ovoïde et cou, hors muscles suivis */}
      <ellipse cx="0" cy="24" rx={deformerX(13, 24, sexe)} ry="19.5" fill={NEUTRAL} />
      <path
        d={m('M-6.5,41 C-6.5,47 -8,51 -10,54 L10,54 C8,51 6.5,47 6.5,41 Z')}
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
            {...viser('rectus')}
          />
          <path
            d={m('M-12.6,111 L12.6,111 M-12.8,121 L12.8,121 M-12.4,131 L12.4,131 M0,99 L0,150')}
            strokeWidth="0.7"
            fill="none"
          />
          {/* Silhouette mammaire : elle repose SUR le grand pectoral, elle ne le
              remplace pas — un simple sillon sous-mammaire, sans remplissage,
              pour que la couleur du muscle reste lisible. */}
          {sexe === 'F' ? (
            <path
              d={m('M-24,74 C-24,88 -17,97 -7,97 M24,74 C24,88 17,97 7,97')}
              strokeWidth="0.9"
              fill="none"
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
    </g>
  )
}

