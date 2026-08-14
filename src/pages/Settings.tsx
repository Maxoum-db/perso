import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { hasFreshGoogleToken } from '../lib/google'
import { fetchSettings, saveSettings, type Discipline, type PersoSettings } from '../lib/settings'
import { applyTextSize, readTextSize, TEXT_SIZES, type TextSize } from '../lib/textSize'
import { disablePush, enablePush, isStandalone, pushStatus, sendTestPush } from '../lib/push'
import { exporterSport, type ContexteExport, type PorteeExport } from '../lib/exportSport'
import { FENETRE_STATS, listCatalog, listSessions } from '../lib/muscu'
import { orphelins, resumeOrphelins, type Orphelin } from '../lib/orphelins'
import { listWeighins } from '../lib/workouts'
import { loadNuits } from '../lib/sommeil'
import { loadObservations } from '../lib/observations'
import { loadCourbatures } from '../lib/soreness'
import { loadProfil } from '../lib/profil'
import { loadBehourd, loadFocus } from '../lib/focus'
import {
  DEFAUT_NOUVEAU_COMPTE,
  enregistrerAcces,
  estProprietaire,
  listerComptes,
  PROPRIETAIRE,
  SECTIONS,
  type Acces,
  type Section,
} from '../lib/acces'

export function Settings() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [settings, setSettings] = useState<PersoSettings | null>(null)
  const connected = hasFreshGoogleToken()

  useEffect(() => {
    if (user) fetchSettings(user.id).then(setSettings)
  }, [user])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink">Réglages</h1>

      <TextSizeSection />

      <section className="card p-4">
        <h2 className="text-sm font-bold text-ink">Compte</h2>
        <p className="mt-1 text-sm text-ink">{user?.email}</p>
        <button onClick={signOut} className="btn-ghost mt-3 text-xs">
          Se déconnecter
        </button>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-bold text-ink">Connexion Google</h2>
        <p className="mt-1 flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              connected ? 'bg-sage' : 'bg-clay'
            }`}
          />
          {connected ? 'Connecté — Agenda & Drive accessibles' : 'Jeton expiré ou absent'}
        </p>
        <button onClick={signInWithGoogle} className="btn-ghost mt-3 text-xs">
          {connected ? 'Rafraîchir la connexion' : 'Reconnecter Google'}
        </button>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-bold text-ink">Dossier de synthèses</h2>
        <p className="mt-1 text-sm text-ink">
          {settings?.drive_synthese_folder_name ?? 'Aucun dossier choisi'}
        </p>
        <Link to="/drive" className="btn-ghost mt-3 inline-flex text-xs">
          {settings?.drive_synthese_folder_id ? 'Changer' : 'Choisir un dossier'}
        </Link>
      </section>

      <DisciplineSection
        userId={user?.id ?? ''}
        valeur={settings?.discipline ?? 'behourd'}
        onChange={(d) => setSettings((s) => (s ? { ...s, discipline: d } : s))}
      />

      <ExportSportSection userId={user?.id ?? ''} />

      <OrphelinsSection userId={user?.id ?? ''} />

      <section className="card p-4">
        <h2 className="text-sm font-bold text-ink">Agendas affichés</h2>
        <p className="mt-1 text-sm text-muted">
          {settings && settings.visible_calendar_ids.length > 0
            ? `${settings.visible_calendar_ids.length} agenda(s) sélectionné(s)`
            : 'Tous les agendas'}
        </p>
        <Link to="/agenda" className="btn-ghost mt-3 inline-flex text-xs">
          Gérer dans l'agenda
        </Link>
      </section>

      <NotificationsSection userId={user?.id ?? ''} />

      {estProprietaire(user?.email) ? <AccesSection monId={user?.id ?? ''} /> : null}

      <p className="px-1 text-center text-xs text-muted/70">Aide · v0.1</p>
    </div>
  )
}

/**
 * Taille du texte de toute l'app — préférence d'appareil, appliquée
 * immédiatement (pas d'aller-retour réseau) et retenue au prochain lancement.
 */
function TextSizeSection() {
  const [taille, setTaille] = useState<TextSize>('normal')

  useEffect(() => {
    setTaille(readTextSize())
  }, [])

  function choisir(t: TextSize) {
    setTaille(t)
    applyTextSize(t)
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold text-ink">🔤 Taille du texte</h2>
      <p className="mt-1 text-sm text-muted">
        Pour lire longtemps sans forcer — utile en Apprentissage et au Quiz. S'applique à toute l'app.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {TEXT_SIZES.map((t) => (
          <button
            key={t.id}
            onClick={() => choisir(t.id)}
            className={`rounded-xl2 border p-3 text-center transition ${
              taille === t.id ? 'border-copper bg-copper/10' : 'border-line bg-white/5 hover:border-copper/50'
            }`}
          >
            <div className="font-bold text-ink" style={{ fontSize: `${0.8 + (t.pct - 100) / 200}rem` }}>
              Aa
            </div>
            <div className="mt-1 text-xs text-muted">
              {t.label}
              {taille === t.id ? <span className="ml-1 text-copper">✓</span> : null}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

/**
 * Le sport de l'onglet dédié : béhourd ou course à pied.
 *
 * Deux personnes utilisent l'application et ne font pas le même sport. Plutôt
 * que deux onglets dont chacun n'en ouvrira qu'un, l'onglet prend la discipline
 * choisie ici — les deux pages restent atteignables par leur adresse, seule la
 * navigation change.
 */
const DISCIPLINES: Array<{ id: Discipline; icone: string; label: string; aide: string }> = [
  { id: 'behourd', icone: '🛡️', label: 'Béhourd', aide: 'Suivi de l’armure, pièce par pièce, et son poids.' },
  { id: 'course', icone: '🏃', label: 'Course à pied', aide: 'Journal des sorties : allure, dénivelé, cardio, records et volume hebdomadaire.' },
]

function DisciplineSection({
  userId,
  valeur,
  onChange,
}: {
  userId: string
  valeur: Discipline
  onChange: (d: Discipline) => void
}) {
  const [busy, setBusy] = useState(false)
  async function choisir(d: Discipline) {
    if (!userId || d === valeur) return
    onChange(d)
    setBusy(true)
    try {
      await saveSettings(userId, { discipline: d })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold text-ink">Discipline suivie</h2>
      <p className="mt-1 text-sm text-muted">
        Ce que montre l’onglet dédié. Les deux pages restent accessibles par leur adresse — c’est la navigation qui
        change, pas les données.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {DISCIPLINES.map((d) => (
          <button
            key={d.id}
            onClick={() => choisir(d.id)}
            disabled={busy}
            className={`rounded-xl2 border p-3 text-left transition ${
              valeur === d.id ? 'border-copper bg-copper/10' : 'border-line bg-white/5 hover:border-copper/50'
            }`}
          >
            <div className="text-sm font-bold text-ink">
              {d.icone} {d.label}
              {valeur === d.id ? <span className="ml-1 text-copper">✓</span> : null}
            </div>
            <div className="mt-0.5 text-xs text-muted">{d.aide}</div>
          </button>
        ))}
      </div>
    </section>
  )
}

/**
 * Le sport récent, en un bouton, prêt à coller.
 *
 * Le texte est mis dans le presse-papiers ET affiché. L'affichage n'est pas une
 * consolation en cas d'échec : sur iOS, `navigator.clipboard` refuse d'écrire
 * dès que l'appel n'est pas jugé directement issu du geste — ce qui arrive ici,
 * puisqu'il faut d'abord aller chercher les séances sur le réseau. Le bloc
 * sélectionnable est donc le chemin de repli garanti, dans tous les cas.
 */
/**
 * Contrôle de rattachement du journal au catalogue.
 *
 * Volontairement à la demande, et pas au chargement de l'écran : le calcul
 * demande tout le journal et tout le catalogue, pour une réponse qui est « rien
 * à signaler » la plupart du temps. On ne paie pas deux requêtes à chaque
 * ouverture des réglages pour ça.
 */
function OrphelinsSection({ userId }: { userId: string }) {
  const [etat, setEtat] = useState<'repos' | 'chargement' | 'fait'>('repos')
  const [liste, setListe] = useState<Orphelin[]>([])

  async function verifier() {
    if (!userId) return
    setEtat('chargement')
    try {
      const [sessions, catalog] = await Promise.all([listSessions(userId), listCatalog(userId)])
      setListe(orphelins(sessions, catalog))
      setEtat('fait')
    } catch {
      setEtat('repos')
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold text-ink">Cohérence du journal</h2>
      <p className="mt-1 text-sm text-muted">
        Vérifie que chaque exercice enregistré désigne encore un exercice du catalogue. Un exercice détaché
        garde son nom et sa charge, mais perd son étiquetage musculaire et sa progression — sans rien
        afficher d'anormal.
      </p>

      {etat === 'fait' ? (
        <div className="mt-3">
          <p className={`text-sm font-semibold ${liste.length === 0 ? 'text-sage-dark' : 'text-clay'}`}>
            {liste.length === 0 ? '✔ ' : '⚠️ '}
            {resumeOrphelins(liste)}
          </p>
          {liste.length > 0 ? (
            <>
              <ul className="mt-2 space-y-1">
                {liste.map((o) => (
                  <li key={o.nom} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-ink">{o.nom}</span>
                    <span className="shrink-0 text-muted">
                      {o.passages} passage{o.passages > 1 ? 's' : ''}
                      {o.chargeMax !== null ? ` · jusqu'à ${o.chargeMax} kg` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted">
                Pour rattacher : ouvre la séance et resaisis l'exercice depuis le catalogue, ou ajoute son
                ancien nom à la table de renvois de la bibliothèque.
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      <button onClick={verifier} disabled={etat === 'chargement' || !userId} className="btn-ghost mt-3 text-xs">
        {etat === 'chargement' ? 'Vérification…' : etat === 'fait' ? 'Vérifier à nouveau' : 'Vérifier'}
      </button>
    </section>
  )
}

