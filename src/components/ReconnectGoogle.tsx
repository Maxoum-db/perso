import { useAuth } from '../lib/auth'

/**
 * Bandeau affiché quand le jeton Google a expiré (ou n'a jamais été capté).
 * Le clic relance le flux OAuth Google via Supabase.
 */
export function ReconnectGoogle({ message }: { message?: string }) {
  const { signInWithGoogle } = useAuth()
  return (
    <div className="card border-sand/60 bg-sand/10 p-5 text-center">
      <p className="text-sm font-semibold text-ink">
        {message ?? 'Connexion Google expirée'}
      </p>
      <p className="mt-1 text-xs text-muted">
        Reconnecte ton compte Google pour rafraîchir l'accès à l'Agenda et au Drive.
      </p>
      <button onClick={signInWithGoogle} className="btn-primary mt-4">
        Reconnecter Google
      </button>
    </div>
  )
}
