import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { addWeighin, deleteWeighin, listWeighins, type Weighin } from '../lib/workouts'

const today = () => new Date().toISOString().slice(0, 10)

// Suivi du poids de corps — onglet « ⚖️ Poids » du module Musculation.
export function Poids() {
  const { user } = useAuth()
  const [weighins, setWeighins] = useState<Weighin[]>([])
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(today())
  const [weight, setWeight] = useState('')
  const [busy, setBusy] = useState(false)

  async function reload() {
    if (!user) return
    try {
      setWeighins(await listWeighins(user.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const latest = weighins[0]
  const delta = useMemo(() => (weighins.length >= 2 ? weighins[0].weight_kg - weighins[1].weight_kg : null), [weighins])

  async function add() {
    const w = parseFloat(weight.replace(',', '.'))
    if (!user || !Number.isFinite(w)) return
    setBusy(true)
    try {
      await addWeighin(user.id, { date, weight_kg: w })
      setWeight('')
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      <section className="card p-4">
        <h2 className="mb-2 text-sm font-extrabold text-ink">⚖️ Poids de corps</h2>

        <div className="mb-3 flex items-end gap-4">
          <div>
            <div className="text-3xl font-extrabold text-ink">{latest ? `${latest.weight_kg} kg` : '—'}</div>
            {delta !== null ? (
              <div className={`text-xs font-semibold ${delta <= 0 ? 'text-sage-dark' : 'text-clay'}`}>
                {delta > 0 ? '+' : ''}
                {delta.toFixed(1)} kg vs précédent
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
            step="0.1"
            placeholder="kg"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <button onClick={add} disabled={busy} className="btn-primary shrink-0 px-4 py-2">
            +
          </button>
        </div>

        {weighins.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {weighins.slice(0, 8).map((w) => (
              <li key={w.id} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted">{frDate(w.date)}</span>
                <span className="font-semibold text-ink">{w.weight_kg} kg</span>
                <button onClick={() => deleteWeighin(w.id).then(reload)} className="ml-auto text-muted hover:text-clay">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <p className="text-center text-[11px] text-muted">
        💡 Pèse-toi 1× par semaine, le matin à jeun — la tendance compte plus que le chiffre du jour.
      </p>
    </div>
  )
}

function frDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
