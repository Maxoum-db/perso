import type { GroupLoad } from '../lib/muscu'

// Mannequin de récupération musculaire : silhouette face + dos, détaillée par
// zone, dont chaque muscle se colore selon l'ancienneté de son dernier travail
// pondérée par l'intensité (un muscle sollicité en secondaire récupère plus
// vite qu'un moteur principal) :
//   0-2 j  → rouge  (en récupération)
//   3-4 j  → orange (bientôt prêt)
//   ≥ 5 j  → vert   (prêt / jamais travaillé)

export type MuscleRegion =
  | 'traps'
  | 'shoulders'
  | 'chest'
  | 'back'
  | 'lowback'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'adductors'
  | 'hamstrings'
  | 'calves'

const RED = '#EF4444'
const ORANGE = '#F59E0B'
const GREEN = '#10B981'
const NEUTRAL = '#D1D5DB'

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
}

// Premier mot-clé trouvé gagne : « abdos » est testé avant « dos », sinon
// « Abdos/Core » serait pris pour du dos.
const REGION_KEYWORDS: Array<[MuscleRegion, string[]]> = [
  ['abs', ['abdo', 'core', 'gainage', 'transverse', 'ceinture']],
  ['obliques', ['oblique']],
  ['traps', ['trapez']],
  ['lowback', ['lombaire']],
  ['shoulders', ['epaule', 'deltoid']],
  ['chest', ['pector', 'pecs', 'poitrine']],
  ['back', ['dos', 'dorsaux']],
  ['biceps', ['biceps']],
  ['triceps', ['triceps']],
  ['forearms', ['avant-bras', 'avant bras', 'grip']],
  ['glutes', ['fessier', 'glute']],
  ['quads', ['quadriceps', 'quad', 'cuisse']],
  ['adductors', ['adducteur']],
  ['hamstrings', ['ischio']],
  ['calves', ['mollet']],
]

const ALL_REGIONS: MuscleRegion[] = REGION_KEYWORDS.map(([r]) => r)
// Groupes « parapluie » : une activité sollicite tout un bloc.
const LEGS: MuscleRegion[] = ['quads', 'hamstrings', 'calves', 'glutes', 'adductors']
const UPPER: MuscleRegion[] = ['back', 'shoulders', 'chest', 'biceps', 'triceps', 'traps']

/** Les zones du corps couvertes par un libellé de groupe musculaire. */
export function regionsForGroup(label: string): MuscleRegion[] {
  const n = norm(label)
  if (!n) return []
  if (n.includes('full body') || n.includes('full-body') || n.includes('corps entier')) return ALL_REGIONS
  if (n.includes('jambes')) return LEGS
  if (n.includes('haut du corps')) return UPPER
  // « Abdos/Core » couvre aussi les obliques.
  if (n.includes('abdo') || n.includes('core')) return ['abs', 'obliques']
  for (const [region, keywords] of REGION_KEYWORDS) {
    if (keywords.some((k) => n.includes(k))) return [region]
  }
  return [] // ex. « Cardio » : aucune zone dédiée
}

