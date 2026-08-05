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

// ── Tracés ──────────────────────────────────────────────────────────────────
//
// Ils ne sont plus écrits ici : ils sont DÉCALQUÉS de deux planches
// anatomiques, par `tools/anatomie/tracer.py`, et vivent dans
// `mannequinTrace.ts`. Ce qui est dessiné à la main finit toujours par se
// voir — un ventre fusiforme inventé à côté d'un contour relevé, et le raccord
// saute aux yeux. Là, la silhouette, les cinquante-quatre muscles et les deux
// faces sortent de la même planche, donc tout se raccorde.
//
// Le repère n'a pas bougé : demi-corps, x de -76 à 0, y de 4 à 339, l'autre
// moitié par symétrie scale(-1,1). La tête, les mains, les pieds, les os et
// les tendons ne sont plus des tracés à part : ils sont ce que la silhouette
// laisse voir là où aucun muscle ne la couvre.

import { FRONT_HALF, BACK_HALF, SILHOUETTE_FACE, SILHOUETTE_DOS } from './mannequinTrace'

/** Ré-exportés : le banc de câblage vérifie ici qu'aucun muscle n'est sans tracé. */
export { FRONT_HALF, BACK_HALF }



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
  // La silhouette porte tout ce qui n'est pas muscle : tête, cou, mains,
  // pieds, os, tendons. Ils étaient cinq tracés écrits à la main par-dessus
  // lesquels on posait des muscles relevés ailleurs — deux géométries, un
  // raccord visible. Ici c'est le MÊME contour que les muscles.
  //
  // Elle est déjà entière, miroir compris : elle ne passe donc PAS par le
  // scale(-1,1) des muscles. Deux moitiés recevaient chacune le voile de
  // volume et se recouvraient au milieu — une couture claire du crâne aux
  // talons.
  const corps = m(back ? SILHOUETTE_DOS : SILHOUETTE_FACE)
  const silhouette = (fillId: string) => (
    <path d={corps} fill={fillId} stroke="none" pointerEvents="none" />
  )
  return (
    <g
      transform={`translate(${cx},0)`}
      onClick={onZoom}
      style={onZoom ? { cursor: 'zoom-in' } : undefined}
      filter="url(#mb-relief)"
    >
      {silhouette(NEUTRAL)}
      {side}
      <g transform="scale(-1,1)">{side}</g>
      {/* Silhouette mammaire : elle repose SUR le grand pectoral, elle ne le
          remplace pas — un simple sillon sous-mammaire, sans remplissage, pour
          que la couleur du muscle reste lisible. */}
      {sexe === 'F' && !back ? (
        <path
          d={m('M-30,74 C-30,90 -21,100 -9,100 M30,74 C30,90 21,100 9,100')}
          strokeWidth="0.9"
          fill="none"
          pointerEvents="none"
        />
      ) : null}
      {/* Voile de volume, tout en dernier et transparent au clic : il galbe le
          corps sans changer une teinte ni voler un clic au zoom. Posé sur la
          silhouette et non sur un rectangle — un rectangle laissait voir ses
          propres bords, un cadre plus clair autour du corps. */}
      {silhouette('url(#mb-volume)')}
      {silhouette('url(#mb-galbe)')}
    </g>
  )
}

