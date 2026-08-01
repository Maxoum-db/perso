import { useEffect, useMemo, useState } from 'react'
import { addDays, endOfDay, format, isSameDay, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuth } from '../lib/auth'
import {
  GoogleAuthError,
  canWriteCalendar,
  createEvent,
  deleteEvent,
  hasFreshGoogleToken,
  isAllDay,
  listCalendars,
  listEventsMulti,
  updateEvent,
  type EventInput,
  type GCalendar,
  type GEvent,
} from '../lib/google'
import { fetchSettings, saveSettings } from '../lib/settings'
import { ReconnectGoogle } from '../components/ReconnectGoogle'
import { SubTabs } from '../components/SubTabs'
import { Journee } from './Journee'

export type ViewMode = 'jour' | 'roulant'
type EditorState = { event: GEvent | null } | null

/**
 * La vue large couvre 7 jours GLISSANTS, à partir d'aujourd'hui.
 *
 * Une semaine calendaire lundi→dimanche a un défaut de fond quand on s'en sert
 * pour préparer : le dimanche, elle n'affiche plus qu'un jour devant soi, et le
 * lundi elle en affiche sept — alors que la question posée est toujours la même,
 * « qu'est-ce qui arrive dans les jours qui viennent ». La fenêtre glissante y
 * répond pareil tous les jours. Même raisonnement que la charge d'entraînement
 * et le compteur de séances, qui glissent déjà.
 */
export const FENETRE_JOURS = 7

const VUES: Array<{ id: ViewMode; label: string }> = [
  { id: 'jour', label: 'Jour' },
  { id: 'roulant', label: `${FENETRE_JOURS} jours` },
]

/**
 * La plage couverte par la vue, l'ancre étant son PREMIER jour.
 *
 * L'ancre en tête plutôt qu'au milieu : « Aujourd'hui » remet ainsi aujourd'hui
 * en haut de la liste, et « ‹ / › » décale d'une fenêtre entière sans jamais
 * réafficher un jour déjà vu.
 */
export function fenetreAgenda(ancre: Date, vue: ViewMode) {
  const jours = vue === 'jour' ? 1 : FENETRE_JOURS
  return { start: startOfDay(ancre), end: endOfDay(addDays(ancre, jours - 1)), jours }
}