export function MuscleBodyDiagram({ loads }: { loads: Record<string, GroupLoad> }) {
  // Chaque zone prend la sollicitation la plus fraîche parmi les groupes qui la couvrent.
  const byRegion: Partial<Record<MuscleRegion, number>> = {}
  for (const [group, load] of Object.entries(loads)) {
    for (const region of regionsForGroup(group)) {
      const cur = byRegion[region]
      if (cur === undefined || load.effectiveDays < cur) byRegion[region] = load.effectiveDays
    }
  }

  const fill = (r: MuscleRegion) => recoveryColor(byRegion[r])
  const S = { stroke: '#ffffff', strokeWidth: 1.2, strokeLinejoin: 'round' as const }

  const tracked = Object.entries(loads).sort((a, b) => a[1].effectiveDays - b[1].effectiveDays)

  return (
    <div className="space-y-2">
      <svg viewBox="0 0 300 250" className="mx-auto w-full max-w-sm" aria-label="Récupération musculaire">
        {/* ── Face ── */}
        <FrontFigure cx={75} fill={fill} S={S} />
        {/* ── Dos ── */}
        <BackFigure cx={225} fill={fill} S={S} />
        <text x="75" y="246" textAnchor="middle" fill="#a8a29e" fontSize="9">
          Face
        </text>
        <text x="225" y="246" textAnchor="middle" fill="#a8a29e" fontSize="9">
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
              <span
                key={group}
                className="chip flex items-center gap-1 text-[10px]"
                style={{ background: color + '22', color }}
                title={
                  load.intensity >= 1
                    ? 'Sollicité comme moteur principal'
                    : `Sollicité en secondaire (${Math.round(load.intensity * 100)} %) : récupère plus vite`
                }
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                {group}
                {load.intensity < 1 ? ' ◐' : ''} ·{' '}
                {load.days === 0 ? "aujourd'hui" : load.days === 1 ? 'hier' : `il y a ${load.days} j`}
              </span>
            )
          })}
        </div>
      ) : (
        <p className="text-center text-[11px] text-muted">
          Enregistre des séances avec un groupe visé : le mannequin se colorera tout seul.
        </p>
      )}
    </div>
  )
}

type FillFn = (r: MuscleRegion) => string
type StrokeProps = { stroke: string; strokeWidth: number; strokeLinejoin: 'round' }

function FrontFigure({ cx, fill, S }: { cx: number; fill: FillFn; S: StrokeProps }) {
  return (
    <g>
      {/* Tête, cou, mains, pieds : non suivis */}
      <circle cx={cx} cy="18" r="11" fill={NEUTRAL} {...S} />
      <rect x={cx - 6} y="27" width="12" height="9" rx="3" fill={NEUTRAL} {...S} />

      {/* Trapèzes (faisceaux supérieurs, du cou vers l'épaule) */}
      <path d={`M${cx - 5},32 L${cx - 21},45 L${cx - 11},47 L${cx - 5},41 Z`} fill={fill('traps')} {...S} />
      <path d={`M${cx + 5},32 L${cx + 21},45 L${cx + 11},47 L${cx + 5},41 Z`} fill={fill('traps')} {...S} />

      {/* Deltoïdes antérieurs (dessinés avant les pectoraux, qui passent dessus) */}
      <ellipse cx={cx - 27} cy="55" rx="10" ry="10" fill={fill('shoulders')} {...S} />
      <ellipse cx={cx + 27} cy="55" rx="10" ry="10" fill={fill('shoulders')} {...S} />

      {/* Pectoraux */}
      <rect x={cx - 19} y="46" width="17" height="26" rx="6" fill={fill('chest')} {...S} />
      <rect x={cx + 2} y="46" width="17" height="26" rx="6" fill={fill('chest')} {...S} />

      {/* Abdominaux + obliques */}
      <rect x={cx - 10} y="73" width="20" height="35" rx="4" fill={fill('abs')} {...S} />
      <path d={`M${cx - 19},74 q7,15 5,29 l-7,-3 q-3,-13 -2,-26 Z`} fill={fill('obliques')} {...S} />
      <path d={`M${cx + 19},74 q-7,15 -5,29 l7,-3 q3,-13 2,-26 Z`} fill={fill('obliques')} {...S} />

      {/* Biceps + avant-bras */}
      <ellipse cx={cx - 31} cy="78" rx="8" ry="15" fill={fill('biceps')} {...S} />
      <ellipse cx={cx + 31} cy="78" rx="8" ry="15" fill={fill('biceps')} {...S} />
      <ellipse cx={cx - 34} cy="110" rx="7" ry="15" fill={fill('forearms')} {...S} />
      <ellipse cx={cx + 34} cy="110" rx="7" ry="15" fill={fill('forearms')} {...S} />
      <circle cx={cx - 35} cy="130" r="5" fill={NEUTRAL} {...S} />
      <circle cx={cx + 35} cy="130" r="5" fill={NEUTRAL} {...S} />

      {/* Bassin (neutre de face) */}
      <rect x={cx - 15} y="108" width="30" height="17" rx="6" fill={NEUTRAL} {...S} />

      {/* Quadriceps + adducteurs */}
      <rect x={cx - 18} y="125" width="11" height="48" rx="5" fill={fill('quads')} {...S} />
      <rect x={cx + 7} y="125" width="11" height="48" rx="5" fill={fill('quads')} {...S} />
      <rect x={cx - 6} y="128" width="5" height="38" rx="2" fill={fill('adductors')} {...S} />
      <rect x={cx + 1} y="128" width="5" height="38" rx="2" fill={fill('adductors')} {...S} />

      {/* Jambiers (mollets vus de face) */}
      <rect x={cx - 17} y="178" width="11" height="32" rx="5" fill={fill('calves')} {...S} />
      <rect x={cx + 6} y="178" width="11" height="32" rx="5" fill={fill('calves')} {...S} />

      {/* Pieds */}
      <rect x={cx - 18} y="212" width="13" height="8" rx="3" fill={NEUTRAL} {...S} />
      <rect x={cx + 5} y="212" width="13" height="8" rx="3" fill={NEUTRAL} {...S} />
    </g>
  )
}

