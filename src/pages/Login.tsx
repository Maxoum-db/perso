import { useAuth } from '../lib/auth'

export function Login() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6">
      <div className="card w-full max-w-sm p-7 text-center">
        <img src="/icon-512.png" alt="Aide" className="mx-auto mb-4 h-24 w-24 rounded-2xl object-cover" />
        <p className="mt-2 text-sm text-muted">
          Ton espace personnel : agenda unifié, synthèses, notes. Connecté à ton compte
          Google.
        </p>

        <button onClick={signInWithGoogle} className="btn-primary mt-6 w-full">
          <GoogleMark />
          Se connecter avec Google
        </button>

        <p className="mt-4 text-xs text-muted/80">
          On demande l'accès à ton Agenda et à ton Drive (lecture) pour afficher tes
          événements et tes synthèses. Tes notes restent privées.
        </p>
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#fff" d="M44.5 20H24v8.5h11.8C34.7 33.9 30 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.3 0 6.3 1.2 8.6 3.3l6-6C40.9 4.5 35.8 2.5 24 2.5 12 2.5 2.5 12 2.5 24S12 45.5 24 45.5c11 0 21-8 21-21.5 0-1.4-.2-2.7-.5-4z" opacity=".0" />
      <path fill="#FFC107" d="M43.6 20.1H24v8.2h11.3C33.6 33 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.8-5.8C34.3 6 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.8-5.8C34.3 6 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.2 0-9.6-3-11.3-7.7l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H24v8.2h11.3c-.8 2.3-2.3 4.2-4.1 5.5l6.3 5.3C40.9 36.8 44 31.1 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  )
}
