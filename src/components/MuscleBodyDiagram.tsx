// Mannequin de récupération musculaire : silhouette face + dos dont chaque
// zone se colore selon l'ancienneté du dernier travail du groupe.
//   0-2 j  → rouge  (en récupération, à éviter)
//   3-4 j  → orange (bientôt prêt)
//   ≥ 5 j  → vert   (prêt / jamais travaillé)

export type MuscleRegion =
  | 'shoulders'
  | 'chest'
  | 'back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'

const RED = '#EF4444'
const ORANGE = '#F59E0B'
const GREEN = '#10B981'
const NEUTRAL = '#D1D5DB'

/** Seuils demandés : rouge jusqu'à 2 j, orange à 3-4 j, vert à partir de 5 j. */
export function recoveryColor(days: number | undefined): string {
  if (days === undefined) return GREEN
  if (days <= 2) return RED
  if (days <= 4) return ORANGE
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
  ['abs', ['abdo', 'core', 'gainage', 'transverse', 'oblique', 'ceinture']],
  ['shoulders', ['epaule', 'deltoid']],
  ['chest', ['pector', 'pecs', 'poitrine']],
  ['back', ['dos', 'dorsaux', 'trapez', 'lombaire']],
  ['biceps', ['biceps']],
  ['triceps', ['triceps']],
  ['forearms', ['avant-bras', 'avant bras', 'grip']],
  ['glutes', ['fessier', 'glute']],
  ['quads', ['quadriceps', 'quad', 'cuisse']],
  ['hamstrings', ['ischio']],
  ['calves', ['mollet']],
]

const ALL_REGIONS: MuscleRegion[] = REGION_KEYWORDS.map(([r]) => r)

// Groupes « parapluie » : une activité (course, natation…) sollicite tout un
// bloc, on colore donc plusieurs zones à la fois.
const LEGS: MuscleRegion[] = ['quads', 'hamstrings', 'calves', 'glutes']
const UPPER: MuscleRegion[] = ['back', 'shoulders', 'chest', 'biceps', 'triceps']

/** Les zones du corps couvertes par un libellé de groupe musculaire. */
export function regionsForGroup(label: string): MuscleRegion[] {
  const n = norm(label)
  if (!n) return []
  if (n.includes('full body') || n.includes('full-body') || n.includes('corps entier')) return ALL_REGIONS
  if (n.includes('jambes')) return LEGS
  if (n.includes('haut du corps')) return UPPER
  for (const [region, keywords] of REGION_KEYWORDS) {
    if (keywords.some((k) => n.includes(k))) return [region]
  }
  return [] // ex. « Cardio » : aucune zone dédiée
}

