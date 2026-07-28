import type { GroupLoad } from '../lib/muscu'

// Mannequin de récupération musculaire, façon planche anatomique : silhouette
// face + dos découpée muscle par muscle. Chaque zone se colore selon
// l'ancienneté de son dernier travail pondérée par l'intensité (un muscle
// sollicité en secondaire récupère plus vite qu'un moteur principal) :
//   0-2 j  → rouge  (en récupération)
//   3-4 j  → orange (bientôt prêt)
//   ≥ 5 j  → vert   (prêt / jamais travaillé)
//
// Les tracés sont exprimés dans un repère centré (x = 0 au milieu du corps) :
// on ne dessine qu'une moitié, l'autre est obtenue par symétrie (scale(-1,1)),
// ce qui garantit un corps parfaitement symétrique.

export type MuscleRegion =
  | 'neck'
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
}

// Premier mot-clé trouvé gagne : « abdos » est testé avant « dos », sinon
// « Abdos/Core » serait pris pour du dos.
const REGION_KEYWORDS: Array<[MuscleRegion, string[]]> = [
  ['obliques', ['oblique']],
  ['abs', ['abdo', 'core', 'gainage', 'transverse', 'ceinture']],
  ['neck', ['cou', 'cervical', 'nuque']],
  ['traps', ['trapez']],
  ['lowback', ['lombaire', 'erecteur']],
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
  // « Abdos/Core » couvre le grand droit ET les obliques.
  if (n.includes('abdo') || n.includes('core')) return ['abs', 'obliques']
  for (const [region, keywords] of REGION_KEYWORDS) {
    if (keywords.some((k) => n.includes(k))) return [region]
  }
  return [] // ex. « Cardio » : aucune zone dédiée
}

// ── Tracés (repère centré, moitié gauche du corps) ──────────────────────────

// Silhouette de base dessinée SOUS les muscles : sans elle, le fond apparaît
// entre les tracés et le corps semble fragmenté.
const BASE_CENTER =
  'M-25,44 C-27,62 -22,92 -19,109 L19,109 C22,92 27,62 25,44 C22,37 12,32 6,30 L-6,30 C-12,32 -22,37 -25,44 Z'
const BASE_HALF: string[] = [
  // bras : de l'épaule à la main
  'M-24,44 C-34,48 -40,62 -37,78 C-35,95 -41,112 -39,129 C-38,137 -31,139 -30,130 C-28,112 -30,96 -28,80 C-26,64 -20,52 -19,46 Z',
  // jambe : de la hanche au pied
  'M-20,106 C-24,128 -22,160 -18,182 C-17,197 -18,209 -17,217 L-4,217 C-3,200 -4,186 -4,176 C-4,150 -2,128 0,107 Z',
]

const FRONT_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  ['traps', 'M-7,31 C-13,33 -19,39 -24,46 L-14,49 C-11,42 -8,36 -7,31 Z'],
  ['shoulders', 'M-26,47 C-35,50 -38,61 -35,71 C-28,72 -24,65 -23,56 Z'],
  ['chest', 'M-21,51 C-13,48 -4,49 -2,53 L-2,70 C-9,75 -18,72 -22,65 C-24,60 -23,55 -21,51 Z'],
  ['obliques', 'M-16,74 C-13,85 -11,96 -10,105 L-16,101 C-18,92 -18,82 -16,74 Z'],
  ['biceps', 'M-32,72 C-38,78 -38,90 -34,97 C-29,95 -28,81 -29,73 Z'],
  ['forearms', 'M-35,98 C-40,106 -41,118 -38,127 L-31,125 C-30,114 -30,104 -32,99 Z'],
  ['neutral', 'M-36,128 C-40,131 -40,138 -36,140 C-32,138 -32,131 -36,128 Z'], // main
  ['quads', 'M-19,126 C-22,142 -21,160 -17,174 L-6,174 C-5,156 -6,138 -8,128 Z'],
  ['adductors', 'M-5,129 C-7,141 -7,153 -6,162 L-1,162 L-1,129 Z'],
  ['neutral', 'M-18,175 C-14,179 -7,179 -4,175 L-4,181 C-8,184 -14,184 -18,181 Z'], // genou
  ['calves', 'M-16,182 C-18,193 -17,205 -14,212 L-5,212 C-4,200 -5,190 -8,182 Z'],
  ['neutral', 'M-17,214 L-3,214 L-3,222 L-19,222 Z'], // pied
]

