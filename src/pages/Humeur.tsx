import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { MOOD_SCALE, MOOD_TAGS, addMood, deleteMood, listMoods, moodMeta, type Mood } from '../lib/moods'

const todayIso = () => new Date().toISOString().slice(0, 10)

export function Humeur() {
  const { user } = useAuth()
  const [moods, setMoods] = useState<Mood[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Formulaire d'une nouvelle entrée (on peut en ajouter plusieurs par jour).
  const [mood, setMood] = useState<number>(0)
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')

  async function reload() {
    if (!user) return
    try {
      setMoods(await listMoods(user.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function add() {
    if (!user || !mood) return
    try {
      await addMood(user.id, { date: todayIso(), mood, tags, note })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      // On vide le formulaire pour une éventuelle nouvelle entrée.
      setMood(0)
      setTags([])
      setNote('')
      reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette entrée ?')) return
    setMoods((prev) => prev.filter((m) => m.id !== id))
    try {
      await deleteMood(id)
    } catch (e) {
      setError((e as Error).message)
      reload()
    }
  }

  const avg = useMemo(() => {
    const last = moods.slice(0, 30)
    return last.length ? (last.reduce((s, m) => s + m.mood, 0) / last.length).toFixed(1) : '—'
  }, [moods])

  // 5 dernières semaines en "pixels" : moyenne des entrées du jour.
  const pixels = useMemo(() => {
    const byDate = new Map<string, number[]>()
    for (const m of moods) {
      const arr = byDate.get(m.date) ?? []
      arr.push(m.mood)
      byDate.set(m.date, arr)
    }
    const cells: { date: string; mood: number | null }[] = []
    for (let i = 34; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      const arr = byDate.get(iso)
      cells.push({ date: iso, mood: arr ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null })
    }
    return cells
  }, [moods])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">😊 Humeur & journal</h1>
        <p className="text-sm text-muted">Comment tu te sens, là maintenant ? (tu peux en ajouter plusieurs par jour)</p>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      {/* Nouvelle entrée */}
      <section className="card p-4">
        <div className="flex justify-between gap-1">
          {MOOD_SCALE.map((m) => (
            <button
              key={m.value}
              onClick={() => setMood(m.value)}
              className="flex flex-1 flex-col items-center rounded-xl2 py-2 transition"
              style={{
                background: mood === m.value ? m.color + '33' : 'transparent',
                border: `1px solid ${mood === m.value ? m.color : 'transparent'}`,
              }}
            >
              <span className="text-3xl">{m.emoji}</span>
              <span className="mt-1 text-[10px] text-muted">{m.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {MOOD_TAGS.map((t) => {
            const on = tags.includes(t)
            return (
              <button
                key={t}
                onClick={() => setTags((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                className="chip border text-[11px] transition"
                style={{
                  borderColor: on ? 'rgb(var(--copper))' : 'rgb(var(--line))',
                  background: on ? 'rgb(var(--copper) / .25)' : 'transparent',
                  color: 'rgb(var(--ink))',
                }}
              >
                {t}
              </button>
            )
          })}
        </div>

        <textarea
          className="field mt-3 min-h-[70px]"
          placeholder="Une note sur ce moment (optionnel)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button onClick={add} disabled={!mood} className="btn-primary mt-3 w-full">
          {saved ? 'Ajouté ✓' : 'Ajouter cette humeur'}
        </button>
      </section>

      {/* Stats */}
      <section className="card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-extrabold text-ink">📊 Tendance (35 jours)</h2>
          <span className="text-xs text-muted">Moyenne 30 j : <b className="text-ink">{avg}/5</b></span>
        </div>
        <div className="mt-3 grid grid-cols-[repeat(35,1fr)] gap-1">
          {pixels.map((c) => (
            <div
              key={c.date}
              title={`${c.date}${c.mood ? ` · ${moodMeta(c.mood).label}` : ''}`}
              className="aspect-square rounded-[3px]"
              style={{ background: c.mood ? moodMeta(c.mood).color : 'rgb(var(--line))' }}
            />
          ))}
        </div>
      </section>

      {/* Historique */}
      {moods.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-extrabold text-ink">Historique</h2>
          <ul className="space-y-2">
            {moods.slice(0, 40).map((m) => (
              <li key={m.id} className="flex items-start gap-2 border-b border-line/50 pb-2 text-sm last:border-0">
                <span className="text-xl">{moodMeta(m.mood).emoji}</span>
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-muted">
                    {frDate(m.date)}
                    {m.created_at ? ` · ${frTime(m.created_at)}` : ''}
                  </span>
                  {m.tags.length ? <span className="text-xs text-muted"> · {m.tags.join(', ')}</span> : null}
                  {m.note ? <div className="text-ink">{m.note}</div> : null}
                </div>
                <button
                  onClick={() => remove(m.id)}
                  title="Supprimer cette entrée"
                  className="shrink-0 text-muted hover:text-clay"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function frDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function frTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
