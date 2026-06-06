import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { spotifyHandleCallback } from '../lib/spotify'

export function SpotifyCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const err = params.get('error')
    if (err) {
      setError('Connexion refusée : ' + err)
      return
    }
    if (!code) {
      navigate('/musique', { replace: true })
      return
    }
    spotifyHandleCallback(code)
      .then(() => navigate('/musique', { replace: true }))
      .catch((e) => setError((e as Error).message))
  }, [navigate])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      {error ? (
        <>
          <p className="text-sm text-clay">{error}</p>
          <button onClick={() => navigate('/musique', { replace: true })} className="btn-ghost text-xs">
            Retour
          </button>
        </>
      ) : (
        <p className="animate-pulse text-sm text-muted">Connexion à Spotify…</p>
      )}
    </div>
  )
}
