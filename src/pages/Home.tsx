import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  GoogleAuthError,
  hasFreshGoogleToken,
  listCalendars,
  listEventsMulti,
  listUpcomingBirthdays,
  type Birthday,
  type GEvent,
  isAllDay,
} from '../lib/google'
import { ReconnectGoogle } from '../components/ReconnectGoogle'

export function Home() {
  const { user } = useAuth()
  const [events, setEvents] = useState<GEvent[] | null>(null)
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [needAuth, setNeedAuth] = useState(!hasFreshGoogleToken())
  const [error, setError] = useState<string | null>(null)

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
  }, [])

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

      {error ? (
        <div className="card border-clay/40 bg-clay/5 p-4 text-sm text-clay">{error}</div>
      ) : null}

      {birthdays.length > 0 ? (
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">🎂 Anniversaires à venir</div>
          <ul className="mt-2 space-y-1">
            {birthdays.map((b, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <span className="w-20 shrink-0 text-xs font-semibold text-copper">
                  {b.inDays === 0 ? "aujourd'hui" : b.inDays === 1 ? 'demain' : `dans ${b.inDays} j`}
                </span>
                <span className="truncate text-ink">{b.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <QuickCard to="/journee" title="Ma journée" subtitle="Agenda + tâches + habitudes" emoji="🗓️" />
        <QuickCard to="/notes" title="Notes" subtitle="Perso · psy · dictée 🎤" emoji="📝" />
        <QuickCard to="/humeur" title="Humeur" subtitle="Journal du jour" emoji="😊" />
        <QuickCard to="/habitudes" title="Habitudes" subtitle="Séries 🔥" emoji="🔁" />
        <QuickCard to="/taches" title="Tâches" subtitle="To-do Google ✅" emoji="✅" />
        <QuickCard to="/mails" title="Mails" subtitle="Gmail" emoji="📧" />
        <QuickCard to="/drive" title="Synthèses" subtitle="NotebookLM · Plaud" emoji="📁" />
        <QuickCard to="/behourd" title="Béhourd" subtitle="Armure · entraînement" emoji="🛡️" />
        <QuickCard to="/musculation" title="Musculation" subtitle="Basic Fit · PPL" emoji="💪" />
        <QuickCard to="/carnet" title="Carnet" subtitle="Poids · séances" emoji="📓" />
        <QuickCard to="/reglages" title="Réglages" subtitle="Dossier & agendas" emoji="⚙️" />
      </div>
    </div>
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
