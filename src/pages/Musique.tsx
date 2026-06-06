import { useEffect, useState } from 'react'
import {
  getNowPlaying,
  getPlaylists,
  getRecentlyPlayed,
  spotifyConfigured,
  spotifyConnected,
  spotifyLogin,
  spotifyLogout,
  spotifyNext,
  spotifyPause,
  spotifyPlay,
  spotifyPrev,
  type NowPlaying,
} from '../lib/spotify'

export function Musique() {
  const configured = spotifyConfigured()
  const [connected, setConnected] = useState(spotifyConnected())
  const [now, setNow] = useState<NowPlaying | null>(null)
  const [recent, setRecent] = useState<{ title: string; artist: string; cover?: string }[]>([])
  const [playlists, setPlaylists] = useState<{ id: string; name: string; cover?: string; url: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setError(null)
    try {
      setNow(await getNowPlaying())
    } catch (e) {
      if ((e as Error).message === 'NOT_CONNECTED') {
        setConnected(false)
        return
      }
      setError((e as Error).message)
    }
    try {
      setRecent(await getRecentlyPlayed())
    } catch {
      /* ignore */
    }
    try {
      setPlaylists(await getPlaylists())
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (connected) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected])

  async function control(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
      setTimeout(refresh, 400)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!configured) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold text-ink">🎵 Musique</h1>
        <div className="card p-4 text-sm text-muted">
          Spotify pas encore configuré : il manque le <b className="text-ink">Client ID</b>. Crée ton app sur
          developer.spotify.com puis donne-le moi — je l'ajoute et ça s'active. 🙂
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold text-ink">🎵 Musique</h1>
        <p className="text-sm text-muted">Connecte ton compte Spotify pour voir ta lecture et tes playlists.</p>
        <button onClick={() => spotifyLogin()} className="btn-primary" style={{ background: '#1DB954' }}>
          Se connecter à Spotify
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink">🎵 Musique</h1>
        <button
          onClick={() => {
            spotifyLogout()
            setConnected(false)
          }}
          className="text-xs text-muted hover:underline"
        >
          Déconnecter
        </button>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      {/* Lecture en cours */}
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-extrabold text-ink">En lecture</h2>
        {now ? (
          <div className="flex items-center gap-3">
            {now.cover ? <img src={now.cover} alt="" className="h-16 w-16 rounded-lg object-cover" /> : null}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink">{now.title}</div>
              <div className="truncate text-xs text-muted">{now.artist}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted">Rien en lecture.</div>
        )}
        <div className="mt-3 flex items-center justify-center gap-4">
          <button onClick={() => control(spotifyPrev)} className="text-2xl">⏮️</button>
          <button onClick={() => control(now?.isPlaying ? spotifyPause : spotifyPlay)} className="text-3xl">
            {now?.isPlaying ? '⏸️' : '▶️'}
          </button>
          <button onClick={() => control(spotifyNext)} className="text-2xl">⏭️</button>
          <button onClick={refresh} className="ml-2 text-sm text-copper">↻</button>
        </div>
      </section>

      {/* Playlists */}
      {playlists.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-extrabold text-ink">Tes playlists</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {playlists.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl2 bg-white/5 p-2"
              >
                {p.cover ? <img src={p.cover} alt="" className="h-9 w-9 rounded object-cover" /> : <span className="text-lg">🎵</span>}
                <span className="truncate text-xs text-ink">{p.name}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* Récemment écouté */}
      {recent.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-extrabold text-ink">Écoutés récemment</h2>
          <ul className="space-y-2">
            {recent.slice(0, 12).map((t, i) => (
              <li key={i} className="flex items-center gap-2">
                {t.cover ? <img src={t.cover} alt="" className="h-8 w-8 rounded object-cover" /> : null}
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink">{t.title}</div>
                  <div className="truncate text-xs text-muted">{t.artist}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
