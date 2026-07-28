import { useMemo, useState } from 'react'
import { fmtTonnage, type ExerciseProgress } from '../lib/muscu'
import { normalizeName } from '../components/ExercisePicker'

// Onglet Progression : une courbe de charge et les records par exercice.
// À poids de corps stable, des charges qui montent = du muscle gagné : c'est
// l'indicateur qui dit si la recomposition fonctionne.

function frDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Mini-courbe de la charge dans le temps. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const w = 96
  const h = 26
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / span) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = values[values.length - 1]
  const monte = last > values[0]
  const color = monte ? '#10B981' : last < values[0] ? '#F59E0B' : '#a8a29e'
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={w} cy={pts[pts.length - 1].split(',')[1]} r="2.4" fill={color} />
    </svg>
  )
}

export function ProgressTab({ progress }: { progress: ExerciseProgress[] }) {
  const [query, setQuery] = useState('')
  const [openName, setOpenName] = useState<string | null>(null)

  const shown = useMemo(() => {
    const needle = normalizeName(query.trim())
    if (!needle) return progress
    return progress.filter((p) => normalizeName(p.name).includes(needle))
  }, [progress, query])

  if (progress.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Enregistre quelques séances : la progression de chaque exercice apparaîtra ici.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <input
        className="field"
        type="search"
        placeholder="🔍 Filtrer un exercice…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ul className="space-y-2">
        {shown.map((p) => {
          const charges = p.points.filter((x) => x.weight !== null).map((x) => x.weight as number)
          const premier = charges[0]
          const dernier = charges[charges.length - 1]
          const delta = charges.length >= 2 ? dernier - premier : null
          const recordAujourdhui = p.best && p.best.date === p.lastDate && charges.length >= 2
          const open = openName === p.name

          return (
            <li key={p.name} className="card overflow-hidden">
              <button
                onClick={() => setOpenName(open ? null : p.name)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-ink">{p.name}</span>
                    {recordAujourdhui ? <span title="Record établi à la dernière séance">🏆</span> : null}
                  </div>
                  <div className="text-[11px] text-muted">
                    {p.points.length} séance{p.points.length > 1 ? 's' : ''} · dernière le {frDate(p.lastDate)}
                    {p.best ? ` · record ${p.best.weight} kg` : ''}
                  </div>
                  {delta !== null ? (
                    <div className={`text-[11px] font-semibold ${delta > 0 ? 'text-sage-dark' : delta < 0 ? 'text-clay' : 'text-muted'}`}>
                      {delta > 0 ? '+' : ''}
                      {delta} kg depuis la première séance
                    </div>
                  ) : null}
                </div>
                <Sparkline values={charges} />
              </button>

              {open ? (
                <div className="space-y-2 border-t border-line/60 bg-bg/40 p-3">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl2 bg-white/5 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted">Record de charge</div>
                      <div className="text-lg font-extrabold text-ink">
                        {p.best ? `${p.best.weight} kg` : '—'}
                      </div>
                      <div className="text-[10px] text-muted">{p.best ? frDate(p.best.date) : 'poids du corps'}</div>
                    </div>
                    <div className="rounded-xl2 bg-white/5 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted">Meilleur tonnage</div>
                      <div className="text-lg font-extrabold text-ink">
                        {p.bestTonnage ? fmtTonnage(p.bestTonnage.value) : '—'}
                      </div>
                      <div className="text-[10px] text-muted">
                        {p.bestTonnage ? frDate(p.bestTonnage.date) : 'sur une séance'}
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-1">
                    {[...p.points].reverse().slice(0, 10).map((pt) => (
                      <li key={pt.date} className="flex items-baseline gap-2 text-xs">
                        <span className="w-16 shrink-0 text-muted">{frDate(pt.date)}</span>
                        <span className="text-ink">
                          {pt.sets}×{pt.reps}
                          {pt.weight !== null ? ` @ ${pt.weight} kg` : ''}
                        </span>
                        {pt.weight !== null && p.best && pt.weight === p.best.weight ? (
                          <span title="Record">🏆</span>
                        ) : null}
                        {pt.tonnage > 0 ? (
                          <span className="ml-auto text-muted">{fmtTonnage(pt.tonnage)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {shown.length === 0 ? (
        <p className="text-center text-xs text-muted">Aucun exercice ne correspond.</p>
      ) : null}
    </div>
  )
}
