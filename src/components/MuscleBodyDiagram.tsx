import { useState } from 'react'
import type { GroupLoad } from '../lib/muscu'
import { PALIERS } from '../lib/soreness'

// Mannequin de récupération, façon planche anatomique : chaque muscle est un
// tracé distinct (une trentaine), coloré selon l'ancienneté de son dernier
// travail pondérée par l'intensité :
//   0-2 j  → rouge  (en récupération)
//   3-4 j  → orange (bientôt prêt)
//   ≥ 5 j  → vert   (prêt / jamais travaillé)
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

const RED = '#EF4444'
const ORANGE = '#F59E0B'
const GREEN = '#10B981'
const NEUTRAL = '#C9C4BD'

/** Seuils : rouge jusqu'à 2 j, orange à 3-4 j, vert à partir de 5 j. */
export function recoveryColor(effectiveDays: number | undefined): string {
  if (effectiveDays === undefined) return GREEN
  if (effectiveDays <= 2) return RED
  if (effectiveDays <= 4) return ORANGE
  return GREEN
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
// tracés et le corps semble fragmenté.
const BASE_CENTER =
  'M-25,44 C-27,62 -22,92 -19,109 L19,109 C22,92 27,62 25,44 C22,37 12,32 6,30 L-6,30 C-12,32 -22,37 -25,44 Z'
const BASE_HALF: string[] = [
  // bras : de l'épaule à la main
  'M-24,44 C-34,48 -40,62 -37,78 C-35,95 -41,112 -39,129 C-38,137 -31,139 -30,130 C-28,112 -30,96 -28,80 C-26,64 -20,52 -19,46 Z',
  // jambe : de la hanche au pied
  'M-20,106 C-24,128 -22,160 -18,182 C-17,197 -18,209 -17,217 L-4,217 C-3,200 -4,186 -4,176 C-4,150 -2,128 0,107 Z',
]

const FRONT_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  ['neck', 'M-4,26 C-7,30 -8,34 -8,37 L-3,37 C-3,33 -3,29 -3,26 Z'],
  ['trapsUpper', 'M-7,31 C-13,33 -19,39 -24,46 L-14,49 C-11,42 -8,36 -7,31 Z'],
  ['deltLat', 'M-26,47 C-34,50 -38,60 -36,70 C-32,71 -29,64 -28,55 Z'],
  ['deltAnt', 'M-23,49 C-28,52 -31,60 -30,68 C-26,69 -23,62 -22,55 Z'],
  ['pecUpper', 'M-21,50 C-13,47 -4,48 -2,52 L-2,58 L-20,58 C-21,55 -21,52 -21,50 Z'],
  ['pecLower', 'M-20,59 L-2,59 L-2,70 C-9,75 -18,72 -22,65 C-23,62 -21,60 -20,59 Z'],
  ['serratus', 'M-19,63 C-17,67 -16,71 -16,74 L-12,73 C-13,69 -15,65 -16,62 Z'],
  ['obliques', 'M-16,76 C-13,86 -11,96 -10,105 L-16,101 C-18,92 -18,84 -16,76 Z'],
  ['biceps', 'M-31,71 C-36,77 -36,88 -32,95 C-28,93 -27,80 -28,72 Z'],
  ['brachialis', 'M-27,84 C-29,89 -29,94 -28,97 L-24,95 C-25,90 -25,86 -25,83 Z'],
  ['forearmFlex', 'M-34,97 C-39,105 -40,117 -37,126 L-31,124 C-30,113 -30,104 -31,98 Z'],
  ['neutral', 'M-36,128 C-40,131 -40,138 -36,140 C-32,138 -32,131 -36,128 Z'], // main
  ['vastusLat', 'M-19,126 C-22,140 -21,154 -18,167 L-13,167 C-13,150 -13,136 -14,127 Z'],
  ['rectusFemoris', 'M-12,127 C-14,142 -13,158 -11,172 L-6,172 C-5,156 -6,140 -7,128 Z'],
  ['vastusMed', 'M-18,159 C-18,167 -16,173 -12,175 L-7,173 C-9,167 -12,163 -13,158 Z'],
  ['adductors', 'M-5,129 C-7,141 -7,153 -6,162 L0,162 L0,129 Z'],
  ['neutral', 'M-18,176 C-14,180 -7,180 -4,176 L-4,182 C-8,185 -14,185 -18,182 Z'], // genou
  ['gastroc', 'M-16,183 C-17,193 -16,203 -14,209 L-11,209 C-11,199 -12,190 -13,183 Z'],
  ['tibialis', 'M-12,183 C-13,194 -12,204 -10,211 L-5,211 C-4,199 -5,190 -7,183 Z'],
  ['neutral', 'M-17,214 L-3,214 L-3,222 L-19,222 Z'], // pied
]

