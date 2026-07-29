import { bilanCalories, sessionCalories } from '../lib/calories'
import { INTENSITES } from '../lib/intensite'
import type { MuscuSession } from '../lib/muscu'

// Dépense des séances sur 7 jours. L'intérêt n'est pas le chiffre absolu —
// c'est une estimation — mais la comparaison d'une semaine à l'autre.

const JOURS_COURTS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

function jourLettre(date: string): string {
  return JOURS_COURTS[new Date(date + 'T00:00:00').getDay()]
}

function frJour(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
}

export function CaloriesCard({
  sessions,
  bodyWeight,
}: {
  sessions: MuscuSession[]
  bodyWeight: number | null
}) {
  const bilan = bilanCalories(sessions, bodyWeight, 7)
  const delta = bilan.totalPrecedent > 0 ? bilan.total - bilan.totalPrecedent : null
  const aujourdhui = new Date().toLocaleDateString('en-CA')

  // Les séances de la fenêtre, de la plus récente à la plus ancienne.
  const recentes = sessions
    .filter((s) => s.date >= bilan.jours[0].date && s.date <= aujourdhui)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-extrabold text-ink">🔥 Calories brûlées</h2>

      <div className="mb-3 flex items-end gap-4">
        <div>
          <div className="text-3xl font-extrabold text-ink">
            {bilan.total.toLocaleString('fr-FR')} <span className="text-lg font-bold text-muted">kcal</span>
          </div>
          <div className="text-xs text-muted">
            sur 7 jours · {bilan.moyenne.toLocaleString('fr-FR')} kcal/jour en moyenne
          </div>
          {delta !== null ? (
            <div className={`text-xs font-semibold ${delta >= 0 ? 'text-sage-dark' : 'text-clay'}`}>
              {delta > 0 ? '+' : ''}
              {delta.toLocaleString('fr-FR')} kcal vs les 7 jours précédents
            </div>
          ) : null}
        </div>
      </div>

      {/* Histogramme 7 jours */}
      <div className="flex items-end justify-between gap-1.5" style={{ height: 84 }}>
        {bilan.jours.map((j) => {
          const h = Math.round((j.kcal / bilan.max) * 64)
          const estAujourdhui = j.date === aujourdhui
          return (
            <div key={j.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${frJour(j.date)} — ${j.kcal} kcal${j.seances.length ? ` (${j.seances.join(', ')})` : ''}`}>
              <span className="text-[9px] font-semibold text-muted">{j.kcal > 0 ? j.kcal : ''}</span>
              <div
                className="w-full rounded-t"
                style={{
                  height: Math.max(2, h),
                  background: j.kcal > 0 ? (estAujourdhui ? 'rgb(var(--copper))' : 'rgb(var(--copper) / .45)') : 'rgb(var(--line))',
                }}
              />
              <span className={`text-[10px] ${estAujourdhui ? 'font-bold text-copper' : 'text-muted'}`}>
                {jourLettre(j.date)}
              </span>
            </div>
          )
        })}
      </div>

      {recentes.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-line/60 pt-2">
          {recentes.slice(0, 6).map((s) => {
            const c = sessionCalories(s, bodyWeight)
            return (
              <li key={s.id} className="flex items-baseline gap-2 text-xs">
                <span className="w-20 shrink-0 text-muted">{frJour(s.date)}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{s.name}</span>
                <span className="shrink-0 text-[10px] text-muted">
                  {c.minutes} min{c.dureeEstimee ? '*' : ''} · MET {c.met}
                  {c.declaree && s.intensite ? (
                    // Déclaré à la main : on le dit, sinon on ne sait plus d'où
                    // vient le coefficient en relisant le journal trois mois après.
                    <span
                      className={`ml-1 font-bold ${c.densite.coef > 1 ? 'text-sage-dark' : 'text-clay'}`}
                      title={`Intensité déclarée : ${INTENSITES[s.intensite].label.toLowerCase()}`}
                    >
                      {INTENSITES[s.intensite].emoji} ×{c.densite.coef}
                    </span>
                  ) : c.densite.applique && c.densite.coef !== 1 ? (
                    <span
                      className={`ml-1 font-bold ${c.densite.coef > 1 ? 'text-sage-dark' : 'text-clay'}`}
                      title={`Densité : ${c.densite.seriesParMin?.toFixed(2)} série/min${
                        c.densite.tonnageParMin ? `, ${c.densite.tonnageParMin.toFixed(2)} poids de corps/min` : ''
                      }`}
                    >
                      ×{c.densite.coef}
                    </span>
                  ) : null}
                </span>
                <span className="w-14 shrink-0 text-right font-semibold text-copper">{c.kcal} kcal</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 text-center text-[11px] text-muted">Aucune séance sur les 7 derniers jours.</p>
      )}

      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        Estimation MET × densité × poids de corps × durée
        {bodyWeight ? ` (${bodyWeight} kg)` : ' (poids de corps non renseigné : 75 kg par défaut)'}. La densité
        compare tonnage et séries au temps passé : une heure enchaînée compte jusqu'à 35 % de plus qu'une heure
        traînante. Elle ne s'applique que si tu as saisi la durée — sinon elle serait déduite des séries, donc
        toujours identique. Compte ±15 % sans capteur cardiaque ; une durée suivie de <b>*</b> a été estimée.
      </p>
    </section>
  )
}
