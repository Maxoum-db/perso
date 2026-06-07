import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuth } from '../lib/auth'
import {
  GoogleAuthError,
  createTask,
  hasFreshGoogleToken,
  isAllDay,
  listCalendars,
  listEventsMulti,
  listTaskLists,
  listTasks,
  setTaskStatus,
  type GEvent,
  type GTask,
} from '../lib/google'
import { ReconnectGoogle } from '../components/ReconnectGoogle'

export function Journee() {
  const { user } = useAuth()
  const [needAuth, setNeedAuth] = useState(!hasFreshGoogleToken())
  const [events, setEvents] = useState<GEvent[] | null>(null)
  const [tasks, setTasks] = useState<GTask[]>([])
  const [taskListId, setTaskListId] = useState('')
  const [newTask, setNewTask] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!hasFreshGoogleToken()) {
      setNeedAuth(true)
      return
    }
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    try {
      const cals = await listCalendars()
      const evs = await listEventsMulti(cals, start, end)
      setEvents(evs)
    } catch (e) {
      if (e instanceof GoogleAuthError) return setNeedAuth(true)
      setError((e as Error).message)
      setEvents([])
    }

    try {
      const lists = await listTaskLists()
      if (lists[0]) {
        setTaskListId(lists[0].id)
        setTasks(await listTasks(lists[0].id, false))
      }
    } catch {
      /* Tasks API peut-être pas activée — on n'empêche pas le reste */
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function addTask() {
    const t = newTask.trim()
    if (!t || !taskListId) return
    setNewTask('')
    await createTask(taskListId, t)
    setTasks(await listTasks(taskListId, false))
  }

  async function completeTask(task: GTask) {
    setTasks((prev) => prev.filter((x) => x.id !== task.id))
    try {
      await setTaskStatus(taskListId, task.id, 'completed')
    } catch {
      setTasks(await listTasks(taskListId, false))
    }
  }

  if (needAuth) return <ReconnectGoogle />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">🗓️ Ma journée</h1>
        <p className="text-sm capitalize text-muted">{format(new Date(), 'EEEE d MMMM', { locale: fr })}</p>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      {/* Agenda */}
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-extrabold text-ink">📅 Agenda</h2>
        {events === null ? (
          <div className="animate-pulse text-sm text-muted">Chargement…</div>
        ) : events.length === 0 ? (
          <div className="text-sm text-muted">Rien de prévu. 🌤️</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.calendarId + e.id} className="flex items-baseline gap-3">
                <span className="w-14 shrink-0 text-xs font-semibold text-copper">
                  {isAllDay(e) ? 'jour' : e.start.dateTime ? format(new Date(e.start.dateTime), 'HH:mm') : ''}
                </span>
                <span className="truncate text-sm text-ink">{e.summary || '(sans titre)'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tâches */}
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-extrabold text-ink">✅ Tâches</h2>
        <div className="mb-2 flex items-center gap-2">
          <input
            className="field"
            placeholder="Ajouter une tâche…"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
          />
          <button onClick={addTask} className="btn-primary shrink-0 px-4 py-2">
            +
          </button>
        </div>
        {tasks.length === 0 ? (
          <div className="text-sm text-muted">Aucune tâche en cours. 🎉</div>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <input type="checkbox" className="h-5 w-5 shrink-0" onChange={() => completeTask(t)} />
                <span className="truncate text-sm text-ink">{t.title || '(sans titre)'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  )
}