const BACK_HALF: Array<[MuscleRegion | 'neutral', string]> = [
  ['traps', 'M0,32 L-7,32 C-15,35 -21,41 -26,47 L-13,66 L0,59 Z'],
  ['shoulders', 'M-26,47 C-35,50 -38,61 -35,71 C-28,72 -24,65 -23,56 Z'],
  ['back', 'M-24,60 C-26,73 -22,89 -12,101 L0,101 L0,62 Z'],
  ['triceps', 'M-32,72 C-38,78 -38,90 -34,97 C-29,95 -28,81 -29,73 Z'],
  ['forearms', 'M-35,98 C-40,106 -41,118 -38,127 L-31,125 C-30,114 -30,104 -32,99 Z'],
  ['neutral', 'M-36,128 C-40,131 -40,138 -36,140 C-32,138 -32,131 -36,128 Z'], // main
  ['glutes', 'M-18,118 C-21,125 -20,135 -14,140 C-6,141 -2,134 -2,126 L-2,118 Z'],
  ['hamstrings', 'M-17,142 C-19,156 -18,169 -15,178 L-5,178 C-4,164 -5,150 -7,143 Z'],
  ['neutral', 'M-18,179 C-14,183 -7,183 -4,179 L-4,184 C-8,187 -14,187 -18,184 Z'], // genou
  ['calves', 'M-16,185 C-19,194 -18,206 -14,212 L-5,212 C-4,201 -6,191 -8,185 Z'],
  ['neutral', 'M-17,214 L-3,214 L-3,222 L-19,222 Z'], // pied
]

export function MuscleBodyDiagram({ loads }: { loads: Record<string, GroupLoad> }) {
  // Chaque zone prend la sollicitation la plus fraîche parmi les groupes qui la couvrent.
  const byRegion: Partial<Record<MuscleRegion, number>> = {}
  for (const [group, load] of Object.entries(loads)) {
    for (const region of regionsForGroup(group)) {
      const cur = byRegion[region]
      if (cur === undefined || load.effectiveDays < cur) byRegion[region] = load.effectiveDays
    }
  }

  const fill = (r: MuscleRegion | 'neutral') => (r === 'neutral' ? NEUTRAL : recoveryColor(byRegion[r]))
  const tracked = Object.entries(loads).sort((a, b) => a[1].effectiveDays - b[1].effectiveDays)

  return (
    <div className="space-y-2">
      <svg
        viewBox="0 0 300 240"
        className="mx-auto w-full max-w-sm"
        stroke="#ffffff"
        strokeWidth="1.1"
        strokeLinejoin="round"
        aria-label="Récupération musculaire"
      >
        <Figure cx={75} half={FRONT_HALF} fill={fill} back={false} />
        <Figure cx={225} half={BACK_HALF} fill={fill} back />
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

function Figure({
  cx,
  half,
  fill,
  back,
}: {
  cx: number
  half: Array<[MuscleRegion | 'neutral', string]>
  fill: (r: MuscleRegion | 'neutral') => string
  back: boolean
}) {
  const side = half.map(([region, d], i) => <path key={i} d={d} fill={fill(region)} />)
  const base = BASE_HALF.map((d, i) => <path key={i} d={d} fill={NEUTRAL} stroke="none" />)
  return (
    <g transform={`translate(${cx},0)`}>
      {/* Silhouette de base, puis les muscles par-dessus */}
      <path d={BASE_CENTER} fill={NEUTRAL} stroke="none" />
      {base}
      <g transform="scale(-1,1)">{base}</g>
      {/* Axe médian : tête, cou, tronc central */}
      <ellipse cx="0" cy="16" rx="10" ry="12" fill={NEUTRAL} />
      <path d="M-6,25 L6,25 L7,36 L-7,36 Z" fill={fill('neck')} />
      {back ? (
        <path d="M-8,101 L8,101 L6,119 L-6,119 Z" fill={fill('lowback')} />
      ) : (
        <>
          <path d="M-9,73 L9,73 L8,107 C4,111 -4,111 -8,107 Z" fill={fill('abs')} />
          {/* Segments du grand droit */}
          <path d="M-8,84 L8,84 M-8,95 L8,95 M0,74 L0,106" strokeWidth="0.8" fill="none" />
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