export function MuscleBodyDiagram({ daysByGroup }: { daysByGroup: Record<string, number> }) {
  // Chaque zone prend le délai le plus court parmi les groupes qui la couvrent.
  const daysByRegion: Partial<Record<MuscleRegion, number>> = {}
  for (const [group, days] of Object.entries(daysByGroup)) {
    for (const region of regionsForGroup(group)) {
      const cur = daysByRegion[region]
      if (cur === undefined || days < cur) daysByRegion[region] = days
    }
  }

  const fill = (r: MuscleRegion) => recoveryColor(daysByRegion[r])
  const stroke = { stroke: '#ffffff', strokeWidth: 1.5 }

  // Groupes sans zone dédiée (Cardio, groupes perso) : affichés en pastilles.
  const extras = Object.entries(daysByGroup)
    .filter(([g]) => regionsForGroup(g).length === 0)
    .sort((a, b) => a[1] - b[1])

  const tracked = Object.entries(daysByGroup).sort((a, b) => a[1] - b[1])

  return (
    <div className="space-y-2">
      <svg viewBox="0 0 280 236" className="mx-auto w-full max-w-sm" aria-label="Récupération musculaire">
        {[
          { cx: 70, back: false, label: 'Face' },
          { cx: 210, back: true, label: 'Dos' },
        ].map(({ cx, back, label }) => (
          <g key={label}>
            {/* Tête / cou / mains / pieds : non suivis */}
            <circle cx={cx} cy="20" r="12" fill={NEUTRAL} {...stroke} />
            <rect x={cx - 5} y="31" width="10" height="10" rx="3" fill={NEUTRAL} {...stroke} />

            {/* Torse : pectoraux (face) / dos (dos) */}
            <rect
              x={cx - 19}
              y="42"
              width="38"
              height={back ? 60 : 32}
              rx="8"
              fill={fill(back ? 'back' : 'chest')}
              {...stroke}
            />
            {/* Épaules : par-dessus le torse, comme des capuchons deltoïdiens */}
            <ellipse cx={cx - 22} cy="50" rx="12" ry="9" fill={fill('shoulders')} {...stroke} />
            <ellipse cx={cx + 22} cy="50" rx="12" ry="9" fill={fill('shoulders')} {...stroke} />

            {/* Abdos : uniquement de face */}
            {!back ? (
              <rect x={cx - 14} y="76" width="28" height="28" rx="6" fill={fill('abs')} {...stroke} />
            ) : null}

            {/* Bras : biceps de face, triceps de dos */}
            <ellipse cx={cx - 31} cy="76" rx="8" ry="16" fill={fill(back ? 'triceps' : 'biceps')} {...stroke} />
            <ellipse cx={cx + 31} cy="76" rx="8" ry="16" fill={fill(back ? 'triceps' : 'biceps')} {...stroke} />
            {/* Avant-bras */}
            <ellipse cx={cx - 34} cy="110" rx="7" ry="15" fill={fill('forearms')} {...stroke} />
            <ellipse cx={cx + 34} cy="110" rx="7" ry="15" fill={fill('forearms')} {...stroke} />
            <circle cx={cx - 35} cy="130" r="5" fill={NEUTRAL} {...stroke} />
            <circle cx={cx + 35} cy="130" r="5" fill={NEUTRAL} {...stroke} />

            {/* Bassin : fessiers de dos, hanches neutres de face */}
            <rect
              x={cx - 17}
              y="104"
              width="34"
              height="22"
              rx="8"
              fill={back ? fill('glutes') : NEUTRAL}
              {...stroke}
            />

            {/* Cuisses : quadriceps de face, ischios de dos */}
            <rect x={cx - 17} y="126" width="15" height="48" rx="7" fill={fill(back ? 'hamstrings' : 'quads')} {...stroke} />
            <rect x={cx + 2} y="126" width="15" height="48" rx="7" fill={fill(back ? 'hamstrings' : 'quads')} {...stroke} />

            {/* Mollets */}
            <rect x={cx - 16} y="178" width="13" height="34" rx="6" fill={fill('calves')} {...stroke} />
            <rect x={cx + 3} y="178" width="13" height="34" rx="6" fill={fill('calves')} {...stroke} />

            {/* Pieds */}
            <rect x={cx - 18} y="214" width="16" height="9" rx="3" fill={NEUTRAL} {...stroke} />
            <rect x={cx + 2} y="214" width="16" height="9" rx="3" fill={NEUTRAL} {...stroke} />

            <text x={cx} y="234" textAnchor="middle" className="fill-current text-[9px] text-muted">
              {label}
            </text>
          </g>
        ))}
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <Legend color={RED} label="0-2 j — en récup" />
        <Legend color={ORANGE} label="3-4 j — bientôt prêt" />
        <Legend color={GREEN} label="≥ 5 j — prêt" />
      </div>

      {tracked.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tracked.map(([group, days]) => (
            <span
              key={group}
              className="chip flex items-center gap-1 text-[10px]"
              style={{ background: recoveryColor(days) + '22', color: recoveryColor(days) }}
              title={extras.some(([g]) => g === group) ? 'Pas de zone dédiée sur le schéma' : undefined}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: recoveryColor(days) }} />
              {group} · {days === 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} j`}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-center text-[11px] text-muted">
          Enregistre des séances avec un groupe visé : le mannequin se colorera tout seul.
        </p>
      )}
    </div>
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
