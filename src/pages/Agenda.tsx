import { useEffect, useMemo, useState } from 'react'
import {
  addDays,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuth } from '../lib/auth'
import {
  GoogleAuthError,
  hasFreshGoogleToken,
  isAllDay,
  listCalendars,
  listEventsMulti,
  type GCalendar,
  type GEvent,
} from '../lib/google'
import { fetchSettings, saveSettings } from '../lib/settings'
import { ReconnectGoogle } from '../components/ReconnectGoogle'

type ViewMode = 'jour' | 'semaine'

export function Agenda() {
  const { user } = useAuth()
  const [needAuth, setNeedAuth] = useState(!hasFreshGoogleToken())
  const [calendars, setCalendars] = useState<GCalendar[]>([])
  const [visible, setVisible] = useState<Set<string>>(new Set())
  const [events, setEvents] = useState<GEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anchor, setAnchor] = useState(() => new Date())
  const [view, setView] = useState<ViewMode>('jour')

  const range = useMemo(() => {
    if (view === 'jour') {
      return { start: startOfDay(anchor), end: endOfDay(anchor) }
    }
    return {
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    }
  }, [anchor, view])

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

  // Rechargement des événements quand la plage ou les calendriers visibles changent.
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
  }, [calendars, visible, range.start, range.end, needAuth])

  function toggleCalendar(id: string) {
    setVisible((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      if (user) saveSettings(user.id, { visible_calendar_ids: [...next] })
      return next
    })
  }

  function shift(dir: -1 | 1) {
    setAnchor((d) => addDays(d, dir * (view === 'jour' ? 1 : 7)))
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
          <div className="font-bold capitalize text-navy">{rangeLabel(range.start, range.end, view)}</div>
          <button onClick={() => setAnchor(new Date())} className="text-xs text-copper hover:underline">
            Aujourd'hui
          </button>
        </div>
        <button onClick={() => shift(1)} className="btn-ghost px-3 py-2" aria-label="Suivant">
          ›
        </button>
      </div>

      {/* Bascule Jour / Semaine */}
      <div className="flex rounded-xl2 border border-line bg-white p-1 text-sm font-semibold">
        {(['jour', 'semaine'] as ViewMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setView(m)}
            className={`flex-1 rounded-[10px] py-1.5 capitalize transition ${
              view === m ? 'bg-copper text-white' : 'text-muted'
            }`}
          >
            {m}
          </button>
        ))}
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
                  borderColor: c.backgroundColor || '#e0d6cc',
                  background: on ? (c.backgroundColor || '#b87333') : '#fff',
                  color: on ? '#fff' : '#7a6e63',
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: on ? '#fff' : c.backgroundColor || '#b87333' }}
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
              <span className="text-sm font-bold capitalize text-navy">
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
                  <EventRow key={e.calendarId + e.id} e={e} />
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
    </div>
  )
}

function EventRow({ e }: { e: GEvent }) {
  return (
    <li className="card flex items-stretch gap-3 overflow-hidden p-0">
      <span className="w-1.5 shrink-0" style={{ background: e.calendarColor || '#b87333' }} />
      <div className="min-w-0 flex-1 py-2.5 pr-3">
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-xs font-semibold text-copper">
            {isAllDay(e) ? 'Journée' : timeRange(e)}
          </span>
          <span className="truncate font-semibold text-ink">{e.summary || '(sans titre)'}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <span className="truncate">{e.calendarSummary}</span>
          {e.location ? <span className="truncate">· 📍 {e.location}</span> : null}
        </div>
      </div>
    </li>
  )
}

function groupByDay(events: GEvent[], start: Date, end: Date) {
  const days: { day: Date; items: GEvent[] }[] = []
  for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) {
    days.push({ day: new Date(d), items: [] })
  }
  for (const e of events) {
    const s = new Date(e.start.dateTime || e.start.date || '')
    const slot = days.find((x) => isSameDay(x.day, s))
    if (slot) slot.items.push(e)
    else if (days[0]) days[0].items.push(e) // événements multi-jours qui débordent
  }
  return days
}

function rangeLabel(start: Date, end: Date, view: ViewMode): string {
  if (view === 'jour') return format(start, 'EEEE d MMMM', { locale: fr })
  return `${format(start, 'd MMM', { locale: fr })} – ${format(end, 'd MMM', { locale: fr })}`
}

function timeRange(e: GEvent): string {
  const s = e.start.dateTime ? new Date(e.start.dateTime) : null
  if (!s) return ''
  return format(s, 'HH:mm')
}
