import { useState } from 'react'
import type { GroupLoad } from '../lib/muscu'
import { PALIERS } from '../lib/soreness'

// Mannequin de récupération, façon planche anatomique : chaque muscle est un
// tracé distinct (une trentaine), coloré sur un spectre continu selon
// l'ancienneté de son dernier travail pondérée par l'intensité :
//   0-2 j  → rouge          (en récupération)
//   3-4 j  → orange, ambre  (bientôt prêt)
//   5-7 j  → lime, vert     (prêt)
//   ≥ 10 j → turquoise      (en attente / jamais travaillé)
//
// Les tracés sont exprimés dans un repère centré (x = 0 au milieu du corps) :
// on ne décrit qu'une moitié, l'autre est obtenue par symétrie (scale(-1,1)).

export type MuscleRegion =
  | 'neck'
  | 'trapsUpper'
  | 'trapsMid'
  | 'trapsLow'
  | 'deltAnt'
  | 'deltLat'
  | 'deltPost'
  | 'pecUpper'
  | 'pecLower'
  | 'serratus'
  | 'lats'
  | 'teres'
  | 'erectors'
  | 'biceps'
  | 'brachialis'
  | 'tricepsLong'
  | 'tricepsLat'
  | 'forearmFlex'
  | 'forearmExt'
  | 'rectus'
  | 'obliques'
  | 'gluteMax'
  | 'gluteMed'
  | 'rectusFemoris'
  | 'vastusLat'
  | 'vastusMed'
  | 'adductors'
  | 'bicepsFemoris'
  | 'hamsInner'
  | 'gastroc'
  | 'soleus'
  | 'tibialis'

/** Nom affiché quand on touche un muscle sur le schéma. */
export const MUSCLE_LABELS: Record<MuscleRegion, string> = {
  neck: 'Cou (sterno-cléido-mastoïdien)',
  trapsUpper: 'Trapèze supérieur',
  trapsMid: 'Trapèze moyen',
  trapsLow: 'Trapèze inférieur',
  deltAnt: 'Deltoïde antérieur',
  deltLat: 'Deltoïde latéral',
  deltPost: 'Deltoïde postérieur',
  pecUpper: 'Pectoral supérieur (faisceau claviculaire)',
  pecLower: 'Grand pectoral',
  serratus: 'Dentelé antérieur',
  lats: 'Grand dorsal',
  teres: 'Grand rond',
  erectors: 'Érecteurs du rachis',
  biceps: 'Biceps brachial',
  brachialis: 'Brachial antérieur',
  tricepsLong: 'Triceps — longue portion',
  tricepsLat: 'Triceps — portion latérale',
  forearmFlex: 'Fléchisseurs de l’avant-bras',
  forearmExt: 'Extenseurs de l’avant-bras',
  rectus: 'Grand droit de l’abdomen',
  obliques: 'Obliques',
  gluteMax: 'Grand fessier',
  gluteMed: 'Moyen fessier',
  rectusFemoris: 'Droit fémoral',
  vastusLat: 'Vaste latéral',
  vastusMed: 'Vaste médial',
  adductors: 'Adducteurs',
  bicepsFemoris: 'Biceps fémoral',
  hamsInner: 'Ischios internes',
  gastroc: 'Gastrocnémiens (jumeaux)',
  soleus: 'Soléaire',
  tibialis: 'Tibial antérieur',
}

const NEUTRAL = '#C9C4BD'

/**
 * Rampe de teintes du mannequin : un vrai spectre plutôt que trois couleurs.
 * Le rouge dit « viens de travailler », le turquoise « disponible depuis
 * longtemps », et tout le dégradé entre les deux se lit sans avoir à comparer
 * deux nuances côte à côte.
 *
 * Les paliers historiques restent lisibles : rouge jusqu'à 2 j, ambre à 3-4 j,
 * bascule franche dans les verts à partir de 5 j.
 */
