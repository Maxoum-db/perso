import { useState } from 'react'
import { ratioTailleHauteur, upsert, type Mensuration } from '../lib/mensurations'

// Tour de taille : le seul relevé simple qui distingue « je stagne » de « ça
// marche » quand le poids ne bouge pas — ce qui est précisément le but d'une
// recomposition.

const today = () => new Date().toLocaleDateString('en-CA')

function frDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function TourDeTaille({
  mensurations,
  heightCm,
  onChange,
}: {
  mensurations: Mensuration[]
  heightCm: number
  onChange: (m: Mensuration[]) => void
}) {
  const [date, setDate] = useState(today())
  const [cm, setCm] = useState('')

  const dernier = mensurations[0]
  const premier = mensurations[mensurations.length - 1]
  const delta = mensurations.length >= 2 ? dernier.waist_cm - premier.waist_cm : null
  const ratio = dernier ? ratioTailleHauteur(dernier.waist_cm, heightCm) : null

  function add() {
    const v = parseFloat(cm.replace(',', '.'))
    if (!Number.isFinite(v) || v <= 0) return
    onChange(upsert(mensurations, { date, waist_cm: v }))
    setCm('')
  }

  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-extrabold text-ink">📏 Tour de taille</h2>

      <div className="mb-3 flex items-end gap-4">
        <div>
          <div className="text-3xl font-extrabold text-ink">
            {dernier ? `${dernier.waist_cm} cm` : '—'}
          </div>
          {delta !== null ? (
            <div className={`text-xs font-semibold ${delta <= 0 ? 'text-sage-dark' : 'text-clay'}`}>
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)} cm depuis la première mesure
            </div>
          ) : null}
          {ratio !== null ? (
            <div className="text-[11px] text-muted">
              Ratio taille/hauteur <b className={ratio < 0.5 ? 'text-sage-dark' : 'text-clay'}>{ratio.toFixed(2)}</b>
              {ratio < 0.5 ? ' — sous le seuil de 0,50' : ` — seuil à 0,50 (${Math.round(heightCm * 0.5)} cm)`}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input
          className="field"
          type="number"
          inputMode="decimal"
          step="0.5"
          placeholder="cm"
          value={cm}
          onChange={(e) => setCm(e.target.value)}
        />
        <button onClick={add} disabled={!cm.trim()} className="btn-primary shrink-0 px-4 py-2">
          +
        </button>
      </div>

      {mensurations.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {mensurations.slice(0, 8).map((m) => (
            <li key={m.date} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 text-xs text-muted">{frDate(m.date)}</span>
              <span className="font-semibold text-ink">{m.waist_cm} cm</span>
              <button
                onClick={() => onChange(mensurations.filter((x) => x.date !== m.date))}
                className="ml-auto text-muted hover:text-clay"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        Au niveau du nombril, debout, sans rentrer le ventre, le matin à jeun. Deux mesures par mois suffisent — en
        dessous, le bruit dépasse le signal.
      </p>
    </section>
  )
}
