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
import { FENETRE_STATS, fmtTonnage, listSessions, seancesRecentes, sessionTonnage, type MuscuSession } from '../lib/muscu'
import { loadLive } from './MusculationLive'

export function Home() {
  const { user } = useAuth()
  const [events, setEvents] = useState<GEvent[] | null>(null)
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [tasks, setTasks] = useState<DueTask[]>([])
  const [coupleEvents, setCoupleEvents] = useState<SharedEvent[]>([])
  const [needAuth, setNeedAuth] = useState(!hasFreshGoogleToken())
  const [error, setError] = useState<string | null>(null)
  const [brews, setBrews] = useState<Brew[]>([])
  const [muscu, setMuscu] = useState<MuscuSession[]>([])

  useEffect(() => {
    if (!user) return
    listBrews(user.id)
      .then(setBrews)
      .catch(() => {})
    listSessions(user.id, 40)
      .then(setMuscu)
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

      {needAuth ? <ReconnectGoogle /> : null}

      {/* Ta journée en une carte : ce qui est prévu, et où en est le corps.
          Deux cartes séparées obligeaient à faire le lien soi-même — « j'ai un
          créneau à 18 h » d'un côté, « les jambes sont prêtes » de l'autre. Elles
          répondent à la même question, elles tiennent au même endroit.
          La carte n'est pas un lien : chaque moitié mène ailleurs, et un lien
          dans un lien n'est pas du HTML valide. */}
      <AujourdhuiCard events={events} sessions={muscu} agendaVisible={!needAuth} />

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

      {/* La grille de raccourcis a disparu. Elle menait exactement où mènent déjà
          la barre du bas et le menu « Plus » : trois chemins pour les mêmes
          destinations, occupant le tiers bas de l'écran sans porter la moindre
          information. L'accueil ne montre plus que ce qui a quelque chose à
          dire — ta journée, ce qu'il reste à faire, et ce qui est en cours. */}
    </div>
  )
}

/**
 * La carte du jour : agenda en haut, musculation en bas.
 *
 * Elle ne s'affiche que si l'une des deux moitiés a quelque chose à dire — une
 * carte vide sur un accueil, c'est du bruit. La moitié agenda disparaît quand
 * Google n'est pas connecté, sans emporter la moitié muscu avec elle : le
 * journal de séances ne dépend pas de Google.
 */
function AujourdhuiCard({
  events,
  sessions,
  agendaVisible,
}: {
  events: GEvent[] | null
  sessions: MuscuSession[]
  agendaVisible: boolean
}) {
  // Un élément JSX n'est JAMAIS null : tester `<MuscuMoitie/> === null` aurait
  // toujours été faux et la carte se serait affichée vide. On interroge donc les
  // données, comme le fait la moitié elle-même.
  const aDuMuscu = loadLive() !== null || sessions.length > 0
  if (!agendaVisible && !aDuMuscu) return null

  return (
    <div className="card divide-y divide-line/60 overflow-hidden">
      {agendaVisible ? (
        <Link to="/agenda" className="block p-5 transition hover:bg-copper/5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Aujourd'hui</div>
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
              {events.length > 4 ? <li className="text-xs text-muted">+ {events.length - 4} autre(s)…</li> : null}
            </ul>
          )}
        </Link>
      ) : null}
      <MuscuMoitie sessions={sessions} />
    </div>
  )
}

// Moitié muscu : séance en cours à reprendre, sinon dernière séance + stats du mois.
function MuscuMoitie({ sessions }: { sessions: MuscuSession[] }) {
  const live = loadLive()
  // Fenêtre glissante, comme dans le module Musculation : le premier du mois, un
  // compteur calendaire annonce « 0 séance » sans que rien n'ait changé.
  const recentes = seancesRecentes(sessions)
  const recentTonnage = recentes.reduce((sum, s) => sum + sessionTonnage(s.exercises), 0)
  const last = sessions[0]

  if (live) {
    return (
      <Link to="/musculation" className="block bg-copper/5 p-4 transition hover:bg-copper/10">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-clay" />
          💪 Musculation — séance en cours
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="font-bold text-ink">{live.name}</span>
          <span className="font-semibold text-copper">Reprendre ▸</span>
        </div>
      </Link>
    )
  }

  if (!last) return null

  return (
    <Link to="/musculation" className="block p-4 transition hover:bg-copper/5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">💪 Musculation</div>
        <span className="text-xs font-semibold text-copper">▶️ Démarrer</span>
      </div>
      <div className="mt-2 flex items-baseline gap-3 text-sm">
        <span className="w-20 shrink-0 text-xs font-semibold text-copper">
          {new Date(last.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
        <span className="min-w-0 flex-1 truncate text-ink">{last.name}</span>
        {sessionTonnage(last.exercises) > 0 ? (
          <span className="shrink-0 text-xs text-muted">🏋️ {fmtTonnage(sessionTonnage(last.exercises))}</span>
        ) : null}
      </div>
      <div className="mt-1 text-xs text-muted">
        {FENETRE_STATS} derniers jours : {recentes.length} séance{recentes.length > 1 ? 's' : ''}
        {recentTonnage > 0 ? ` · ${fmtTonnage(recentTonnage)} soulevés` : ''}
      </div>
    </Link>
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