function ExportSportSection({ userId }: { userId: string }) {
  const [texte, setTexte] = useState<string | null>(null)
  const [busy, setBusy] = useState<PorteeExport | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  // Les données sont chargées une fois et gardées : les deux boutons décrivent
  // le même corps à la même seconde, et passer de l'un à l'autre est immédiat.
  const donnees = useRef<Omit<ContexteExport, 'portee'> | null>(null)

  async function charger(): Promise<Omit<ContexteExport, 'portee'>> {
    if (donnees.current) return donnees.current
    // Tout en parallèle : huit sources, dont aucune ne dépend d'une autre. Les
    // pesées arrivent de la plus récente à la plus ancienne, la première est
    // donc le poids du jour — celui qui sert à la dépense.
    const [sessions, weighins, nuits, observations, courbatures, profil, focus, behourd] = await Promise.all([
      listSessions(userId),
      listWeighins(userId),
      loadNuits(userId),
      loadObservations(userId),
      loadCourbatures(userId),
      loadProfil(userId),
      loadFocus(userId),
      loadBehourd(userId),
    ])
    donnees.current = {
      sessions, weighins, nuits, observations, courbatures, profil, focus, behourd,
      bodyWeight: weighins[0]?.weight_kg ?? null,
    }
    return donnees.current
  }

  async function exporter(portee: PorteeExport) {
    if (!userId) return
    setBusy(portee)
    setMsg(null)
    try {
      const out = exporterSport({ ...(await charger()), portee })
      setTexte(out)
      try {
        await navigator.clipboard.writeText(out)
        setMsg('Copié ✓ — plus qu’à coller.')
      } catch {
        setMsg('Copie automatique refusée par le navigateur : sélectionne le texte ci-dessous.')
      }
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold text-ink">🏋️ Export</h2>
      <p className="mt-1 text-sm text-muted">
        Sur {FENETRE_STATS} jours, en texte, prêt à coller.{' '}
        <b className="text-ink">Séances</b> donne le journal et son résumé ; <b className="text-ink">Tout</b> y ajoute
        charge d'entraînement, sommeil nuit par nuit, pesées, progression et records, état de récupération et écarts au
        barème.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => exporter('sport')} disabled={busy !== null || !userId} className="btn-ghost text-xs">
          {busy === 'sport' ? 'Préparation…' : '📒 Séances'}
        </button>
        <button
          onClick={() => exporter('complet')}
          disabled={busy !== null || !userId}
          className="btn-ghost text-xs text-copper"
        >
          {busy === 'complet' ? 'Préparation…' : '🧠 Tout exporter'}
        </button>
      </div>

      {msg ? <p className="mt-2 text-xs text-copper">{msg}</p> : null}

      {texte ? (
        <textarea
          readOnly
          value={texte}
          onFocus={(e) => e.currentTarget.select()}
          className="field mt-2 h-40 font-mono text-[10px] leading-snug"
        />
      ) : null}
    </section>
  )
}

