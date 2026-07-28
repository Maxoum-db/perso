import { useEffect, useRef, useState } from 'react'
import {
  exoTonnage,
  fmtTonnage,
  saveSession,
  type CatalogExercise,
} from '../lib/muscu'
import { ExercisePicker } from '../components/ExercisePicker'

// ── Séance en direct ─────────────────────────────────────────────────────────
// Chrono global, séries à cocher une à une (chaque série lance le minuteur de
// repos, bip + vibration à la fin), tonnage en temps réel. L'état vit dans
// localStorage : fermer/rouvrir l'app reprend la séance en cours.

const LIVE_KEY = 'hubperso.muscu.live'
const REST_CHOICES = [60, 90, 120]

export interface LiveExo {
  name: string
  muscle_group: string
  reps: string
  weight: string // charge en kg (texte input, vide = poids du corps)
  notes: string
  done: boolean[] // une case par série
}

export interface LiveState {
  startedAt: number
  name: string
  template_id: string | null
  restSec: number
  notes: string
  exos: LiveExo[]
}

export function loadLive(): LiveState | null {
  try {
    const raw = localStorage.getItem(LIVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as LiveState
    return s && Array.isArray(s.exos) ? s : null
  } catch {
    return null
  }
}

export function storeLive(s: LiveState): void {
  try {
    localStorage.setItem(LIVE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function clearLive(): void {
  try {
    localStorage.removeItem(LIVE_KEY)
  } catch {
    /* ignore */
  }
}

function parseW(w: string): number | null {
  const n = parseFloat(w.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const play = (freq: number, at: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.25, ctx.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.25)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.3)
    }
    play(880, 0)
    play(1175, 0.3)
  } catch {
    /* ignore */
  }
}

function fmtClock(ms: number): string {
  const totalS = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalS / 3600)
  const m = Math.floor((totalS % 3600) / 60)
  const s = totalS % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function LiveSession({
  userId,
  initial,
  catalog,
  onFinish,
  onQuit,
}: {
  userId: string
  initial: LiveState
  catalog: CatalogExercise[]
  onFinish: () => void
  onQuit: () => void
}) {
  const [s, setS] = useState<LiveState>(initial)
  const [now, setNow] = useState(() => Date.now())
  const [restEnd, setRestEnd] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const restNotified = useRef(false)

  useEffect(() => {
    storeLive(s)
  }, [s])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const restLeft = restEnd !== null ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : null
  useEffect(() => {
    if (restEnd !== null && now >= restEnd && !restNotified.current) {
      restNotified.current = true
      try {
        navigator.vibrate?.([200, 100, 200])
      } catch {
        /* ignore */
      }
      beep()
      setRestEnd(null)
    }
  }, [now, restEnd])

  const doneSets = s.exos.reduce((n, e) => n + e.done.filter(Boolean).length, 0)
  const totalSets = s.exos.reduce((n, e) => n + e.done.length, 0)
  const tonnage = s.exos.reduce(
    (sum, e) => sum + exoTonnage({ sets: e.done.filter(Boolean).length, reps: e.reps, weight_kg: parseW(e.weight) }),
    0,
  )

  function updateExo(j: number, patch: Partial<LiveExo>) {
    setS((prev) => ({ ...prev, exos: prev.exos.map((e, i) => (i === j ? { ...e, ...patch } : e)) }))
  }

  function toggleSet(j: number, i: number) {
    const wasDone = s.exos[j].done[i]
    setS((prev) => ({
      ...prev,
      exos: prev.exos.map((e, idx) =>
        idx === j ? { ...e, done: e.done.map((d, k) => (k === i ? !d : d)) } : e,
      ),
    }))
    if (!wasDone) {
      restNotified.current = false
      setRestEnd(Date.now() + s.restSec * 1000)
    }
  }

  function addSet(j: number) {
    setS((prev) => ({
      ...prev,
      exos: prev.exos.map((e, i) => (i === j ? { ...e, done: [...e.done, false] } : e)),
    }))
  }

  function removeSet(j: number) {
    setS((prev) => ({
      ...prev,
      exos: prev.exos.map((e, i) => (i === j && e.done.length > 1 ? { ...e, done: e.done.slice(0, -1) } : e)),
    }))
  }

  function addFromCatalog(id: string) {
    const c = catalog.find((x) => x.id === id)
    if (!c) return
    setS((prev) => ({
      ...prev,
      exos: [
        ...prev.exos,
        {
          name: c.name,
          muscle_group: c.muscle_group,
          reps: c.default_reps,
          weight: '', // charge saisie en séance, pas pré-remplie depuis le catalogue
          notes: '',
          done: Array(Math.max(1, c.default_sets)).fill(false),
        },
      ],
    }))
  }

  function addBlank() {
    setS((prev) => ({
      ...prev,
      exos: [...prev.exos, { name: '', muscle_group: '', reps: '10', weight: '', notes: '', done: [false, false, false] }],
    }))
  }

  function removeExo(j: number) {
    setS((prev) => ({ ...prev, exos: prev.exos.filter((_, i) => i !== j) }))
  }

  function moveExo(j: number, dir: -1 | 1) {
    setS((prev) => {
      const k = j + dir
      if (k < 0 || k >= prev.exos.length) return prev
      const exos = [...prev.exos]
      ;[exos[j], exos[k]] = [exos[k], exos[j]]
      return { ...prev, exos }
    })
  }

  async function finish() {
    const kept = s.exos
      .map((e) => ({ ...e, doneCount: e.done.filter(Boolean).length }))
      .filter((e) => e.doneCount > 0 && e.name.trim())
    if (!kept.length) {
      if (confirm('Aucune série cochée — abandonner la séance sans rien enregistrer ?')) {
        clearLive()
        onQuit()
      }
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveSession(
        userId,
        {
          date: new Date().toISOString().slice(0, 10),
          name: s.name,
          duration_min: Math.max(1, Math.round((Date.now() - s.startedAt) / 60000)),
          notes: s.notes,
          template_id: s.template_id,
        },
        kept.map((e) => ({
          name: e.name,
          muscle_group: e.muscle_group,
          sets: e.doneCount,
          reps: e.reps,
          weight_kg: parseW(e.weight),
          notes: e.notes,
        })),
      )
      clearLive()
      onFinish()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  function quit() {
    if (!confirm('Abandonner la séance en cours ? Rien ne sera enregistré.')) return
    clearLive()
    onQuit()
  }

  return (
    <div className="space-y-3">
      {/* ── Bandeau live : chrono, tonnage, repos ── */}
      <div className="card space-y-2 border-copper/40 p-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-clay" />
          <input
            className="min-w-0 flex-1 bg-transparent text-lg font-extrabold text-ink outline-none"
            value={s.name}
            onChange={(e) => setS({ ...s, name: e.target.value })}
          />
          <span className="shrink-0 font-mono text-lg font-bold text-copper">⏱ {fmtClock(now - s.startedAt)}</span>
        </div>

        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            ✅ {doneSets}/{totalSets} séries
          </span>
          <span className="font-semibold text-copper">🏋️ {fmtTonnage(tonnage)}</span>
        </div>

        {restLeft !== null && restLeft > 0 ? (
          <div className="flex items-center justify-between rounded-xl2 bg-copper/15 px-3 py-2">
            <span className="text-sm font-bold text-copper">😮‍💨 Repos : {restLeft}s</span>
            <button onClick={() => setRestEnd(null)} className="text-xs font-semibold text-muted hover:text-ink">
              Passer ▸
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            Repos :
            {REST_CHOICES.map((r) => (
              <button
                key={r}
                onClick={() => setS({ ...s, restSec: r })}
                className={`rounded-lg px-2 py-1 font-semibold ${s.restSec === r ? 'bg-copper/20 text-copper' : 'bg-bg'}`}
              >
                {r}s
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      {/* ── Exercices ── */}
      <ul className="space-y-2">
        {s.exos.map((e, j) => {
          const doneCount = e.done.filter(Boolean).length
          const allDone = doneCount === e.done.length
          return (
            <li key={j} className={`card space-y-2 p-3 ${allDone ? 'opacity-70' : ''}`}>
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-ink outline-none"
                  placeholder="Exercice…"
                  value={e.name}
                  onChange={(ev) => updateExo(j, { name: ev.target.value })}
                />
                {e.muscle_group ? <span className="chip shrink-0 bg-copper/10 text-[10px] text-copper">{e.muscle_group}</span> : null}
                <button
                  onClick={() => moveExo(j, -1)}
                  disabled={j === 0}
                  title="Monter"
                  className="shrink-0 px-1 text-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveExo(j, 1)}
                  disabled={j === s.exos.length - 1}
                  title="Descendre"
                  className="shrink-0 px-1 text-muted disabled:opacity-30"
                >
                  ↓
                </button>
                <button onClick={() => removeExo(j)} className="shrink-0 text-muted hover:text-clay">
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <input
                  className="field w-20"
                  placeholder="reps ou 45s"
                  value={e.reps}
                  onChange={(ev) => updateExo(j, { reps: ev.target.value })}
                />
                ×
                <label className="flex items-center gap-1">
                  <input
                    className="field w-20"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    placeholder="PdC"
                    value={e.weight}
                    onChange={(ev) => updateExo(j, { weight: ev.target.value })}
                  />
                  kg
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {e.done.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => toggleSet(j, i)}
                    className={`h-10 w-10 rounded-full text-sm font-bold transition ${
                      d ? 'bg-copper text-white' : 'border border-line bg-bg text-muted hover:border-copper'
                    }`}
                    title={`Série ${i + 1}`}
                  >
                    {d ? '✓' : i + 1}
                  </button>
                ))}
                <button onClick={() => addSet(j)} title="Ajouter une série" className="h-10 w-8 rounded-full text-muted hover:text-copper">
                  +
                </button>
                {e.done.length > 1 ? (
                  <button onClick={() => removeSet(j)} title="Retirer une série" className="h-10 w-8 rounded-full text-muted hover:text-clay">
                    –
                  </button>
                ) : null}
              </div>

              <input
                className="field text-xs"
                placeholder="Note (ressenti, réglage machine…)"
                value={e.notes}
                onChange={(ev) => updateExo(j, { notes: ev.target.value })}
              />
            </li>
          )
        })}
      </ul>

      {/* ── Ajouter un exo en cours de route ── */}
      <ExercisePicker catalog={catalog} onPick={(c) => addFromCatalog(c.id)} onBlank={addBlank} />

      <textarea
        className="field"
        rows={2}
        placeholder="Notes sur la séance (ressenti, énergie…)"
        value={s.notes}
        onChange={(e) => setS({ ...s, notes: e.target.value })}
      />

      <button onClick={finish} disabled={busy} className="btn-primary w-full py-3">
        {busy ? '…' : `✅ Terminer (${fmtClock(now - s.startedAt)} · ${fmtTonnage(tonnage)})`}
      </button>
      <button onClick={quit} className="w-full text-center text-xs text-muted hover:text-clay">
        Abandonner la séance
      </button>
    </div>
  )
}
