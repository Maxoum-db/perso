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
import { fmtTonnage, listCatalog, listSessions, sessionTonnage, type CatalogExercise, type MuscuSession } from '../lib/muscu'
import { listWeighins, type Weighin } from '../lib/workouts'
import { loadFocus, FOCUS_PAR_DEFAUT, loadBehourd, type FocusId } from '../lib/focus'
// `fmtDuree` : le même formateur que pour la durée d'une séance — « 45 min », « 1 h 30 ».
import { DUREE_PAR_DEFAUT, fmtDuree, loadDuree } from '../lib/duree'
import { prochaineSeance, type ContexteSeance } from '../lib/prochaine'
import { finDeJournee, fmtCreneau, premierCreneau, type Occupe } from '../lib/creneau'
import { chargesCourantes } from '../lib/charges'
import { listSorties, sortiesEnSeances, type Sortie } from '../lib/course'
import { etatParZone, fmtDelai, reposParMuscle, type EtatZone } from '../lib/recuperation'
import { tronquerZones } from '../lib/muscles'
import { loadCourbatures, type Courbatures } from '../lib/soreness'
import { loadNuits, type Nuits } from '../lib/sommeil'
import { recoveryColor } from '../components/MuscleBodyDiagram'
import { loadLive } from './MusculationLive'
import {
  fetchNotionDuJour,
  RUSTIQUE_RATING_BUTTONS,
  submitRustiqueReview,
  type RustiqueNotion,
  type RustiqueRating,
} from '../lib/rustique'

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
  // Les mêmes corrections que dans le module Musculation : sans elles, l'accueil
  // annoncerait « prêt » sur un muscle que tu viens de déclarer courbaturé.
  const [courbatures, setCourbatures] = useState<Courbatures>({})
  const [nuits, setNuits] = useState<Nuits>({})
  // De quoi composer la MÊME séance que le module : sans ces réglages, l'accueil
  // en proposerait une autre, et on ne saurait pas laquelle croire.
  const [catalog, setCatalog] = useState<CatalogExercise[]>([])
  const [weighins, setWeighins] = useState<Weighin[]>([])
  const [focus, setFocus] = useState<FocusId[]>([FOCUS_PAR_DEFAUT])
  const [behourd, setBehourd] = useState(false)
  const [creneau, setCreneau] = useState(DUREE_PAR_DEFAUT)
  const [sorties, setSorties] = useState<Sortie[]>([])
  const [notion, setNotion] = useState<RustiqueNotion | null>(null)

  useEffect(() => {
    if (!user) return
    listBrews(user.id)
      .then(setBrews)
      .catch(() => {})
    listSessions(user.id, 40)
      .then(setMuscu)
      .catch(() => {})
    // Les sorties de course, à part. Elles pèsent sur la RÉCUPÉRATION — courir
    // travaille des muscles — mais ne sont ni la dernière séance de l'accueil,
    // ni du tonnage : elles ont leur propre écran (voir lib/course).
    listSorties(user.id)
      .then(setSorties)
      .catch(() => {})
    loadCourbatures(user.id).then(setCourbatures).catch(() => {})
    loadNuits(user.id).then(setNuits).catch(() => {})
    listCatalog(user.id).then(setCatalog).catch(() => {})
    listWeighins(user.id).then(setWeighins).catch(() => {})
    loadFocus(user.id).then(setFocus).catch(() => {})
    loadBehourd(user.id).then(setBehourd).catch(() => {})
    loadDuree(user.id).then(setCreneau).catch(() => {})
    fetchNotionDuJour()
      .then((r) => setNotion(r.status === 'ok' ? r.notion : null))
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
      <AujourdhuiCard
        events={events}
        sessions={muscu}
        sorties={sorties}
        courbatures={courbatures}
        nuits={nuits}
        agendaVisible={!needAuth}
        contexte={{ catalog, sessions: muscu, weighins, bodyWeight: weighins[0]?.weight_kg ?? null, focus, behourd, duree: creneau }}
      />

      {notion ? <NotionDuJourCard notion={notion} /> : null}

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
export function AujourdhuiCard({
  events,
  sessions,
  courbatures,
  nuits,
  agendaVisible,
  contexte,
  sorties,
}: {
  events: GEvent[] | null
  sessions: MuscuSession[]
  courbatures: Courbatures
  nuits: Nuits
  agendaVisible: boolean
  /** De quoi composer la séance — sans les charges, calculées juste en dessous. */
  contexte: Omit<ContexteSeance, 'loads'>
  /** Sorties de course, converties pour la seule récupération. */
  sorties: Sortie[]
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
            <Journee events={events} />
          )}
        </Link>
      ) : null}
      <MuscuMoitie sessions={sessions} sorties={sorties} courbatures={courbatures} nuits={nuits} contexte={contexte} events={events} />
    </div>
  )
}

