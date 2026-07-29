import { moyenneGlissante, tendancePoids } from '../lib/profil'
import type { Weighin } from '../lib/workouts'

// Courbe de poids sur 90 jours avec sa moyenne glissante 7 jours.
//
// Le poids brut varie de ±1,5 kg d'un jour à l'autre — eau, sel, digestion. Sur
// une recomposition lente, ce bruit masque complètement la tendance : c'est la
// moyenne lissée qu'il faut lire, pas les points.

export function PoidsCourbe({ weighins, jours = 90 }: { weighins: Weighin[]; jours?: number }) {
  const limite = new Date()
  limite.setHours(0, 0, 0, 0)
  limite.setDate(limite.getDate() - jours)
  const limiteStr = limite.toLocaleDateString('en-CA')

  const points = [...weighins]
    .filter((w) => w.date >= limiteStr)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (points.length < 2) {
    return (
      <section className="card p-4">
        <h2 className="mb-1 text-sm font-extrabold text-ink">📈 Tendance du poids</h2>
        <p className="text-[11px] text-muted">
          Il faut au moins deux pesées pour tracer une courbe. Pèse-toi le matin à jeun, même conditions à chaque
          fois.
        </p>
      </section>
    )
  }

  const lisse = moyenneGlissante(points, 7)
  const pente = tendancePoids(weighins, 28)

  const jour = (d: string) => Date.parse(d + 'T00:00:00') / 86400000
  const x0 = jour(points[0].date)
  const x1 = jour(points[points.length - 1].date)
  const span = Math.max(1, x1 - x0)
  const toutes = [...points.map((p) => p.weight_kg), ...lisse.map((p) => p.value)]
  const min = Math.min(...toutes)
  const max = Math.max(...toutes)
  const amplitude = Math.max(0.8, max - min)

  const W = 300
  const H = 110
  const px = (d: string) => ((jour(d) - x0) / span) * (W - 8) + 4
  const py = (v: number) => H - 12 - ((v - min) / amplitude) * (H - 26)

  const brut = points.map((p) => `${px(p.date).toFixed(1)},${py(p.weight_kg).toFixed(1)}`).join(' ')
  const moyenne = lisse.map((p) => `${px(p.date).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ')
  const dernier = lisse[lisse.length - 1]

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-extrabold text-ink">📈 Tendance du poids</h2>
        <span className="text-[11px] text-muted">{points.length} pesées · {jours} j</span>
      </div>

      <div className="mb-2 flex items-end gap-4">
        <div>
          <div className="text-2xl font-extrabold text-ink">
            {dernier.value.toFixed(1)} <span className="text-sm font-bold text-muted">kg lissés</span>
          </div>
          {pente !== null ? (
            <div
              className={`text-xs font-semibold ${
                Math.abs(pente) < 0.15 ? 'text-muted' : pente < 0 ? 'text-sage-dark' : 'text-clay'
              }`}
            >
              {pente > 0 ? '+' : ''}
              {pente.toFixed(2)} kg/semaine
              {Math.abs(pente) < 0.15 ? ' — stable' : ''}
            </div>
          ) : null}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Courbe de poids">
        <polyline points={brut} fill="none" stroke="rgb(var(--muted))" strokeWidth="1" strokeOpacity="0.45" />
        {points.map((p) => (
          <circle key={p.date} cx={px(p.date)} cy={py(p.weight_kg)} r="1.6" fill="rgb(var(--muted))" opacity="0.5" />
        ))}
        <polyline points={moyenne} fill="none" stroke="rgb(var(--copper))" strokeWidth="2.2" strokeLinejoin="round" />
        <text x="2" y="9" fill="rgb(var(--muted))" fontSize="8">
          {max.toFixed(1)} kg
        </text>
        <text x="2" y={H - 2} fill="rgb(var(--muted))" fontSize="8">
          {min.toFixed(1)} kg
        </text>
      </svg>

      <div className="mt-1 flex justify-center gap-4 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: 'rgb(var(--muted))' }} /> pesées brutes
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: 'rgb(var(--copper))' }} /> moyenne 7 j
        </span>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        Lis la ligne cuivre, pas les points : le poids brut varie de ±1,5 kg selon l'eau, le sel et la digestion.
      </p>
    </section>
  )
}