function BackFigure({ cx, fill, S }: { cx: number; fill: FillFn; S: StrokeProps }) {
  return (
    <g>
      <circle cx={cx} cy="18" r="11" fill={NEUTRAL} {...S} />
      <rect x={cx - 6} y="27" width="12" height="9" rx="3" fill={NEUTRAL} {...S} />

      {/* Deltoïdes postérieurs (dessous, comme de face) */}
      <ellipse cx={cx - 27} cy="55" rx="10" ry="10" fill={fill('shoulders')} {...S} />
      <ellipse cx={cx + 27} cy="55" rx="10" ry="10" fill={fill('shoulders')} {...S} />

      {/* Trapèzes (cerf-volant du haut du dos) */}
      <path d={`M${cx - 6},32 L${cx - 21},46 L${cx - 15},66 L${cx},60 L${cx + 15},66 L${cx + 21},46 L${cx + 6},32 Z`} fill={fill('traps')} {...S} />

      {/* Grands dorsaux (V) */}
      <path d={`M${cx - 20},64 L${cx + 20},64 L${cx + 11},101 L${cx - 11},101 Z`} fill={fill('back')} {...S} />

      {/* Lombaires */}
      <rect x={cx - 11} y="101" width="22" height="15" rx="4" fill={fill('lowback')} {...S} />

      {/* Triceps + avant-bras */}
      <ellipse cx={cx - 31} cy="78" rx="8" ry="15" fill={fill('triceps')} {...S} />
      <ellipse cx={cx + 31} cy="78" rx="8" ry="15" fill={fill('triceps')} {...S} />
      <ellipse cx={cx - 34} cy="110" rx="7" ry="15" fill={fill('forearms')} {...S} />
      <ellipse cx={cx + 34} cy="110" rx="7" ry="15" fill={fill('forearms')} {...S} />
      <circle cx={cx - 35} cy="130" r="5" fill={NEUTRAL} {...S} />
      <circle cx={cx + 35} cy="130" r="5" fill={NEUTRAL} {...S} />

      {/* Fessiers */}
      <rect x={cx - 17} y="116" width="15" height="22" rx="7" fill={fill('glutes')} {...S} />
      <rect x={cx + 2} y="116" width="15" height="22" rx="7" fill={fill('glutes')} {...S} />

      {/* Ischio-jambiers */}
      <rect x={cx - 17} y="140" width="13" height="38" rx="6" fill={fill('hamstrings')} {...S} />
      <rect x={cx + 4} y="140" width="13" height="38" rx="6" fill={fill('hamstrings')} {...S} />

      {/* Mollets (jumeaux) */}
      <rect x={cx - 17} y="180" width="12" height="32" rx="6" fill={fill('calves')} {...S} />
      <rect x={cx + 5} y="180" width="12" height="32" rx="6" fill={fill('calves')} {...S} />

      <rect x={cx - 18} y="212" width="13" height="8" rx="3" fill={NEUTRAL} {...S} />
      <rect x={cx + 5} y="212" width="13" height="8" rx="3" fill={NEUTRAL} {...S} />
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