/**
 * La journée, détaillée.
 *
 * Une heure de début et un titre ne suffisaient pas à décider quoi que ce soit :
 * il manquait ce qui est DÉJÀ passé, ce qui est en cours, dans combien de temps
 * arrive la prochaine chose, et combien de temps elle prend. C'est précisément
 * ce qu'on regarde pour savoir s'il reste un créneau pour aller à la salle.
 */
function Journee({ events }: { events: GEvent[] }) {
  const maintenant = Date.now()
  const lignes = events.slice(0, 5).map((e) => {
    const debut = e.start.dateTime ? new Date(e.start.dateTime).getTime() : null
    const fin = e.end?.dateTime ? new Date(e.end.dateTime).getTime() : null
    return {
      e,
      debut,
      passe: fin !== null && fin < maintenant,
      encours: debut !== null && fin !== null && debut <= maintenant && fin >= maintenant,
      minutes: debut !== null && fin !== null ? Math.round((fin - debut) / 60000) : null,
    }
  })
  // Le prochain, et lui seul, porte le compte à rebours : le mettre sur tous
  // reviendrait à afficher une colonne de plus, pas à mettre en avant.
  const prochain = lignes.find((l) => !l.passe && !l.encours && l.debut !== null)

  return (
    <ul className="mt-3 space-y-2">
      {lignes.map((l) => (
        <li key={l.e.calendarId + l.e.id} className={l.passe ? 'opacity-45' : ''}>
          <div className="flex items-baseline gap-3">
            <span className={`w-14 shrink-0 text-xs font-semibold ${l.encours ? 'text-clay' : 'text-copper'}`}>
              {isAllDay(l.e) ? 'jour' : timeOf(l.e.start.dateTime!)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{l.e.summary || '(sans titre)'}</span>
            {l.encours ? (
              <span className="shrink-0 text-xs font-semibold text-clay">en cours</span>
            ) : l === prochain ? (
              <span className="shrink-0 text-xs font-semibold text-copper">{dansCombien(l.debut! - maintenant)}</span>
            ) : null}
          </div>
          {l.minutes !== null || l.e.location ? (
            <div className="ml-[4.25rem] truncate text-[11px] text-muted">
              {l.minutes !== null ? fmtDuree(l.minutes) : ''}
              {l.minutes !== null && l.e.location ? ' · ' : ''}
              {l.e.location ?? ''}
            </div>
          ) : null}
        </li>
      ))}
      {events.length > 5 ? <li className="text-xs text-muted">+ {events.length - 5} autre(s)…</li> : null}
    </ul>
  )
}

/** « dans 25 min », « dans 2 h 10 » — au-delà de la journée ça ne sert plus. */
function dansCombien(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 1) return 'maintenant'
  return `dans ${fmtDuree(min)}`
}

