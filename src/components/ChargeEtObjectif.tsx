import { useState } from 'react'
import { bilanCalories } from '../lib/calories'
import { poidsHistorique } from '../lib/profil'
import { VERDICTS, bilanCharge, joursRestantsSemaine } from '../lib/trainingLoad'
import type { MuscuSession } from '../lib/muscu'
import type { Weighin } from '../lib/workouts'

// Charge d'entraînement et objectif hebdomadaire : la page qui dit si le rythme
// tient la route, et si la semaine est en train de passer à la trappe.

export function ChargeHebdo({ sessions }: { sessions: MuscuSession[] }) {
  const b = bilanCharge(sessions)
  const v = VERDICTS[b.verdict]
  const maxSem = Math.max(1, ...b.semaines)

  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-extrabold text-ink">📊 Charge d'entraînement</h2>

      <div className="mb-3 flex items-end gap-4">
        <div>
          <div className="text-3xl font-extrabold text-ink">
            {b.aigue.toLocaleString('fr-FR')} <span className="text-sm font-bold text-muted">MET·min</span>
          </div>
          <div className="text-xs text-muted">
            cette semaine
            {b.chronique > 0 ? ` · ${b.chronique.toLocaleString('fr-FR')} en moyenne sur 4 semaines` : ''}
          </div>
          <div className="text-xs font-semibold" style={{ color: v.couleur }}>
            {b.ratio !== null ? `${b.ratio.toFixed(2)}× — ` : ''}
            {v.label}
          </div>
        </div>
      </div>

      {/* 4 dernières semaines */}
      <div className="flex items-end justify-between gap-2" style={{ height: 64 }}>
        {b.semaines.map((s, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[9px] font-semibold text-muted">{s > 0 ? s : ''}</span>
            <div
              className="w-full rounded-t"
              style={{
                height: Math.max(2, Math.round((s / maxSem) * 40)),
                background: i === b.semaines.length - 1 ? v.couleur : 'rgb(var(--copper) / .35)',
              }}
            />
            <span className="text-[10px] text-muted">{i === b.semaines.length - 1 ? 'cette sem.' : `S-${b.semaines.length - 1 - i}`}</span>
          </div>
        ))}
      </div>

      <p className="mt-2 rounded-xl2 bg-white/5 p-2 text-[11px] leading-relaxed text-ink">{v.conseil}</p>

      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        La charge mêle durée et intensité (MET·minutes). Le ratio compare ta semaine à ta moyenne des quatre
        dernières : entre 0,8 et 1,3 le corps suit, au-delà de 1,5 le risque de blessure grimpe nettement.
      </p>
    </section>
  )
}

export function ObjectifKcal({
  sessions,
  bodyWeight,
  weighins = [],
  objectif,
  onObjectif,
}: {
  sessions: MuscuSession[]
  bodyWeight: number | null
  /** Toutes les pesées : chaque séance est calculée au poids de SON jour. */
  weighins?: Weighin[]
  objectif: number
  onObjectif: (v: number) => void
}) {
  const [edit, setEdit] = useState(false)
  const [valeur, setValeur] = useState(String(objectif))

  const bilan = bilanCalories(sessions, weighins.length ? poidsHistorique(weighins) : bodyWeight, 7)
  const pct = Math.min(100, Math.round((bilan.total / Math.max(1, objectif)) * 100))
  const reste = Math.max(0, objectif - bilan.total)
  const jours = joursRestantsSemaine()
  const atteint = bilan.total >= objectif

  function valider() {
    const v = parseInt(valeur.replace(/\s/g, ''), 10)
    if (Number.isFinite(v) && v > 0) onObjectif(v)
    setEdit(false)
  }

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-ink">🎯 Objectif de la semaine</h2>
        <button onClick={() => setEdit((o) => !o)} className="text-[11px] font-semibold text-copper">
          {edit ? 'Fermer' : 'Modifier'}
        </button>
      </div>

      {edit ? (
        <div className="mb-3 flex items-center gap-2">
          <input
            className="field w-28"
            type="number"
            inputMode="numeric"
            step="100"
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
          />
          <span className="text-xs text-muted">kcal / semaine</span>
          <button onClick={valider} className="btn-primary shrink-0 px-3 py-1.5 text-sm">
            OK
          </button>
        </div>
      ) : null}

      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-extrabold text-ink">
          {bilan.total.toLocaleString('fr-FR')}
          <span className="text-sm font-bold text-muted"> / {objectif.toLocaleString('fr-FR')} kcal</span>
        </span>
        <span className={`text-sm font-bold ${atteint ? 'text-sage-dark' : 'text-copper'}`}>{pct} %</span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: atteint ? '#10B981' : 'rgb(var(--copper))' }}
        />
      </div>

      <p className="mt-2 text-[11px] text-muted">
        {atteint ? (
          <>
            ✅ Objectif atteint — {(bilan.total - objectif).toLocaleString('fr-FR')} kcal d'avance.
          </>
        ) : (
          <>
            Reste <b className="text-ink">{reste.toLocaleString('fr-FR')} kcal</b> en {jours} jour
            {jours > 1 ? 's' : ''}, soit environ{' '}
            <b className="text-ink">{Math.ceil(reste / jours).toLocaleString('fr-FR')} kcal/jour</b>.
          </>
        )}
      </p>
    </section>
  )
}
