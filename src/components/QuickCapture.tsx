import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useSpeech } from '../lib/useSpeech'
import { createTask, createEvent, listTaskLists, type EventInput } from '../lib/google'
import { createNote } from '../lib/notes'

type Kind = 'note' | 'task' | 'event'
const TZ = 'Europe/Paris'
const today = () => new Date().toISOString().slice(0, 10)
const pad = (n: number) => String(n).padStart(2, '0')

function eventInput(title: string, date: string, time: string): EventInput {
  if (time) {
    const [h, m] = time.split(':').map(Number)
    let eh = h + 1
    let endDate = date
    if (eh >= 24) {
      eh -= 24
      const d = new Date(`${date}T00:00:00`)
      d.setDate(d.getDate() + 1)
      endDate = d.toISOString().slice(0, 10)
    }
    return {
      summary: title,
      start: { dateTime: `${date}T${pad(h)}:${pad(m)}:00`, timeZone: TZ },
      end: { dateTime: `${endDate}T${pad(eh)}:${pad(m)}:00`, timeZone: TZ },
    }
  }
  const next = new Date(`${date}T00:00:00`)
  next.setDate(next.getDate() + 1)
  return { summary: title, start: { date }, end: { date: next.toISOString().slice(0, 10) } }
}

// Bouton « + » flottant présent sur toutes les pages : capture express d'une
// note, d'une tâche (Google Tasks) ou d'un événement (Google Agenda), avec dictée.
export function QuickCapture() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('note')
  const [text, setText] = useState('')
  const [date, setDate] = useState(today())
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const { supported, listening, start, stop } = useSpeech((t) => setText((p) => (p ? p + ' ' : '') + t))

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }
  function reset() {
    setText('')
    setTime('')
    setDate(today())
  }

  async function save() {
    if (!text.trim() || !user) return
    setBusy(true)
    try {
      if (kind === 'note') {
        await createNote(user.id, {
          title: text.trim().split('\n')[0].slice(0, 80),
          body: text.trim(),
          category: 'autre',
          pinned: false,
        })
      } else if (kind === 'task') {
        const lists = await listTaskLists()
        const listId = lists[0]?.id
        if (!listId) throw new Error('Aucune liste de tâches')
        await createTask(listId, text.trim(), date ? `${date}T00:00:00.000Z` : undefined)
      } else {
        await createEvent('primary', eventInput(text.trim(), date, time))
      }
      reset()
      setOpen(false)
      flash(kind === 'note' ? 'Note créée ✓' : kind === 'task' ? 'Tâche créée ✓' : 'Événement ajouté ✓')
    } catch (e) {
      const msg = (e as Error).message
      flash(/scope|session|autoris/i.test(msg) ? 'Reconnecte Google (Réglages)' : 'Erreur : ' + msg)
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Capture rapide"
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-copper text-3xl leading-none text-white shadow-lift active:scale-95"
        >
          +
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-3xl rounded-t-2xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-extrabold text-ink">Capture rapide</span>
              <button onClick={() => setOpen(false)} className="text-xs text-muted hover:underline">
                Fermer
              </button>
            </div>

            <div className="mb-2 flex gap-1.5">
              {([
                ['note', '📝 Note'],
                ['task', '✅ Tâche'],
                ['event', '📅 Agenda'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setKind(id)}
                  className={`chip flex-1 justify-center ${kind === id ? 'bg-copper text-white' : 'bg-bg text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <textarea
              className="field"
              rows={3}
              autoFocus
              placeholder={kind === 'task' ? 'Quoi faire ?' : kind === 'event' ? "Quel événement ?" : 'Ta note…'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            {kind === 'event' ? (
              <div className="mt-2 flex gap-2">
                <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <input className="field w-28 shrink-0" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            ) : kind === 'task' ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted">Échéance</span>
                <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-2">
              {supported ? (
                <button
                  onClick={listening ? stop : start}
                  className={`btn-ghost px-3 py-2 text-sm ${listening ? 'text-clay' : 'text-copper'}`}
                >
                  {listening ? '■ Stop' : '🎤 Dicter'}
                </button>
              ) : null}
              <button onClick={save} disabled={busy || !text.trim()} className="btn-primary ml-auto px-5 py-2">
                {busy ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed inset-x-0 bottom-24 z-[60] mx-auto w-fit rounded-full bg-ink px-4 py-2 text-xs font-semibold text-bg shadow-lift">
          {toast}
        </div>
      ) : null}
    </>
  )
}