/**
 * Moitié muscu : séance en cours à reprendre, sinon dernière séance + ÉTAT DU
 * CORPS.
 *
 * Elle affichait avant le cumul des trente derniers jours — nombre de séances et
 * tonnage. C'était de l'histoire : vrai, mais sans effet sur ce qu'on décide en
 * ouvrant l'application le matin. La question qu'on se pose est « je peux faire
 * quoi aujourd'hui », et l'application connaît la réponse muscle par muscle sans
 * jamais la dire ailleurs que dans le mannequin, à deux écrans d'ici.
 */
function MuscuMoitie({
  sessions,
  sorties,
  courbatures,
  nuits,
  contexte,
  events,
}: {
  sessions: MuscuSession[]
  courbatures: Courbatures
  nuits: Nuits
  contexte: Omit<ContexteSeance, 'loads'>
  /** Sorties de course, converties pour la seule récupération. */
  sorties: Sortie[]
  events: GEvent[] | null
}) {
  const live = loadLive()
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

  // Courir travaille des muscles : le mannequin et la séance proposée doivent
  // le savoir. Les sorties entrent ici CONVERTIES, et nulle part ailleurs.
  const loads = chargesCourantes(
    [...sessions, ...sortiesEnSeances(sorties)],
    courbatures,
    nuits,
    Date.now(),
    // Le poids de la série ne veut rien dire sans celui de la personne : c'est
    // la dernière pesée qui donne son échelle au mannequin (cf. `lib/effort`).
    contexte.bodyWeight,
  )
  const zones = etatParZone(reposParMuscle(loads))
  // La même séance que le module en proposerait : c'est `composerSeance` qui
  // porte le réglage, une fois pour les deux écrans.
  const prochaine = contexte.catalog.length ? prochaineSeance({ ...contexte, loads }, zones) : null
  // Les prêtes, la plus fraîche d'abord : c'est celle qu'on a le plus négligée,
  // donc la meilleure candidate du jour.
  // Tronquées : depuis le découpage fin, une bonne journée en rend une quinzaine
  // prêtes d'un coup, et quinze pastilles ne se lisent plus. Les plus fraîches
  // sont aussi les plus intéressantes, l'ordre fait donc le tri tout seul.
  const pretes = tronquerZones(zones.filter((z) => z.pret).sort((a, b) => b.jours - a.jours))
  // Celles qui reviennent, par DÉLAI et non par état : « revient » annonce une
  // date, et les zones ne récupèrent pas à la même vitesse — trier sur les jours
  // ressentis aurait mis en tête une zone qui revient plus tard qu'une autre
  // affichée en dessous.
  const enRecup = tronquerZones(zones.filter((z) => !z.pret).sort((a, b) => a.reste - b.reste), 3)

  // Deux liens et non un seul, comme l'agenda et la muscu plus haut : l'état du
  // corps mène au module, la séance proposée mène au module AVEC elle déjà
  // composée. Un lien dans un lien n'étant pas du HTML valide, ils sont
  // juxtaposés — d'où la dernière séance remontée avant la proposition, où elle
  // se lit d'ailleurs bien : état du corps, ce qu'on a fait, ce qu'on va faire.
  return (
    <>
    <Link to="/musculation" className="block p-4 transition hover:bg-copper/5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">💪 Musculation</div>
        <span className="text-xs font-semibold text-copper">▶️ Démarrer</span>
      </div>

      {pretes.visibles.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="shrink-0 text-xs font-semibold text-sage-dark">✅ Prêt</span>
          {pretes.visibles.map((z) => (
            <Pastille key={z.zone} etat={z} />
          ))}
          {pretes.reste > 0 ? <span className="text-xs text-muted">+{pretes.reste}</span> : null}
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted">Tout est encore en récupération. 🌙</div>
      )}

      {enRecup.visibles.length > 0 ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="shrink-0 text-xs font-semibold text-muted">⏳ Revient</span>
          {enRecup.visibles.map((z) => (
            <Pastille key={z.zone} etat={z} delai />
          ))}
          {enRecup.reste > 0 ? <span className="text-xs text-muted">+{enRecup.reste}</span> : null}
        </div>
      ) : null}

      {/* La dernière séance situe l'état du corps dans le temps. Sans elle,
          « jambes prêtes » ne dit pas si c'est parce qu'elles ont récupéré ou
          parce qu'on ne les a pas touchées depuis trois semaines. */}
      <div className="mt-2 flex items-baseline gap-2 border-t border-line/40 pt-2 text-xs text-muted">
        <span className="shrink-0">
          Dernière · {new Date(last.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
        <span className="min-w-0 flex-1 truncate text-ink">{last.name}</span>
        {sessionTonnage(last.exercises) > 0 ? (
          <span className="shrink-0">🏋️ {fmtTonnage(sessionTonnage(last.exercises))}</span>
        ) : null}
      </div>
    </Link>

    {prochaine ? (
      /* `state` plutôt qu'un paramètre d'URL : la demande n'a de sens qu'une
         fois, au moment du clic. Dans l'adresse, elle survivrait au partage du
         lien et à un rafraîchissement, et recomposerait une séance qu'on n'a
         pas demandée. */
      <Link
        to="/musculation"
        state={{ composer: true }}
        className="block border-t border-line/60 p-4 pt-3 transition hover:bg-copper/5"
      >
        <Prochaine p={prochaine} events={events} />
      </Link>
    ) : null}
    </>
  )
}

