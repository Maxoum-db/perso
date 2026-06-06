import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  WORKOUT_KINDS,
  addWeighin,
  addWorkout,
  deleteWeighin,
  deleteWorkout,
  listWeighins,
  listWorkouts,
  type Weighin,
  type Workout,
} from '../lib/workouts'

const today = () => new Date().toISOString().slice(0, 10)

export function Carnet() {
  const { user } = useAuth()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [weighins, setWeighins] = useState<Weighin[]>([])
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!user) return
    try {
      const [w, p] = await Promise.all([listWorkouts(user.id), listWeighins(user.id)])
      setWorkouts(w)
      setWeighins(p)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">📓 Carnet d'entraînement</h1>
        <p className="text-sm text-muted">Tes séances et ton poids — synchronisés, reliés à ta prépa béhourd.</p>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      <WeightSection userId={user?.id ?? ''} weighins={weighins} onChange={reload} />
      <WorkoutSection userId={user?.id ?? ''} workouts={workouts} onChange={reload} />
    </div>
  )
}

function WeightSection({ userId, weighins, onChange }: { userId: string; weighins: Weighin[]; onChange: () => void }) {
  const [date, setDate] = useState(today())
  const [weight, setWeight] = useState('')
  const [busy, setBusy] = useState(false)

  const latest = weighins[0]
  const delta = useMemo(() => (weighins.length >= 2 ? weighins[0].weight_kg - weighins[1].weight_kg : null), [weighins])

  async function add() {
    const w = parseFloat(weight.replace(',', '.'))
    if (!userId || !Number.isFinite(w)) return
    setBusy(true)
    try {
      await addWeighin(userId, { date, weight_kg: w })
      setWeight('')
      onChange()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-extrabold text-ink">⚖️ Poids</h2>

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
              <button onClick={() => deleteWeighin(w.id).then(onChange)} className="ml-auto text-muted hover:text-clay">
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function WorkoutSection({ userId, workouts, onChange }: { userId: string; workouts: Workout[]; onChange: () => void }) {
  const [date, setDate] = useState(today())
  const [kind, setKind] = useState(WORKOUT_KINDS[0])
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!userId) return
    setBusy(true)
    try {
      await addWorkout(userId, {
        date,
        kind,
        duration_min: duration ? parseInt(duration, 10) : null,
        notes: notes.trim(),
      })
      setDuration('')
      setNotes('')
      onChange()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-extrabold text-ink">🏋️ Séances</h2>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
            {WORKOUT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            className="field w-24 shrink-0"
            type="number"
            inputMode="numeric"
            placeholder="min"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <input
            className="field"
            placeholder="Notes (charges, ressenti…)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button onClick={add} disabled={busy} className="btn-primary shrink-0 px-4 py-2">
            +
          </button>
        </div>
      </div>

      {workouts.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {workouts.slice(0, 15).map((w) => (
            <li key={w.id} className="flex items-start gap-2 border-b border-line/50 pb-2 text-sm last:border-0">
              <span className="w-20 shrink-0 text-xs text-muted">{frDate(w.date)}</span>
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-ink">{w.kind}</span>
                {w.duration_min ? <span className="text-muted"> · {w.duration_min} min</span> : null}
                {w.notes ? <div className="text-xs text-muted">{w.notes}</div> : null}
              </div>
              <button onClick={() => deleteWorkout(w.id).then(onChange)} className="shrink-0 text-muted hover:text-clay">
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted">Aucune séance enregistrée. Ajoute ta première ! 💪</p>
      )}
    </section>
  )
}

function frDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