function NotificationsSection({ userId }: { userId: string }) {
  const [status, setStatus] = useState<'unsupported' | 'denied' | 'on' | 'off' | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const standalone = isStandalone()

  async function refresh() {
    setStatus(await pushStatus())
  }
  useEffect(() => {
    refresh()
  }, [])

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(null), 3000)
  }

  async function toggle() {
    setBusy(true)
    try {
      if (status === 'on') {
        await disablePush()
        flash('Notifications désactivées.')
      } else {
        await enablePush(userId)
        flash('Notifications activées ✓')
      }
      await refresh()
    } catch (e) {
      flash((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    try {
      await sendTestPush()
      flash('Notification de test envoyée 📲')
    } catch (e) {
      flash((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold text-ink">🔔 Notifications</h2>

      {status === 'unsupported' ? (
        <p className="mt-1 text-sm text-muted">
          Non supporté ici. Sur iPhone : ajoute l'app à l'écran d'accueil (Partager → « Sur l'écran d'accueil »),
          ouvre-la depuis cette icône, puis reviens activer.
        </p>
      ) : status === 'denied' ? (
        <p className="mt-1 text-sm text-clay">
          Permission refusée. Autorise les notifications pour « Aide » dans les réglages de ton téléphone, puis réessaie.
        </p>
      ) : (
        <>
          <p className="mt-1 flex items-center gap-2 text-sm">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${status === 'on' ? 'bg-sage' : 'bg-clay'}`} />
            {status === 'on' ? 'Activées' : 'Désactivées'}
          </p>
          {!standalone ? (
            <p className="mt-1 text-xs text-muted">
              ⚠️ Sur iPhone, les notifications ne marchent que si tu ouvres l'app depuis l'icône de l'écran d'accueil.
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button onClick={toggle} disabled={busy || status === 'loading'} className="btn-ghost text-xs">
              {status === 'on' ? 'Désactiver' : 'Activer'}
            </button>
            {status === 'on' ? (
              <button onClick={test} disabled={busy} className="btn-ghost text-xs text-copper">
                Envoyer un test
              </button>
            ) : null}
          </div>
        </>
      )}

      {msg ? <p className="mt-2 text-xs text-copper">{msg}</p> : null}
    </section>
  )
}

/**
 * Qui voit quoi — visible du seul propriétaire.
 *
 * Le rendre conditionnel à l'écran ne protège rien en soi : c'est la base qui
 * refuse l'écriture à tout autre compte, et c'est elle seule qui compte. Mais
 * afficher un panneau d'administration à qui ne peut rien en faire n'apprend
 * qu'une chose, l'existence du panneau.
 */
function AccesSection({ monId }: { monId: string }) {
  const [comptes, setComptes] = useState<Acces[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    listerComptes()
      .then(setComptes)
      .catch((e: Error) => setMsg(e.message))
  }, [])

  async function basculer(c: Acces, section: Section) {
    const sections = c.sections.includes(section)
      ? c.sections.filter((s) => s !== section)
      : [...c.sections, section]
    // On peint tout de suite et on écrit derrière : une case à cocher qui
    // attend le réseau donne l'impression de n'avoir pas été touchée, et on la
    // touche deux fois.
    setComptes((liste) => (liste ?? []).map((x) => (x.user_id === c.user_id ? { ...x, sections } : x)))
    setBusy(c.user_id)
    try {
      await enregistrerAcces(c.user_id, sections)
      setMsg(null)
    } catch (e) {
      setMsg((e as Error).message)
      setComptes(await listerComptes().catch(() => comptes ?? []))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold text-ink">🔑 Accès des comptes</h2>
      <p className="mt-1 text-sm text-muted">
        Ton compte voit tout, toujours. Pour les autres, c'est ici que ça se décide, section par section. L'accueil et
        les réglages restent ouverts à tous — les fermer enfermerait le compte dans une application sans porte de
        sortie.
      </p>
      <p className="mt-1 text-xs italic text-muted">
        Un compte qui arrive part avec{' '}
        {DEFAUT_NOUVEAU_COMPTE.map((id) => SECTIONS.find((s) => s.id === id)?.label ?? id).join(' et ')}. Le reste
        attend que tu l'ouvres.
      </p>

      {msg ? <p className="mt-2 text-xs text-clay">{msg}</p> : null}
      {comptes === null ? <p className="mt-3 text-xs text-muted">Chargement…</p> : null}

      <div className="mt-3 space-y-3">
        {(comptes ?? []).map((c) => {
          const moi = c.user_id === monId || estProprietaire(c.email)
          return (
            <div key={c.user_id} className="rounded-xl2 border border-line bg-white/5 p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <b className="text-sm text-ink">{c.email ?? c.user_id.slice(0, 8)}</b>
                {moi ? (
                  <span className="rounded-full bg-copper/20 px-1.5 py-0.5 text-[9px] font-bold text-copper">
                    accès total
                  </span>
                ) : (
                  <span className="text-[10px] text-muted">
                    {c.sections.length} section{c.sections.length > 1 ? 's' : ''} sur {SECTIONS.length}
                  </span>
                )}
              </div>

              {moi ? (
                <p className="mt-1 text-[11px] italic text-muted">
                  Le propriétaire est reconnu à son adresse ({PROPRIETAIRE}), et la base le sait aussi : ses accès ne
                  se règlent pas, ils sont acquis.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1">
                  {SECTIONS.map((s) => {
                    const ouvert = c.sections.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        onClick={() => basculer(c, s.id)}
                        disabled={busy === c.user_id}
                        title={s.aide}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                          ouvert ? 'bg-sage text-white' : 'bg-white/5 text-muted hover:text-ink'
                        }`}
                      >
                        {s.icone} {s.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
