import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { hasFreshGoogleToken } from '../lib/google'
import { fetchSettings, type PersoSettings } from '../lib/settings'

export function Settings() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [settings, setSettings] = useState<PersoSettings | null>(null)
  const connected = hasFreshGoogleToken()

  useEffect(() => {
    if (user) fetchSettings(user.id).then(setSettings)
  }, [user])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-navy">Réglages</h1>

      <section className="card p-4">
        <h2 className="text-sm font-bold text-navy">Compte</h2>
        <p className="mt-1 text-sm text-ink">{user?.email}</p>
        <button onClick={signOut} className="btn-ghost mt-3 text-xs">
          Se déconnecter
        </button>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-bold text-navy">Connexion Google</h2>
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
        <h2 className="text-sm font-bold text-navy">Dossier de synthèses</h2>
        <p className="mt-1 text-sm text-ink">
          {settings?.drive_synthese_folder_name ?? 'Aucun dossier choisi'}
        </p>
        <Link to="/drive" className="btn-ghost mt-3 inline-flex text-xs">
          {settings?.drive_synthese_folder_id ? 'Changer' : 'Choisir un dossier'}
        </Link>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-bold text-navy">Agendas affichés</h2>
        <p className="mt-1 text-sm text-muted">
          {settings && settings.visible_calendar_ids.length > 0
            ? `${settings.visible_calendar_ids.length} agenda(s) sélectionné(s)`
            : 'Tous les agendas'}
        </p>
        <Link to="/agenda" className="btn-ghost mt-3 inline-flex text-xs">
          Gérer dans l'agenda
        </Link>
      </section>

      <p className="px-1 text-center text-xs text-muted/70">Hub Perso · v0.1</p>
    </div>
  )
}
