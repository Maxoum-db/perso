import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  addHabit,
  deleteHabit,
  listHabitsWithState,
  toggleHabitToday,
  type HabitWithState,
} from '../lib/habits'

export function Habitudes() {
  const { user } = useAuth()
  const [habits, setHabits] = useState<HabitWithState[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('✅')

  async function reload() {
    if (!user) return
    try {
      setHabits(await listHabitsWithState(user.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function toggle(h: HabitWithState) {
    if (!user) return
    setHabits((prev) =>
      prev.map((x) =>
        x.id === h.id
          ? { ...x, doneToday: !x.doneToday, streak: x.streak + (x.doneToday ? -1 : 1), last7: x.last7 + (x.doneToday ? -1 : 1) }
          : x,
      ),
    )
    try {
      await toggleHabitToday(user.id, h.id, !h.doneToday)
      reload()
    } catch (e) {
      setError((e as Error).message)
      reload()
    }
  }

  async function add() {
    if (!user || !name.trim()) return
    try {
      await addHabit(user.id, name.trim(), emoji || '✅')
      setName('')
      setEmoji('✅')
      reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">🔁 Habitudes</h1>
        <p className="text-sm text-muted">Coche chaque jour, garde tes séries 🔥</p>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      <div className="flex items-center gap-2">
        <input
          className="field w-16 shrink-0 text-center"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          maxLength={2}
          aria-label="Emoji"
        />
        <input
          className="field"
          placeholder="Nouvelle habitude (ex : Méditation)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} className="btn-primary shrink-0 px-4 py-2">
          +
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          Aucune habitude. Ajoute-en une pour commencer ! 🌱
        </div>
      ) : (
        <ul className="space-y-2">
          {habits.map((h) => (
            <li key={h.id} className="card flex items-center gap-3 p-3">
              <button
                onClick={() => toggle(h)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl transition"
                style={{
                  background: h.doneToday ? 'rgb(var(--sage) / .25)' : 'rgb(var(--line) / .4)',
                  border: `2px solid ${h.doneToday ? 'rgb(var(--sage))' : 'transparent'}`,
                }}
                title={h.doneToday ? 'Fait aujourd’hui' : 'Marquer comme fait'}
              >
                {h.doneToday ? '✓' : h.emoji}
              </button>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">
                  {h.emoji} {h.name}
                </div>
                <div className="text-xs text-muted">
                  🔥 {h.streak} j de suite · {h.last7}/7 cette semaine
                </div>
              </div>
              <button onClick={() => deleteHabit(h.id).then(reload)} className="shrink-0 text-muted hover:text-clay" title="Supprimer">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