// Hub Agenda : « Ma journée » (résumé + tâches du jour) et le calendrier complet.
export function Agenda() {
  const [tab, setTab] = useState<'journee' | 'calendrier'>('journee')
  return (
    <div className="space-y-4">
      <SubTabs
        tabs={[
          { id: 'journee', label: '🗓️ Ma journée' },
          { id: 'calendrier', label: '📅 Calendrier' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === 'journee' ? <Journee /> : <AgendaCalendar />}
    </div>
  )
}

function AgendaCalendar() {
  const { user } = useAuth()
  const [needAuth, setNeedAuth] = useState(!hasFreshGoogleToken())
  const [calendars, setCalendars] = useState<GCalendar[]>([])
  const [visible, setVisible] = useState<Set<string>>(new Set())
  const [events, setEvents] = useState<GEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anchor, setAnchor] = useState(() => new Date())
  const [view, setView] = useState<ViewMode>('roulant')
  const [editor, setEditor] = useState<EditorState>(null)
  const [reload, setReload] = useState(0)

  const range = useMemo(() => fenetreAgenda(anchor, view), [anchor, view])

  const writableCalendars = useMemo(() => calendars.filter(canWriteCalendar), [calendars])

  // Chargement initial : calendriers + préférences de visibilité.
  useEffect(() => {
    if (!hasFreshGoogleToken()) {
      setNeedAuth(true)
      return
    }
    ;(async () => {
      try {
        const [cals, settings] = await Promise.all([
          listCalendars(),
          user ? fetchSettings(user.id) : Promise.resolve(null),
        ])
        setCalendars(cals)
        const saved = settings?.visible_calendar_ids ?? []
        setVisible(new Set(saved.length ? saved : cals.map((c) => c.id)))
      } catch (e) {
        if (e instanceof GoogleAuthError) setNeedAuth(true)
        else setError((e as Error).message)
      }
    })()
  }, [user])

  // Rechargement des événements quand la plage / les agendas visibles changent.
  useEffect(() => {
    if (needAuth || calendars.length === 0) return
    const shown = calendars.filter((c) => visible.has(c.id))
    if (shown.length === 0) {
      setEvents([])
      return
    }
    setLoading(true)
    setError(null)
    listEventsMulti(shown, range.start, range.end)
      .then(setEvents)
      .catch((e) => {
        if (e instanceof GoogleAuthError) setNeedAuth(true)
        else setError((e as Error).message)
      })
      .finally(() => setLoading(false))
  }, [calendars, visible, range.start, range.end, needAuth, reload])

  function toggleCalendar(id: string) {
    setVisible((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      if (user) saveSettings(user.id, { visible_calendar_ids: [...next] })
      return next
    })
  }

  function shift(dir: -1 | 1) {
    setAnchor((d) => addDays(d, dir * range.jours))
  }

  const days = useMemo(() => groupByDay(events, range.start, range.end), [events, range])

  if (needAuth) return <ReconnectGoogle />

  return (
    <div className="space-y-4">
      {/* Barre de navigation temporelle */}
      <div className="flex items-center gap-2">
        <button onClick={() => shift(-1)} className="btn-ghost px-3 py-2" aria-label="Précédent">
          ‹
        </button>
        <div className="flex-1 text-center">
          <div className="font-bold capitalize text-ink">{rangeLabel(range.start, range.end, view)}</div>
          <button onClick={() => setAnchor(new Date())} className="text-xs text-copper hover:underline">
            Aujourd'hui
          </button>
        </div>
        <button onClick={() => shift(1)} className="btn-ghost px-3 py-2" aria-label="Suivant">
          ›
        </button>
      </div>

      {/* Bascule Jour / 7 jours + Nouvel événement */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-xl2 border border-line bg-card p-1 text-sm font-semibold">
          {VUES.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex-1 rounded-[10px] py-1.5 transition ${
                view === v.id ? 'bg-copper text-white' : 'text-muted'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {writableCalendars.length > 0 ? (
          <button onClick={() => setEditor({ event: null })} className="btn-primary shrink-0 px-4 py-2">
            + Événement
          </button>
        ) : null}
      </div>

      {/* Filtres d'agendas */}
      {calendars.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {calendars.map((c) => {
            const on = visible.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggleCalendar(c.id)}
                className="chip border transition"
                style={{
                  borderColor: c.backgroundColor || 'rgb(var(--line))',
                  background: on ? c.backgroundColor || 'rgb(var(--copper))' : 'transparent',
                  color: on ? '#fff' : 'rgb(var(--muted))',
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: c.backgroundColor || 'rgb(var(--copper))' }}
                />
                {c.summary}
              </button>
            )
          })}
        </div>
      ) : null}

      {error ? (
        <div className="card border-clay/40 bg-clay/5 p-4 text-sm text-clay">{error}</div>
      ) : null}

      {loading ? <div className="animate-pulse text-sm text-muted">Chargement…</div> : null}

      {/* Liste des événements groupés par jour */}
      <div className="space-y-5">
        {days.map(({ day, items }) => (
          <div key={day.toISOString()}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-sm font-bold capitalize text-ink">
                {format(day, 'EEEE d MMMM', { locale: fr })}
              </span>
              {isSameDay(day, new Date()) ? (
                <span className="chip bg-sage/15 text-sage-dark">aujourd'hui</span>
              ) : null}
            </div>
            {items.length === 0 ? (
              <div className="text-xs text-muted">—</div>
            ) : (
              <ul className="space-y-2">
                {items.map((e) => (
                  <EventRow key={e.calendarId + e.id} e={e} day={day} onClick={() => setEditor({ event: e })} />
                ))}
              </ul>
            )}
          </div>
        ))}
        {!loading && days.every((d) => d.items.length === 0) ? (
          <div className="card p-6 text-center text-sm text-muted">
            Aucun événement sur cette période. 🌤️
          </div>
        ) : null}
      </div>

      {editor ? (
        <EventEditor
          event={editor.event}
          calendars={writableCalendars}
          defaultDate={anchor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            setReload((n) => n + 1)
          }}
        />
      ) : null}
    </div>
  )
}

function EventRow({ e, day, onClick }: { e: GEvent; day: Date; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="card flex w-full items-stretch gap-3 overflow-hidden p-0 text-left transition hover:shadow-lift"
      >
        <span className="w-1.5 shrink-0" style={{ background: e.calendarColor || 'rgb(var(--copper))' }} />
        <div className="min-w-0 flex-1 py-2.5 pr-3">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-xs font-semibold text-copper">{eventDayLabel(e, day)}</span>
            <span className="truncate font-semibold text-ink">{e.summary || '(sans titre)'}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            <span className="truncate">{e.calendarSummary}</span>
            {e.location ? <span className="truncate">· 📍 {e.location}</span> : null}
          </div>
        </div>
      </button>
    </li>
  )
}

// ---------- Éditeur d'événement ----------

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

