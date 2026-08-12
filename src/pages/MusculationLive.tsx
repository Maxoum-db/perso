import { useEffect, useRef, useState } from 'react'
import {
  exoTonnage,
  fmtTonnage,
  saveSession,
  RESSENTI_NAME,
  type CatalogExercise,
  type MuscuSession,
} from '../lib/muscu'
import { renommerSiAuto } from '../lib/nommage'
import { OUTILS, outilDe, type OutilId } from '../lib/materiel'
import { remodeler, type Changement } from '../lib/remodeler'
import { RessentiPicker } from '../components/RessentiPicker'
import { suggererCharge } from '../lib/charge'
import { ExercisePicker } from '../components/ExercisePicker'
import { GroupPicker } from '../components/GroupPicker'

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
  /** Pourquoi cette charge est proposée (« 10 reps la dernière fois : +2,5 kg »). */
  hint?: string
  notes: string
  done: boolean[] // une case par série
}

export interface LiveState {
  startedAt: number
  name: string
  template_id: string | null
  restSec: number
  notes: string
  /** Zones sollicitées déclarées à la main (séance sans exercices chiffrés). */
  ressenti?: string
  /**
   * Outils déclarés INDISPONIBLES pour cette séance-ci.
   *
   * On enregistre ce qui manque, pas ce qui est là : une liste vide veut donc
   * dire « tout est disponible », ce qui est le cas normal et ce que devient
   * une séance en cours enregistrée avant que cette case existe. À l'écran, les
   * cases arrivent donc toutes cochées.
   *
   * Propre à la séance, et jamais confondu avec « mon matériel » (lib/monMateriel,
   * le garage) : ici c'est le rack qui est pris à 19 h 12, pas un achat.
   */
  outilsHS?: OutilId[]
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
  groups,
  sessions,
  bodyWeight,
  onFinish,
  onQuit,
}: {
  userId: string
  initial: LiveState
  catalog: CatalogExercise[]
  groups: string[]
  /** Historique, pour conseiller la charge d'un exercice ajouté en cours de route. */
  sessions: MuscuSession[]
  bodyWeight: number | null
  onFinish: () => void
  onQuit: () => void
}) {
  const [s, setS] = useState<LiveState>(initial)
  const [now, setNow] = useState(() => Date.now())
  const [restEnd, setRestEnd] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Ce que le dernier remodelage a changé : sans ce compte rendu, trois lignes
  // se remplacent en silence et on ne sait plus quelle séance on est en train
  // de faire.
  const [changements, setChangements] = useState<Changement[]>([])
  const [materielOuvert, setMaterielOuvert] = useState(false)
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
    // Charge conseillée à partir des séances précédentes, comme partout ailleurs.
    const charge = suggererCharge(sessions, { name: c.name, default_reps: c.default_reps }, bodyWeight)
    setS((prev) => ({
      ...prev,
      exos: [
        ...prev.exos,
        {
          name: c.name,
          muscle_group: c.muscle_group,
          reps: c.default_reps,
          weight: charge.weight === null ? '' : String(charge.weight),
          hint: charge.raison || undefined,
          notes: '',
          done: Array(Math.max(1, c.default_sets)).fill(false),
        },
      ],
    }))
  }

  // ── Matériel de la séance ────────────────────────────────────────────────
  //
  // Les outils que la séance emploie RÉELLEMENT, dans l'ordre où ils
  // apparaissent : c'est la liste qu'on a sous les yeux, pas les vingt du
  // catalogue. Elles arrivent toutes cochées — on décoche ce qui est pris.
  const outilsHS = s.outilsHS ?? []
  const outilsSeance = [...new Set(s.exos.filter((e) => e.name.trim()).map((e) => outilDe(e.name)))]
  const dispo = outilsSeance.filter((o) => !outilsHS.includes(o))
  // Exercices que le matériel manquant rend infaisables, et qui n'ont pas
  // encore de série cochée : ce sont eux que « remodeler » remplacera.
  const aRemodeler = s.exos.filter(
    (e) => e.name.trim() && outilsHS.includes(outilDe(e.name)) && e.done.every((d) => !d),
  ).length

  function basculerOutil(o: OutilId) {
    setS((prev) => {
      const hs = prev.outilsHS ?? []
      return { ...prev, outilsHS: hs.includes(o) ? hs.filter((x) => x !== o) : [...hs, o] }
    })
  }

  /**
   * Remplace les exercices dont l'outil manque par leur équivalent.
   *
   * La charge conseillée est recalculée pour le remplaçant : garder celle du
   * mouvement d'avant serait pire que ne rien proposer — 100 kg de développé
   * couché ne sont pas 100 kg de développé haltères.
   */
  function remodelerSeance() {
    const { lignes, changements } = remodeler(
      s.exos.map((e) => ({ ...e, faites: e.done.filter(Boolean).length })),
      catalog,
      dispo,
      (ligne, par) => {
        const charge = suggererCharge(sessions, { name: par.name, default_reps: par.default_reps }, bodyWeight)
        return {
          ...ligne,
          name: par.name,
          muscle_group: par.muscle_group,
          reps: par.default_reps,
          weight: charge.weight === null ? '' : String(charge.weight),
          hint: charge.raison || undefined,
          // Autant de cases que le remplaçant en demande, jamais moins d'une.
          done: Array(Math.max(1, par.default_sets)).fill(false),
        }
      },
    )
    setS((prev) => ({
      ...prev,
      exos: lignes.map(({ faites: _faites, ...e }) => e as LiveExo),
    }))
    setChangements(changements)
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
    // Une séance sans série cochée reste valable si le ressenti est renseigné :
    // c'est exactement le cas du béhourd ou du kickboxing.
    if (!kept.length && !s.ressenti?.trim()) {
      if (confirm('Aucune série cochée — abandonner la séance sans rien enregistrer ?')) {
        clearLive()
        onQuit()
      }
      return
    }
    setBusy(true)
    setError(null)
    try {
      // Le nom de la séance se décide ICI, pas à l'ouverture : entre les deux,
      // des exercices ont été ajoutés, d'autres abandonnés sans une seule série
      // cochée. Seul ce qui a été fait compte. Un nom écrit à la main est
      // conservé — voir `estNomAutomatique`.
      const nom = renommerSiAuto(
        s.name,
        kept.map((e) => ({ name: e.name, muscle_group: e.muscle_group, sets: e.doneCount })),
      )
      await saveSession(
        userId,
        {
          date: new Date().toISOString().slice(0, 10),
          name: nom,
          duration_min: Math.max(1, Math.round((Date.now() - s.startedAt) / 60000)),
          notes: s.notes,
          template_id: s.template_id,
        },
        [
          ...kept.map((e) => ({
            name: e.name,
            muscle_group: e.muscle_group,
            sets: e.doneCount,
            reps: e.reps,
            weight_kg: parseW(e.weight),
            notes: e.notes,
          })),
          ...(s.ressenti?.trim()
            ? [{ name: RESSENTI_NAME, muscle_group: s.ressenti, sets: 1, reps: '—', weight_kg: null, notes: '' }]
            : []),
        ],
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

      {/* ── Matériel de la séance ──
          Les outils que CETTE séance emploie, tous cochés d'entrée. On décoche
          le rack qui est pris, on remodèle, et les exercices concernés sont
          remplacés par leur équivalent. Rien à voir avec « mon matériel » des
          réglages : là c'est le garage, ici c'est 19 h 12 un mardi. */}
      {outilsSeance.length > 0 ? (
        <div className="card space-y-2 p-3">
          <button
            onClick={() => setMaterielOuvert((o) => !o)}
            className="flex w-full items-center gap-2 text-left text-sm font-bold text-ink"
          >
            <span className="text-[10px] text-muted">{materielOuvert ? '▾' : '▸'}</span>
            🧰 Matériel dispo
            <span className="ml-auto text-[11px] font-semibold text-muted">
              {outilsHS.length === 0
                ? `${outilsSeance.length} poste${outilsSeance.length > 1 ? 's' : ''}`
                : `${outilsHS.length} indispo`}
            </span>
          </button>

          {materielOuvert ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {outilsSeance.map((o) => {
                  const ok = !outilsHS.includes(o)
                  return (
                    <button
                      key={o}
                      onClick={() => basculerOutil(o)}
                      aria-pressed={ok}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                        ok ? 'bg-copper text-white' : 'bg-bg text-muted line-through'
                      }`}
                      title={ok ? 'Disponible — toucher pour dire qu’il est pris' : 'Indisponible'}
                    >
                      {ok ? '☑' : '☐'} {OUTILS[o].emoji} {OUTILS[o].label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted">
                Décoche ce qui est pris, puis remodèle : les exercices concernés sont remplacés par
                l'équivalent le plus proche. Ce qui est déjà coché ne bouge pas.
              </p>
            </>
          ) : null}

          {outilsHS.length > 0 ? (
            <button
              onClick={remodelerSeance}
              disabled={aRemodeler === 0}
              className="btn-primary w-full py-2 text-sm disabled:opacity-50"
            >
              🔄 Remodeler la séance
              {aRemodeler > 0 ? ` (${aRemodeler} exercice${aRemodeler > 1 ? 's' : ''})` : ''}
            </button>
          ) : null}

          {changements.length > 0 ? (
            <ul className="space-y-0.5 text-[11px]">
              {changements.map((c, i) => (
                <li key={i} className={c.sort === 'remplace' ? 'text-sage-dark' : 'text-clay'}>
                  {c.sort === 'remplace' ? '↪' : c.sort === 'retire' ? '✕' : '⚠️'} {c.avant}
                  {c.sort === 'remplace' ? ` → ${c.apres}` : null}
                  {c.sort === 'retire' ? ' — aucun équivalent avec ce matériel' : null}
                  {c.sort === 'garde' ? ' — déjà entamé, gardé tel quel' : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

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

              <GroupPicker
                value={e.muscle_group}
                groups={groups}
                onChange={(v) => updateExo(j, { muscle_group: v })}
              />

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
                {e.hint ? <span className="text-[11px] font-semibold text-copper">💡 {e.hint}</span> : null}
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

      <div className="card space-y-2 p-3">
        <h3 className="text-sm font-bold text-ink">🤕 Zones sollicitées</h3>
        <p className="text-[11px] text-muted">
          Utile quand la séance n'a ni série ni charge — béhourd, kickboxing, grappling.
        </p>
        <RessentiPicker value={s.ressenti ?? ''} onChange={(g) => setS({ ...s, ressenti: g })} />
      </div>

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
