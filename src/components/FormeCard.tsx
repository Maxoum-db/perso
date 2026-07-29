import type { Forme } from '../lib/forme'

// Carte d'état de forme : la même dans l'onglet Poids et au-dessus de la séance
// générée. C'est le point de jonction entre ce que dit la balance et ce que
// propose la séance.

export function FormeCard({ forme, compact = false }: { forme: Forme; compact?: boolean }) {
  return (
    <section
      className={compact ? 'rounded-xl2 border p-2.5' : 'card border p-4'}
      style={{ borderColor: forme.couleur + '66', background: forme.couleur + '10' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={`font-extrabold ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: forme.couleur }}>
          🩺 {forme.label}
        </h2>
        <span className="shrink-0 text-[10px] text-muted">
          {forme.exos} exos{forme.intensite < 1 ? ` · −${Math.round((1 - forme.intensite) * 100)} %` : ''}
        </span>
      </div>

      <ul className="mt-1.5 space-y-1">
        {forme.raisons.map((r, i) => (
          <li key={i} className="text-[11px] leading-relaxed text-ink">
            • {r}
          </li>
        ))}
      </ul>

      {!compact ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-line/40 pt-2 text-[10px] text-muted">
          <span>
            Charge {forme.charge.aigue.toLocaleString('fr-FR')} MET·min
            {forme.charge.ratio !== null ? ` · ${forme.charge.ratio.toFixed(2)}×` : ''}
          </span>
          {forme.pente !== null ? (
            <span>
              Poids {forme.pente > 0 ? '+' : ''}
              {forme.pente.toFixed(2)} kg/sem
            </span>
          ) : null}
          {forme.balanceKcal !== null ? (
            <span>
              {forme.balanceKcal < 0 ? 'Déficit' : forme.balanceKcal > 0 ? 'Surplus' : 'Équilibre'} ~
              {Math.abs(forme.balanceKcal)} kcal/j
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
