import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { hasFreshGoogleToken } from '../lib/google'
import { fetchSettings, type PersoSettings } from '../lib/settings'
import { disablePush, enablePush, isStandalone, pushStatus, sendTestPush } from '../lib/push'
import { exporterSport } from '../lib/exportSport'
import { FENETRE_STATS, listSessions } from '../lib/muscu'
import { listWeighins } from '../lib/workouts'

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

      <ExportSportSection userId={user?.id ?? ''} />

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

      <p className="px-1 text-center text-xs text-muted/70">Aide · v0.1</p>
    </div>
  )
}

/**
 * Le sport récent, en un bouton, prêt à coller dans NotebookLM.
 *
 * Le texte est mis dans le presse-papiers ET affiché. L'affichage n'est pas une
 * consolation en cas d'échec : sur iOS, `navigator.clipboard` refuse d'écrire
 * dès que l'appel n'est pas jugé directement issu du geste — ce qui arrive ici,
 * puisqu'il faut d'abord aller chercher les séances sur le réseau. Le bloc
 * sélectionnable est donc le chemin de repli garanti, dans tous les cas.
 */
function ExportSportSection({ userId }: { userId: string }) {
  const [texte, setTexte] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function exporter() {
    if (!userId) return
    setBusy(true)
    setMsg(null)
    try {
      // Les pesées arrivent de la plus récente à la plus ancienne : la
      // première est le poids du jour, celui qui sert à la dépense.
      const [sessions, weighins] = await Promise.all([listSessions(userId), listWeighins(userId)])
      const out = exporterSport({ sessions, weighins, bodyWeight: weighins[0]?.weight_kg ?? null })
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
      setBusy(false)
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold text-ink">🏋️ Export du sport</h2>
      <p className="mt-1 text-sm text-muted">
        Les {FENETRE_STATS} derniers jours d'entraînement en texte — séances, exercices, charges, tonnage et dépense.
        À coller dans NotebookLM.
      </p>
      <button onClick={exporter} disabled={busy || !userId} className="btn-ghost mt-3 text-xs">
        {busy ? 'Préparation…' : texte ? 'Regénérer et copier' : `Copier les ${FENETRE_STATS} derniers jours`}
      </button>

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