/**
 * La séance à faire, et quand la faire.
 *
 * « Quand » a deux réponses, et il faut les deux. Le JOUR vient du corps : le
 * générateur signale lui-même quand il a dû assouplir sa règle faute de muscle
 * disponible, et c'est exactement le signal « pas aujourd'hui ». Le CRÉNEAU vient
 * de l'agenda croisé avec la durée estimée de la séance — c'est la seule question
 * qui restait, et on y répondait en ouvrant l'agenda pour compter les trous.
 */
function Prochaine({ p, events }: { p: ReturnType<typeof prochaineSeance>; events: GEvent[] | null }) {
  if (!p) return null
  const { session, attente, frein, dejaFait } = p
  const maintenant = Date.now()
  // Les journées entières n'occupent pas de créneau : un anniversaire ne
  // t'empêche pas d'aller à la salle.
  const occupes: Occupe[] = (events ?? [])
    .filter((e) => e.start.dateTime && e.end?.dateTime)
    .map((e) => ({ debut: new Date(e.start.dateTime!).getTime(), fin: new Date(e.end!.dateTime!).getTime() }))
  // Pas de créneau quand la journée est déjà faite : chercher une place pour une
  // séance qu'on ne fera pas, c'est inviter à en faire une deuxième.
  const creneau =
    attente === 0 && !dejaFait
      ? premierCreneau(occupes, session.bilan.duree, maintenant, finDeJournee(maintenant))
      : null

  return (
    <div>
      {/* Le nom prend la ligne entière : « Séance Core · Avant-bras · Pectoraux »
          est déjà long, et tronqué il ne dit plus quelles zones sont visées —
          c'est pourtant toute l'information. Le compte et la durée descendent
          avec le quand, où ils tiennent sans se battre pour la place. */}
      <div className="flex items-baseline gap-2 text-sm">
        <span className="shrink-0 text-xs font-semibold text-copper">🧠 À faire</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{session.name}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-muted">
        {/* Une séance par jour. Le corps a beau être frais, si c'est fait c'est
            fait — et l'accueil affiche justement cette séance-là juste en
            dessous. Les deux faits restent séparés : quand le corps demande plus
            d'un jour, c'est lui qui parle, pas le calendrier. */}
        {dejaFait ? (
          attente > 1 ? (
            <>
              ✅ séance faite · la prochaine dans <b className="text-ink">{fmtDelai(attente)}</b>
              {frein ? ` — le temps que ${frein.toLowerCase()} revienne` : ''}
            </>
          ) : (
            <>
              ✅ séance faite aujourd'hui · la prochaine <b className="text-ink">demain</b>
            </>
          )
        ) : attente > 0 ? (
          <>
            ⏳ plutôt dans <b className="text-ink">{fmtDelai(attente)}</b>
            {frein ? ` — le temps que ${frein.toLowerCase()} revienne` : ''}
          </>
        ) : creneau ? (
          <>
            ✅ aujourd'hui · créneau <b className="text-ink">{fmtCreneau(creneau)}</b>
          </>
        ) : (
          <>✅ aujourd'hui, mais la journée est pleine — à caler demain matin</>
        )}
        {' · '}
        {session.exercises.length} exos · {fmtDuree(session.bilan.duree)}
      </div>
    </div>
  )
}

