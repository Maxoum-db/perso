import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  GoogleAuthError,
  createEvent,
  hasFreshGoogleToken,
  listCalendars,
  listDueTasks,
  listEventsMulti,
  listUpcomingBirthdays,
  setTaskStatus,
  type Birthday,
  type DueTask,
  type GEvent,
  isAllDay,
} from '../lib/google'
import { ReconnectGoogle } from '../components/ReconnectGoogle'
import { BREW_STATUSES, listBrews, type Brew } from '../lib/brews'
import { getMySpace, listSharedEvents, type SharedEvent } from '../lib/space'

export function Home() {
  const { user } = useAuth()
  const [events, setEvents] = useState<GEvent[] | null>(null)
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [tasks, setTasks] = useState<DueTask[]>([])
  const [coupleEvents, setCoupleEvents] = useState<SharedEvent[]>([])
  const [needAuth, setNeedAuth] = useState(!hasFreshGoogleToken())
  const [error, setError] = useState<string | null>(null)
  const [brews, setBrews] = useState<Brew[]>([])

  useEffect(() => {
    if (!user) return
    listBrews(user.id)
      .then(setBrews)
      .catch(() => {})
    // Prochains événements du couple (espace partagé).
    getMySpace()
      .then((s) => (s ? listSharedEvents(s.spaceId) : []))
      .then((evs) => {
        const todayStr = new Date().toLocaleDateString('en-CA')
        setCoupleEvents(evs.filter((e) => e.date >= todayStr).slice(0, 3))
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    if (!hasFreshGoogleToken()) {
      setNeedAuth(true)
      return
    }
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    listCalendars()
      .then((cals) => listEventsMulti(cals, start, end))
      .then(setEvents)
      .catch((e) => {
        if (e instanceof GoogleAuthError) setNeedAuth(true)
        else setError(e.message)
      })

    // Anniversaires (échoue silencieusement si le scope contacts n'est pas encore accordé)
    listUpcomingBirthdays(45)
      .then((b) => setBirthdays(b.slice(0, 5)))
      .catch(() => {})

    // Tâches échues (en retard + aujourd'hui)
    listDueTasks()
      .then(setTasks)
      .catch(() => {})
  }, [])

  const [bdayDone, setBdayDone] = useState<Set<string>>(new Set())
  const [bdayMsg, setBdayMsg] = useState<string | null>(null)

  async function addBirthdayToAgenda(b: Birthday) {
    const key = `${b.month}-${b.day}-${b.name}`
    const pad = (n: number) => String(n).padStart(2, '0')
    const now = new Date()
    let y = now.getFullYear()
    if (new Date(y, b.month - 1, b.day) < new Date(y, now.getMonth(), now.getDate())) y += 1
    const dateStr = `${y}-${pad(b.month)}-${pad(b.day)}`
    const next = new Date(`${dateStr}T00:00:00`)
    next.setDate(next.getDate() + 1)
    try {
      await createEvent('primary', {
        summary: `🎂 Anniversaire ${b.name}`,
        start: { date: dateStr },
        end: { date: next.toISOString().slice(0, 10) },
        recurrence: ['RRULE:FREQ=YEARLY'],
      })
      setBdayDone((prev) => new Set(prev).add(key))
      setBdayMsg('Ajouté à ton agenda ✓')
    } catch {
      setBdayMsg('Reconnecte Google (Réglages) pour ajouter à l’agenda')
    }
    setTimeout(() => setBdayMsg(null), 2500)
  }

  async function completeTask(t: DueTask) {
    setTasks((prev) => prev.filter((x) => !(x.id === t.id && x.listId === t.listId)))
    try {
      await setTaskStatus(t.listId, t.id, 'completed')
    } catch {
      // en cas d'échec, on recharge pour refléter l'état réel
      listDueTasks().then(setTasks).catch(() => {})
    }
  }

  const firstName = (user?.user_metadata?.full_name || user?.email || '')
    .toString()
    .split(' ')[0]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">
          {greeting()}{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="text-sm text-muted">{prettyDate(new Date())}</p>
      </div>

      {needAuth ? (
        <ReconnectGoogle />
      ) : (
        <Link to="/agenda" className="card block p-5 transition hover:shadow-lift">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Aujourd'hui
          </div>
          {events === null ? (
            <div className="mt-2 animate-pulse text-sm text-muted">Chargement de l'agenda…</div>
          ) : events.length === 0 ? (
            <div className="mt-2 text-sm text-muted">Rien de prévu aujourd'hui. 🌤️</div>
          ) : (
            <ul className="mt-3 space-y-2">
              {events.slice(0, 4).map((e) => (
                <li key={e.calendarId + e.id} className="flex items-baseline gap-3">
                  <span className="w-14 shrink-0 text-xs font-semibold text-copper">
                    {isAllDay(e) ? 'jour' : timeOf(e.start.dateTime!)}
                  </span>
                  <span className="truncate text-sm text-ink">{e.summary || '(sans titre)'}</span>
                </li>
              ))}
              {events.length > 4 ? (
                <li className="text-xs text-muted">+ {events.length - 4} autre(s)…</li>
              ) : null}
            </ul>
          )}
        </Link>
      )}

      {tasks.length > 0 ? (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">✅ À faire</div>
            <Link to="/taches" className="text-xs font-semibold text-copper">
              Tout voir
            </Link>
          </div>
          <ul className="mt-2 space-y-1.5">
            {tasks.slice(0, 5).map((t) => {
              const overdue = t.due!.slice(0, 10) < new Date().toLocaleDateString('en-CA')
              return (
                <li key={t.listId + t.id} className="flex items-center gap-2 text-sm">
                  <button onClick={() => completeTask(t)} className="shrink-0 text-lg leading-none" title="Marquer comme fait">
                    ⬜
                  </button>
                  <span className="truncate text-ink">{t.title}</span>
                  <span className={`ml-auto shrink-0 text-xs ${overdue ? 'font-semibold text-clay' : 'text-copper'}`}>
                    {overdue ? 'en retard' : "aujourd'hui"}
                  </span>
                </li>
              )
            })}
            {tasks.length > 5 ? <li className="text-xs text-muted">+ {tasks.length - 5} autre(s)…</li> : null}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div className="card border-clay/40 bg-clay/5 p-4 text-sm text-clay">{error}</div>
      ) : null}

      {birthdays.length > 0 ? (
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">🎂 Anniversaires à venir</div>
          <ul className="mt-2 space-y-1">
            {birthdays.map((b, i) => {
              const key = `${b.month}-${b.day}-${b.name}`
              return (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-20 shrink-0 text-xs font-semibold text-copper">
                    {b.inDays === 0 ? "aujourd'hui" : b.inDays === 1 ? 'demain' : `dans ${b.inDays} j`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink">{b.name}</span>
                  {bdayDone.has(key) ? (
                    <span className="shrink-0 text-xs text-muted">✓ agenda</span>
                  ) : (
                    <button
                      onClick={() => addBirthdayToAgenda(b)}
                      className="btn-ghost shrink-0 px-2 py-1 text-xs"
                      title="Ajouter à l'agenda (chaque année)"
                    >
                      ＋ Agenda
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {bdayMsg ? <div className="mt-2 text-xs text-copper">{bdayMsg}</div> : null}
        </div>
      ) : null}

      {coupleEvents.length > 0 ? (
        <Link to="/partage" className="card block p-4 transition hover:shadow-lift">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">💕 À deux — à venir</div>
          <ul className="mt-2 space-y-1.5">
            {coupleEvents.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs font-semibold text-copper">
                  {new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  {e.time ? ` ${e.time}` : ''}
                </span>
                <span className="truncate text-ink">{e.title}</span>
              </li>
            ))}
          </ul>
        </Link>
      ) : null}

      <BrassageCard brews={brews} />

      <div className="grid grid-cols-2 gap-3">
        <QuickCard to="/notes" title="Notes" subtitle="Notes · humeur · synthèses" emoji="📝" />
        <QuickCard to="/listes" title="Listes" subtitle="Courses · à cocher ✅" emoji="🛒" />
        <QuickCard to="/taches" title="Tâches" subtitle="To-do Google ✅" emoji="✅" />
        <QuickCard to="/partage" title="À deux" subtitle="Listes · mots · agenda 💕" emoji="💕" />
        <QuickCard to="/mails" title="Mails" subtitle="Gmail" emoji="📧" />
        <QuickCard to="/behourd" title="Béhourd" subtitle="Armure · muscu · carnet" emoji="🛡️" />
        <QuickCard to="/brassage" title="Brassage" subtitle="Brassins · recettes 🍺" emoji="🍺" />
        <QuickCard to="/reglages" title="Réglages" subtitle="Dossier & agendas" emoji="⚙️" />
      </div>
    </div>
  )
}

// Dashboard brassage : brassins en cours (fermentation / maturation / embouteillé).
function BrassageCard({ brews }: { brews: Brew[] }) {
  const active = brews.filter((b) => ['fermentation', 'maturation', 'embouteille'].includes(b.status))
  if (active.length === 0) return null
  const meta = (s: string) => BREW_STATUSES.find((x) => x.id === s)
  const daysSince = (d: string) => Math.max(0, Math.round((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000))

  return (
    <Link to="/brassage" className="card block p-4 transition hover:shadow-lift">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">🍺 Brassins en cours</div>
      <ul className="mt-2 space-y-1.5">
        {active.slice(0, 4).map((b) => (
          <li key={b.id} className="flex items-center gap-2 text-sm">
            <span className="shrink-0">{meta(b.status)?.emoji}</span>
            <span className="truncate text-ink">{b.recipe_name || 'Brassin'}</span>
            <span className="ml-auto shrink-0 text-xs text-muted">
              {meta(b.status)?.label} · J+{daysSince(b.brew_date)}
            </span>
          </li>
        ))}
        {active.length > 4 ? <li className="text-xs text-muted">+ {active.length - 4} autre(s)…</li> : null}
      </ul>
    </Link>
  )
}

function QuickCard({
  to,
  title,
  subtitle,
  emoji,
}: {
  to: string
  title: string
  subtitle: string
  emoji: string
}) {
  return (
    <Link to={to} className="card flex flex-col p-4 transition hover:shadow-lift">
      <span className="text-xl">{emoji}</span>
      <span className="mt-1 text-sm font-bold text-ink">{title}</span>
      <span className="text-xs text-muted">{subtitle}</span>
    </Link>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function prettyDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