function EventEditor({
  event,
  calendars,
  defaultDate,
  onClose,
  onSaved,
}: {
  event: GEvent | null
  calendars: GCalendar[]
  defaultDate: Date
  onClose: () => void
  onSaved: () => void
}) {
  const editing = !!event
  const initAllDay = event ? isAllDay(event) : false
  const startD = event ? new Date(event.start.dateTime || event.start.date || defaultDate) : defaultDate
  const endD = event?.end?.dateTime ? new Date(event.end.dateTime) : null

  const [summary, setSummary] = useState(event?.summary ?? '')
  const [calendarId, setCalendarId] = useState(
    event?.calendarId ?? calendars.find((c) => c.primary)?.id ?? calendars[0]?.id ?? '',
  )
  const initEndDate = event
    ? format(isAllDay(event) ? eventEndDay(event) : endD ?? startD, 'yyyy-MM-dd')
    : format(startD, 'yyyy-MM-dd')

  const [allDay, setAllDay] = useState(initAllDay)
  const [date, setDate] = useState(format(startD, 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(initEndDate)
  const [startTime, setStartTime] = useState(initAllDay ? '09:00' : format(startD, 'HH:mm'))
  const [endTime, setEndTime] = useState(endD ? format(endD, 'HH:mm') : '10:00')
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function buildInput(): EventInput {
    const lastDay = endDate < date ? date : endDate // jamais avant le début
    const base = {
      summary: summary.trim() || '(sans titre)',
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    }
    if (allDay) {
      return { ...base, start: { date }, end: { date: addDayStr(lastDay) } } // fin exclusive
    }
    return {
      ...base,
      start: { dateTime: new Date(`${date}T${startTime}:00`).toISOString(), timeZone: TZ },
      end: { dateTime: new Date(`${lastDay}T${endTime}:00`).toISOString(), timeZone: TZ },
    }
  }

  async function save() {
    setBusy(true)
    setErr(null)
    try {
      const input = buildInput()
      if (editing && event) await updateEvent(event.calendarId, event.id, input)
      else await createEvent(calendarId, input)
      onSaved()
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  async function remove() {
    if (!event) return
    if (!confirm('Supprimer cet événement ?')) return
    setBusy(true)
    setErr(null)
    try {
      await deleteEvent(event.calendarId, event.id)
      onSaved()
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-b-none p-5 sm:rounded-xl2"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-ink">{editing ? 'Modifier' : 'Nouvel événement'}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <input
            className="field"
            placeholder="Titre"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            autoFocus
          />

          {!editing ? (
            <select className="field" value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-xs text-muted">Agenda : {event?.calendarSummary}</div>
          )}

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            Toute la journée
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">
              Début
              <input className="field mt-0.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="text-xs text-muted">
              Fin
              <input className="field mt-0.5" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>

          {!allDay ? (
            <div className="flex items-center gap-2">
              <input className="field" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <span className="text-muted">→</span>
              <input className="field" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          ) : null}

          <input
            className="field"
            placeholder="Lieu (optionnel)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <textarea
            className="field min-h-[70px]"
            placeholder="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {err ? <div className="rounded-xl2 bg-clay/10 p-2 text-xs text-clay">{err}</div> : null}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={busy} className="btn-primary flex-1">
              {busy ? '…' : 'Enregistrer'}
            </button>
            {editing ? (
              <button onClick={remove} disabled={busy} className="btn border border-clay/50 text-clay">
                Supprimer
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function addDayStr(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return format(d, 'yyyy-MM-dd')
}

/** Dernier jour réellement couvert par un événement (gère la fin exclusive des all-day). */
function eventEndDay(e: GEvent): Date {
  if (e.end?.dateTime) return startOfDay(new Date(e.end.dateTime))
  if (e.end?.date) return startOfDay(new Date(new Date(e.end.date).getTime() - 1)) // fin exclusive
  return startOfDay(new Date(e.start.dateTime || e.start.date || ''))
}

function eventStartDay(e: GEvent): Date {
  return startOfDay(new Date(e.start.dateTime || e.start.date || ''))
}

/** Un événement multi-jours apparaît sur chaque jour qu'il couvre. */
export function groupByDay(events: GEvent[], start: Date, end: Date) {
  const days: { day: Date; items: GEvent[] }[] = []
  for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) {
    const day = new Date(d)
    const items = events.filter((e) => {
      const s = eventStartDay(e)
      const en = eventEndDay(e)
      return day >= s && day <= en
    })
    days.push({ day, items })
  }
  return days
}

/** Étiquette horaire selon le jour : heure le jour de début, flèche les jours suivants. */
function eventDayLabel(e: GEvent, day: Date): string {
  if (isAllDay(e)) {
    return isSameDay(eventStartDay(e), eventEndDay(e)) ? 'Journée' : '◆ jour'
  }
  if (isSameDay(eventStartDay(e), day)) return timeRange(e)
  return '↔'
}

export function rangeLabel(start: Date, end: Date, view: ViewMode): string {
  if (view === 'jour') return format(start, 'EEEE d MMMM', { locale: fr })
  // « Aujourd'hui » en tête plutôt que la date : c'est le repère qu'on cherche
  // dans une fenêtre glissante, et il dit d'un coup d'œil qu'on n'a pas dérivé.
  const debut = isSameDay(start, new Date()) ? "Auj." : format(start, 'd MMM', { locale: fr })
  return `${debut} – ${format(end, 'd MMM', { locale: fr })}`
}

function timeRange(e: GEvent): string {
  const s = e.start.dateTime ? new Date(e.start.dateTime) : null
  if (!s) return ''
  return format(s, 'HH:mm')
}