/**
 * Une zone, avec la couleur qu'elle a sur le mannequin.
 *
 * La pastille n'est pas décorative : c'est le même barème et la même rampe qu'à
 * deux écrans d'ici, donc le vert d'ici est le vert de là-bas. Une couleur
 * inventée pour l'accueil aurait obligé à réapprendre l'échelle.
 */
function Pastille({ etat, delai = false }: { etat: EtatZone; delai?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: recoveryColor(etat.jours) }} />
      <span className="text-ink">{etat.zone}</span>
      {delai ? <span className="text-xs text-muted">{fmtDelai(etat.reste)}</span> : null}
    </span>
  )
}

/**
 * La notion du jour : une carte à réviser (priorité au thème le plus en
 * retard) ou, à défaut, une carte jamais étudiée. Réponse repliée par défaut
 * pour forcer le rappel actif avant de la révéler, puis les MÊMES 4 boutons
 * qu'au Quiz — noter ici avance le même planning FSRS que dans Rustique,
 * sans avoir à quitter l'accueil pour la seule notion du jour.
 */
function NotionDuJourCard({ notion }: { notion: RustiqueNotion }) {
  const [revele, setRevele] = useState(false)
  const [rated, setRated] = useState<RustiqueRating | null>(null)
  const [sending, setSending] = useState(false)

  async function rate(r: RustiqueRating) {
    setSending(true)
    try {
      await submitRustiqueReview(notion.card.id, r)
      setRated(r)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-4 pb-0">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: notion.theme.color }} />
          <span className="truncate">🧠 Notion du jour · {notion.theme.title}</span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            notion.isNew ? 'bg-sage/20 text-sage' : 'bg-copper/20 text-copper'
          }`}
        >
          {notion.isNew ? 'nouveau' : 'à réviser'}
        </span>
      </div>

      <div className="p-4">
        <div className="whitespace-pre-wrap text-sm font-semibold text-ink">{notion.card.front}</div>

        {!revele ? (
          <button onClick={() => setRevele(true)} className="btn-ghost mt-2 px-3 py-1.5 text-xs">
            Voir la réponse
          </button>
        ) : (
          <>
            <div className="mt-2 whitespace-pre-wrap border-t border-line/60 pt-2 text-sm text-ink">{notion.card.back}</div>

            {rated ? (
              <p className="mt-3 text-xs text-sage">✓ Notée — {RUSTIQUE_RATING_BUTTONS.find((b) => b.rating === rated)?.label}</p>
            ) : (
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {RUSTIQUE_RATING_BUTTONS.map((b) => (
                  <button
                    key={b.rating}
                    onClick={() => rate(b.rating)}
                    disabled={sending}
                    className={`rounded-xl2 py-2 text-[11px] font-semibold ${b.className}`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Link
        to="/rustique"
        state={{ openTheme: notion.theme.id, openCard: notion.card.id }}
        className="block border-t border-line/60 p-3 text-center text-xs font-semibold text-copper transition hover:bg-copper/5"
      >
        Voir dans Apprentissage →
      </Link>
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