const BACK_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  ['neck', 'M-5,26 C-7,30 -7,34 -7,37 L-2,37 C-2,33 -2,29 -2,26 Z'],
  ['deltLat', 'M-27,46 C-35,49 -38,59 -36,69 C-33,70 -30,63 -29,54 Z'],
  ['deltPost', 'M-24,48 C-30,51 -33,58 -32,66 C-28,67 -25,60 -24,53 Z'],
  ['trapsUpper', 'M0,32 L-7,32 C-14,35 -20,41 -25,47 L-16,52 C-11,44 -5,38 0,36 Z'],
  ['trapsMid', 'M0,38 L-15,53 L-13,66 L0,60 Z'],
  ['trapsLow', 'M0,61 L-12,67 L-6,86 L0,84 Z'],
  ['teres', 'M-22,57 C-18,59 -15,62 -13,66 L-18,70 C-20,65 -22,61 -22,57 Z'],
  ['lats', 'M-24,63 C-25,75 -21,89 -12,100 L-3,100 L-5,85 L-14,71 Z'],
  ['erectors', 'M-7,87 L-1,87 L-1,116 L-6,116 Z'],
  ['tricepsLong', 'M-29,72 C-31,80 -31,90 -30,96 L-26,94 C-26,86 -26,78 -26,73 Z'],
  ['tricepsLat', 'M-34,74 C-37,80 -37,90 -34,96 L-31,95 C-31,87 -31,80 -32,74 Z'],
  ['forearmExt', 'M-35,97 C-40,105 -41,117 -38,126 L-31,124 C-30,113 -30,104 -32,98 Z'],
  ['neutral', 'M-36,128 C-40,131 -40,138 -36,140 C-32,138 -32,131 -36,128 Z'], // main
  ['gluteMed', 'M-19,113 C-21,117 -21,123 -19,127 L-14,124 C-15,120 -16,116 -16,112 Z'],
  ['gluteMax', 'M-16,119 C-19,126 -18,135 -13,140 C-6,141 -2,134 -2,126 L-2,119 Z'],
  ['bicepsFemoris', 'M-17,142 C-19,155 -18,168 -15,177 L-11,177 C-11,163 -12,150 -13,143 Z'],
  ['hamsInner', 'M-10,143 C-11,156 -10,168 -9,177 L-5,177 C-4,164 -5,151 -6,143 Z'],
  ['neutral', 'M-18,178 C-14,182 -7,182 -4,178 L-4,184 C-8,187 -14,187 -18,184 Z'], // genou
  ['gastroc', 'M-16,185 C-19,193 -18,202 -15,206 L-11,206 C-11,198 -12,191 -13,185 Z'],
  ['gastroc', 'M-10,185 C-10,194 -9,202 -8,206 L-5,206 C-4,198 -5,191 -6,185 Z'],
  ['soleus', 'M-15,206 C-16,210 -15,212 -13,213 L-6,213 C-5,210 -5,207 -6,206 Z'],
  ['neutral', 'M-17,214 L-3,214 L-3,222 L-19,222 Z'], // pied
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
    r === 'neutral' ? NEUTRAL : recoveryColor(byRegion[r]?.load.effectiveDays)
  const tracked = Object.entries(loads).sort((a, b) => a[1].effectiveDays - b[1].effectiveDays)

  return (
    <div className="space-y-2">
      <svg
        viewBox="0 0 300 240"
        className="mx-auto w-full max-w-sm"
        stroke="#ffffff"
        strokeWidth="0.9"
        strokeLinejoin="round"
        aria-label="Récupération musculaire"
      >
        <Figure cx={75} half={FRONT_HALF} fill={fill} back={false} onPick={setSelected} />
        <Figure cx={225} half={BACK_HALF} fill={fill} back onPick={setSelected} />
        <text x="75" y="236" textAnchor="middle" fill="#a8a29e" fontSize="9" stroke="none">
          Face
        </text>
        <text x="225" y="236" textAnchor="middle" fill="#a8a29e" fontSize="9" stroke="none">
          Dos
        </text>
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <Legend color={RED} label="0-2 j — en récup" />
        <Legend color={ORANGE} label="3-4 j — bientôt prêt" />
        <Legend color={GREEN} label="≥ 5 j — prêt" />
      </div>

      {tracked.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tracked.map(([group, load]) => {
            const color = recoveryColor(load.effectiveDays)
            return (
              <button
                key={group}
                onClick={() => setGroupOuvert(group)}
                className="chip flex items-center gap-1 text-[10px]"
                style={{ background: color + '22', color }}
                title="Toucher pour déclarer des courbatures"
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                {group}
                {load.intensity < 1 ? ' ◐' : ''} ·{' '}
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
  const color = recoveryColor(info?.load.effectiveDays)
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
      <ellipse cx="0" cy="16" rx="10" ry="12" fill={NEUTRAL} />
      <path d="M-6,24 L6,24 L7,38 L-7,38 Z" fill={NEUTRAL} stroke="none" />
      {/* Grand droit : uniquement de face */}
      {back ? null : (
        <>
          <path
            d="M-9,74 L9,74 L8,107 C4,111 -4,111 -8,107 Z"
            fill={fill('rectus')}
            onClick={() => onPick('rectus')}
            style={{ cursor: 'pointer' }}
          />
          <path d="M-8,85 L8,85 M-8,96 L8,96 M0,75 L0,106" strokeWidth="0.7" fill="none" />
        </>
      )}
      {/* Bassin */}
      <path d={back ? 'M-10,108 L10,108 L11,120 L-11,120 Z' : 'M-10,108 L10,108 L12,125 L-12,125 Z'} fill={NEUTRAL} />
      {side}
      <g transform="scale(-1,1)">{side}</g>
    </g>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: color }} />
      {label}
    </span>
  )
}