const RAMPE: Array<[jours: number, teinte: number]> = [
  [0, 0], //   rouge
  [1, 10], //  rouge chaud
  [2, 22], //  rouge orangé — dernier cran « en récup »
  [3, 34], //  orange
  [4, 46], //  ambre — dernier cran « bientôt prêt »
  [5, 74], //  jaune-vert : bascule sur « prêt »
  [7, 108], // vert clair
  [10, 145], // vert
  [14, 168], // turquoise : en attente depuis longtemps
]

/** Teinte interpolée sur la rampe. */
function teinte(jours: number): number {
  if (jours <= RAMPE[0][0]) return RAMPE[0][1]
  for (let i = 1; i < RAMPE.length; i++) {
    const [j0, h0] = RAMPE[i - 1]
    const [j1, h1] = RAMPE[i]
    if (jours <= j1) return h0 + ((jours - j0) / (j1 - j0)) * (h1 - h0)
  }
  return RAMPE[RAMPE.length - 1][1]
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`
}

/** Trois degrés de sollicitation, pour la légende et les pastilles. */
export type Sollicitation = 'principal' | 'secondaire' | 'leger'

export function sollicitation(intensity: number): Sollicitation {
  if (intensity >= 0.8) return 'principal'
  if (intensity >= 0.5) return 'secondaire'
  return 'leger'
}

export const SOLLICITATION_MARQUEUR: Record<Sollicitation, string> = {
  principal: '●',
  secondaire: '◐',
  leger: '○',
}

/**
 * Couleur d'un muscle. La TEINTE porte l'état de récupération, du rouge au
 * turquoise. Sur la partie chaude (encore en récup), l'intensité du dernier
 * travail module la densité : un moteur principal est soutenu, un
 * stabilisateur reste clair — mais tous deux franchement colorés.
 *
 * Passé le seuil de disponibilité, la teinte suffit : plus le muscle attend,
 * plus il tire vers le turquoise.
 */
export function recoveryColor(effectiveDays: number | undefined, intensity = 1): string {
  // Jamais travaillé sur la période : disponibilité maximale.
  if (effectiveDays === undefined) return hsl(168, 58, 44)
  const h = teinte(effectiveDays)
  if (effectiveDays > 4) return hsl(h, 58, 44)
  return hsl(h, 62 + 20 * intensity, 66 - 16 * intensity)
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// ── Correspondance libellé → muscles ────────────────────────────────────────
// La recherche se fait par égalité sur le libellé normalisé : plus de piège de
// sous-chaîne (« Abdos » contient « dos »).

const DELTS: MuscleRegion[] = ['deltAnt', 'deltLat', 'deltPost']
const TRAPS: MuscleRegion[] = ['trapsUpper', 'trapsMid', 'trapsLow']
const PECS: MuscleRegion[] = ['pecUpper', 'pecLower']
const TRICEPS: MuscleRegion[] = ['tricepsLong', 'tricepsLat']
const FOREARMS: MuscleRegion[] = ['forearmFlex', 'forearmExt']
const BACK: MuscleRegion[] = ['lats', 'teres', 'trapsMid', 'trapsLow']
const ABS: MuscleRegion[] = ['rectus', 'obliques']
const GLUTES: MuscleRegion[] = ['gluteMax', 'gluteMed']
const QUADS: MuscleRegion[] = ['rectusFemoris', 'vastusLat', 'vastusMed']
const HAMS: MuscleRegion[] = ['bicepsFemoris', 'hamsInner']
const CALVES: MuscleRegion[] = ['gastroc', 'soleus']
const LEGS: MuscleRegion[] = [...QUADS, ...HAMS, ...CALVES, ...GLUTES, 'adductors', 'tibialis']
const UPPER: MuscleRegion[] = [...PECS, ...BACK, ...DELTS, ...TRICEPS, ...TRAPS, 'biceps', 'brachialis']

const MUSCLE_MAP: Record<string, MuscleRegion[]> = {
  // Groupes larges
  epaules: DELTS,
  pectoraux: PECS,
  dos: BACK,
  trapezes: TRAPS,
  triceps: TRICEPS,
  'avant-bras': FOREARMS,
  'abdos/core': ABS,
  fessiers: GLUTES,
  quadriceps: QUADS,
  ischios: HAMS,
  mollets: CALVES,
  lombaires: ['erectors'],
  cou: ['neck'],
  biceps: ['biceps', 'brachialis'],
  obliques: ['obliques'],
  adducteurs: ['adductors'],
  // Muscles précis
  'deltoide anterieur': ['deltAnt'],
  'deltoide lateral': ['deltLat'],
  'deltoide posterieur': ['deltPost'],
  'trapeze superieur': ['trapsUpper'],
  'trapeze moyen': ['trapsMid'],
  'trapeze inferieur': ['trapsLow'],
  rhomboides: ['trapsMid'],
  'pectoral superieur': ['pecUpper'],
  'grand pectoral': PECS,
  'grand dorsal': ['lats'],
  'grand rond': ['teres'],
  'dentele anterieur': ['serratus'],
  'erecteurs du rachis': ['erectors'],
  brachial: ['brachialis'],
  'brachio-radial': ['forearmFlex'],
  'triceps longue portion': ['tricepsLong'],
  'triceps lateral': ['tricepsLat'],
  'flechisseurs avant-bras': ['forearmFlex'],
  'extenseurs avant-bras': ['forearmExt'],
  'grand droit': ['rectus'],
  transverse: ['rectus'],
  'grand fessier': ['gluteMax'],
  'moyen fessier': ['gluteMed'],
  'droit femoral': ['rectusFemoris'],
  'vaste lateral': ['vastusLat'],
  'vaste medial': ['vastusMed'],
  'biceps femoral': ['bicepsFemoris'],
  'ischios internes': ['hamsInner'],
  gastrocnemiens: ['gastroc'],
  soleaire: ['soleus'],
  'tibial anterieur': ['tibialis'],
}

/** Les muscles couverts par un libellé de groupe ou de muscle. */
export function regionsForGroup(label: string): MuscleRegion[] {
  const n = norm(label)
  if (!n) return []
  const exact = MUSCLE_MAP[n]
  if (exact) return exact
  if (n.includes('full body') || n.includes('corps entier')) return [...LEGS, ...UPPER, ...ABS, 'neck', ...FOREARMS]
  if (n.includes('jambes')) return LEGS
  if (n.includes('haut du corps')) return UPPER
  // Repli tolérant pour les libellés personnalisés.
  for (const [key, regions] of Object.entries(MUSCLE_MAP)) {
    if (n.includes(key)) return regions
  }
  return [] // ex. « Cardio » : aucun muscle dédié
}

// ── Tracés (repère centré, moitié gauche du corps) ──────────────────────────

// Silhouette de base sous les muscles : sans elle, le fond apparaît entre les
// tracés et le corps semble fragmenté. Les bras descendent jusqu'aux mains,
// sinon celles-ci flottent à côté du corps.
const BASE_CENTER =
  'M-30,54 C-33,74 -30,104 -26,124 C-24,136 -24,148 -24,158 L24,158 C24,148 24,136 26,124 C30,104 33,74 30,54 C27,47 14,42 7,40 L-7,40 C-14,42 -27,47 -30,54 Z'
const BASE_HALF: string[] = [
  // bras : de l'épaule à la main
  'M-30,55 C-42,60 -47,80 -44,101 C-42,120 -48,144 -46,169 C-45,185 -34,187 -33,170 C-31,146 -35,121 -33,102 C-31,82 -24,65 -23,57 Z',
  // jambe : de la hanche au pied
  'M-26,152 C-32,182 -30,220 -24,250 C-23,264 -24,276 -23,284 L-5,284 C-4,264 -5,246 -5,234 C-5,200 -3,178 0,153 Z',
]

const FRONT_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  ['neck', 'M-6,38 C-10,44 -11,49 -11,54 L-4,54 C-4,48 -4,43 -4,38 Z'],
  ['trapsUpper', 'M-9,44 C-17,47 -25,54 -31,62 L-19,67 C-15,58 -11,50 -9,44 Z'],
  ['deltLat', 'M-33,63 C-45,68 -49,84 -46,98 C-41,99 -37,87 -36,74 Z'],
  ['deltAnt', 'M-29,65 C-36,70 -40,82 -38,94 C-33,95 -29,84 -28,73 Z'],
  ['pecUpper', 'M-27,66 C-17,62 -4,63 -2,68 L-2,78 L-26,78 C-27,73 -27,69 -27,66 Z'],
  ['pecLower', 'M-26,79 L-2,79 L-2,95 C-11,102 -23,98 -28,88 C-29,83 -27,80 -26,79 Z'],
  ['serratus', 'M-25,86 C-22,92 -21,98 -21,102 L-16,101 C-17,94 -20,89 -21,85 Z'],
  ['obliques', 'M-22,105 C-18,119 -15,133 -14,146 L-22,140 C-25,126 -25,116 -22,105 Z'],
  ['biceps', 'M-40,99 C-47,108 -47,124 -41,134 C-36,132 -35,113 -36,100 Z'],
  ['brachialis', 'M-35,118 C-37,125 -37,132 -36,137 L-31,135 C-32,127 -32,122 -32,117 Z'],
  ['forearmFlex', 'M-43,137 C-50,149 -51,163 -47,173 L-39,171 C-38,157 -38,146 -39,138 Z'],
  ['neutral', 'M-44,173 C-50,178 -50,188 -44,192 C-38,188 -38,178 -44,173 Z'],
  ['vastusLat', 'M-25,160 C-30,184 -29,204 -25,222 L-17,222 C-17,199 -18,179 -19,165 Z'],
  ['rectusFemoris', 'M-16,161 C-19,186 -18,208 -15,226 L-8,226 C-7,204 -8,182 -9,166 Z'],
  ['vastusMed', 'M-24,210 C-24,221 -21,229 -15,231 L-9,229 C-11,221 -16,216 -17,209 Z'],
  ['adductors', 'M-7,163 C-9,185 -9,202 -8,214 L0,214 L0,167 Z'],
  ['neutral', 'M-24,233 C-18,239 -8,239 -3,233 L-3,242 C-9,247 -18,247 -24,242 Z'],
  ['gastroc', 'M-22,244 C-23,258 -22,272 -19,280 L-14,280 C-14,266 -15,254 -16,244 Z'],
  ['tibialis', 'M-15,244 C-16,260 -15,274 -13,283 L-5,283 C-4,266 -5,254 -9,244 Z'],
  ['neutral', 'M-23,286 L-3,286 L-3,296 L-26,296 Z'],
]

const BACK_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  ['neck', 'M-7,38 C-10,44 -10,49 -10,54 L-3,54 C-3,48 -3,43 -3,38 Z'],
  ['deltLat', 'M-34,62 C-46,67 -49,83 -46,97 C-42,98 -38,86 -37,73 Z'],
  ['deltPost', 'M-30,64 C-38,69 -42,80 -40,92 C-35,93 -31,82 -30,71 Z'],
  ['trapsUpper', 'M0,41 L-9,42 C-19,47 -27,55 -33,63 L-21,70 C-15,59 -6,50 0,48 Z'],
  ['trapsMid', 'M0,53 L-20,72 L-18,92 L0,83 Z'],
  ['trapsLow', 'M0,85 L-17,94 L-8,120 L0,117 Z'],
  ['teres', 'M-29,78 C-24,81 -20,86 -18,92 L-25,97 C-28,89 -29,83 -29,78 Z'],
  ['lats', 'M-32,87 C-33,105 -28,124 -16,139 L-4,139 L-6,118 L-19,97 Z'],
  ['erectors', 'M-9,121 L-1,121 L-1,158 L-8,158 Z'],
  ['tricepsLong', 'M-38,100 C-40,111 -40,126 -39,135 L-33,132 C-33,121 -33,109 -33,101 Z'],
  ['tricepsLat', 'M-44,102 C-48,111 -48,126 -44,135 L-40,133 C-40,122 -40,112 -41,102 Z'],
  ['forearmExt', 'M-45,136 C-52,148 -53,163 -48,173 L-40,171 C-39,157 -39,146 -41,137 Z'],
  ['neutral', 'M-44,173 C-50,178 -50,188 -44,192 C-38,188 -38,178 -44,173 Z'],
  ['gluteMed', 'M-25,148 C-28,158 -28,167 -25,173 L-18,169 C-19,163 -20,157 -20,151 Z'],
  ['gluteMax', 'M-21,157 C-25,171 -24,185 -17,192 C-7,193 -2,183 -2,172 L-2,161 Z'],
  ['bicepsFemoris', 'M-23,194 C-26,212 -25,230 -21,243 L-15,243 C-15,224 -16,206 -18,195 Z'],
  ['hamsInner', 'M-14,195 C-15,213 -14,230 -13,243 L-6,243 C-5,225 -6,207 -8,195 Z'],
  ['neutral', 'M-24,245 C-18,251 -8,251 -3,245 L-3,254 C-9,259 -18,259 -24,254 Z'],
  ['gastroc', 'M-22,256 C-25,268 -24,280 -20,286 L-15,286 C-15,274 -16,264 -17,256 Z'],
  ['gastroc', 'M-14,256 C-14,270 -13,281 -12,286 L-6,286 C-5,274 -6,264 -7,256 Z'],
  ['soleus', 'M-21,287 C-22,292 -21,295 -18,296 L-8,296 C-6,292 -6,288 -7,287 Z'],
  ['neutral', 'M-23,298 L-3,298 L-3,308 L-26,308 Z'],
]

export function MuscleBodyDiagram({
  loads,
  onSoreness,
}: {
  loads: Record<string, GroupLoad>
  /** Déclare des courbatures sur un groupe : + N jours de récup (0 = annuler). */
  onSoreness?: (group: string, extra: number) => void
}) {
  const [selected, setSelected] = useState<MuscleRegion | null>(null)
  const [groupOuvert, setGroupOuvert] = useState<string | null>(null)

  // Chaque muscle prend la sollicitation la plus fraîche parmi les libellés qui
  // le couvrent ; on garde le libellé d'origine pour la fiche au clic.
  const byRegion: Partial<Record<MuscleRegion, { label: string; load: GroupLoad }>> = {}
  for (const [group, load] of Object.entries(loads)) {
    for (const region of regionsForGroup(group)) {
      const cur = byRegion[region]
      if (!cur || load.effectiveDays < cur.load.effectiveDays) byRegion[region] = { label: group, load }
    }
  }

  const fill = (r: MuscleRegion | 'neutral') =>
    r === 'neutral' ? NEUTRAL : recoveryColor(byRegion[r]?.load.effectiveDays, byRegion[r]?.load.intensity)
  const tracked = Object.entries(loads).sort((a, b) => a[1].effectiveDays - b[1].effectiveDays)

  return (
    <div className="space-y-2">
      <svg
        viewBox="0 0 400 330"
        className="mx-auto w-full max-w-md"
        stroke="#ffffff"
        strokeWidth="1"
        strokeLinejoin="round"
        aria-label="Récupération musculaire"
      >
        <Figure cx={105} half={FRONT_HALF} fill={fill} back={false} onPick={setSelected} />
        <Figure cx={295} half={BACK_HALF} fill={fill} back onPick={setSelected} />
        <text x="105" y="324" textAnchor="middle" fill="#a8a29e" fontSize="11" stroke="none">
          Face
        </text>
        <text x="295" y="324" textAnchor="middle" fill="#a8a29e" fontSize="11" stroke="none">
          Dos
        </text>
      </svg>

      {/* Spectre : une barre continue vaut mieux que trois pastilles isolées. */}
      <div className="px-1">
        <div
          className="h-2.5 w-full rounded-full"
          style={{
            background: `linear-gradient(to right, ${[0, 1, 2, 3, 4, 5, 7, 10, 14]
              .map((j) => recoveryColor(j))
              .join(', ')})`,
          }}
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-muted">
          <span>en récup</span>
          <span>bientôt prêt</span>
          <span>prêt</span>
          <span>en attente</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted">
        <span className="font-semibold">Intensité du dernier travail :</span>
        {(['principal', 'secondaire', 'leger'] as Sollicitation[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded"
              style={{ background: recoveryColor(1, s === 'principal' ? 1 : s === 'secondaire' ? 0.6 : 0.3) }}
            />
            {SOLLICITATION_MARQUEUR[s]} {s === 'leger' ? 'appoint' : s}
          </span>
        ))}
      </div>

      {tracked.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tracked.map(([group, load]) => {
            const color = recoveryColor(load.effectiveDays, load.intensity)
            return (
              <button
                key={group}
                onClick={() => setGroupOuvert(group)}
                className="chip flex items-center gap-1 text-[10px]"
                style={{ background: color + '22', color }}
                title="Toucher pour déclarer des courbatures"
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                {group} {SOLLICITATION_MARQUEUR[sollicitation(load.intensity)]} ·{' '}
                {load.days === 0 ? "aujourd'hui" : load.days === 1 ? 'hier' : `il y a ${load.days} j`}
                {load.soreExtra ? ` · 😣 +${load.soreExtra} j` : ''}
                <span className="ml-0.5 font-bold opacity-60">+</span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-center text-[11px] text-muted">
          Enregistre des séances avec un groupe visé : le mannequin se colorera tout seul.
        </p>
      )}

      {selected ? (
        <MuscleSheet region={selected} info={byRegion[selected]} onClose={() => setSelected(null)} />
      ) : null}

      {groupOuvert && loads[groupOuvert] ? (
        <SorenessSheet
          group={groupOuvert}
          load={loads[groupOuvert]}
          onSoreness={onSoreness}
          onClose={() => setGroupOuvert(null)}
        />
      ) : null}
    </div>
  )
}

/** Menu ouvert au clic sur une pastille de groupe : déclarer des courbatures. */
function SorenessSheet({
  group,
  load,
  onSoreness,
  onClose,
}: {
  group: string
  load: GroupLoad
  onSoreness?: (group: string, extra: number) => void
  onClose: () => void
}) {
  const actuel = load.soreExtra ?? 0
  const choisir = (extra: number) => {
    onSoreness?.(group, extra === actuel ? 0 : extra)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm rounded-b-none p-5 sm:rounded-xl2" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 className="text-base font-extrabold text-ink">{group}</h2>
          <button onClick={onClose} className="shrink-0 text-muted hover:text-ink">
            ✕
          </button>
        </div>

        <p className="text-xs text-muted">
          Travaillé{' '}
          <b className="text-ink">
            {load.days === 0 ? "aujourd'hui" : load.days === 1 ? 'hier' : `il y a ${load.days} jours`}
          </b>
          {load.intensity < 1 ? ` en secondaire (${Math.round(load.intensity * 100)} %)` : ' en moteur principal'}.
        </p>

        <div className="mt-3 border-t border-line/60 pt-3">
          <div className="text-sm font-bold text-ink">😣 Courbatures plus fortes que prévu ?</div>
          <p className="mb-2 text-[11px] text-muted">
            Ajoute du temps de récupération : le mannequin le garde en rouge plus longtemps, et le générateur de
            séance évite ce groupe d'autant.
          </p>
          <div className="flex gap-1.5">
            {PALIERS.map((n) => (
              <button
                key={n}
                onClick={() => choisir(n)}
                className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition ${
                  actuel === n ? 'bg-clay text-white' : 'bg-white/5 text-muted hover:text-ink'
                }`}
              >
                +{n} j
              </button>
            ))}
          </div>
          {actuel > 0 ? (
            <button
              onClick={() => choisir(0)}
              className="mt-2 w-full rounded-lg bg-white/5 px-2 py-1.5 text-xs font-semibold text-muted hover:text-ink"
            >
              Retirer les {actuel} j déclarés
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Fiche affichée au clic sur un muscle du schéma. */
function MuscleSheet({
  region,
  info,
  onClose,
}: {
  region: MuscleRegion
  info?: { label: string; load: GroupLoad }
  onClose: () => void
}) {
  const color = recoveryColor(info?.load.effectiveDays, info?.load.intensity)
  const etat = !info
    ? 'Prêt — jamais travaillé sur les séances chargées'
    : info.load.effectiveDays <= 2
      ? 'En récupération'
      : info.load.effectiveDays <= 4
        ? 'Bientôt prêt'
        : 'Prêt'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm rounded-b-none p-5 sm:rounded-xl2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 className="text-base font-extrabold text-ink">{MUSCLE_LABELS[region]}</h2>
          <button onClick={onClose} className="shrink-0 text-muted hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
          <span className="font-semibold" style={{ color }}>
            {etat}
          </span>
        </div>

        {info ? (
          <p className="mt-2 text-xs text-muted">
            Dernière sollicitation :{' '}
            <b className="text-ink">
              {info.load.days === 0 ? "aujourd'hui" : info.load.days === 1 ? 'hier' : `il y a ${info.load.days} jours`}
            </b>{' '}
            via <b className="text-ink">{info.label}</b>
            {info.load.intensity < 1
              ? ` — en secondaire (${Math.round(info.load.intensity * 100)} %), donc récupération plus rapide.`
              : ' — en moteur principal.'}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Aucun exercice récent ne vise ce muscle. C'est peut-être l'occasion.
          </p>
        )}
      </div>
    </div>
  )
}

function Figure({
  cx,
  half,
  fill,
  back,
  onPick,
}: {
  cx: number
  half: Array<[MuscleRegion | 'neutral', string]>
  fill: (r: MuscleRegion | 'neutral') => string
  back: boolean
  onPick: (r: MuscleRegion) => void
}) {
  // Les zones non suivies (mains, genoux, pieds) ne sont pas cliquables.
  const side = half.map(([region, d], i) => (
    <path
      key={i}
      d={d}
      fill={fill(region)}
      onClick={region === 'neutral' ? undefined : () => onPick(region)}
      style={region === 'neutral' ? undefined : { cursor: 'pointer' }}
    />
  ))
  const base = BASE_HALF.map((d, i) => <path key={i} d={d} fill={NEUTRAL} stroke="none" />)
  return (
    <g transform={`translate(${cx},0)`}>
      {/* Silhouette de base, puis les muscles par-dessus */}
      <path d={BASE_CENTER} fill={NEUTRAL} stroke="none" />
      {base}
      <g transform="scale(-1,1)">{base}</g>
      <ellipse cx="0" cy="22" rx="12" ry="15" fill={NEUTRAL} />
      <path d="M-8,34 L8,34 L9,56 L-9,56 Z" fill={NEUTRAL} stroke="none" />
      {/* Grand droit : uniquement de face, avec ses intersections tendineuses */}
      {back ? null : (
        <>
          <path
            d="M-12,100 L12,100 L11,146 C5,152 -5,152 -11,146 Z"
            fill={fill('rectus')}
            onClick={() => onPick('rectus')}
            style={{ cursor: 'pointer' }}
          />
          <path d="M-11,114 L11,114 M-11,130 L11,130 M0,101 L0,145" strokeWidth="0.8" fill="none" />
        </>
      )}
      {/* Bassin */}
      <path
        d={back ? 'M-14,152 L14,152 L15,172 L-15,172 Z' : 'M-14,152 L14,152 L16,176 L-16,176 Z'}
        fill={NEUTRAL}
      />
      {side}
      <g transform="scale(-1,1)">{side}</g>
    </g>
  )
}

