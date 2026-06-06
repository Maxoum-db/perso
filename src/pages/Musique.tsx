import { useEffect, useState } from 'react'
import {
  ensureActiveDevice,
  getDevices,
  getNowPlaying,
  getPlaylists,
  getPlaylistTracks,
  getRecentlyPlayed,
  playContext,
  playUris,
  searchTracks,
  spotifyConfigured,
  spotifyConnected,
  spotifyLogin,
  spotifyLogout,
  spotifyNext,
  spotifyPause,
  spotifyPlay,
  spotifyPrev,
  transferPlayback,
  type NowPlaying,
  type SpotifyDevice,
  type Track,
} from '../lib/spotify'

type Playlist = { id: string; name: string; cover?: string; url: string }

export function Musique() {
  const configured = spotifyConfigured()
  const [connected, setConnected] = useState(spotifyConnected())
  const [now, setNow] = useState<NowPlaying | null>(null)
  const [recent, setRecent] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [devices, setDevices] = useState<SpotifyDevice[]>([])
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[] | null>(null)
  const [openPl, setOpenPl] = useState<{ id: string; name: string; tracks: Track[] } | null>(null)

  async function refresh() {
    setError(null)
    try {
      setNow(await getNowPlaying())
    } catch (e) {
      if ((e as Error).message === 'NOT_CONNECTED') return setConnected(false)
      setError((e as Error).message)
    }
    getDevices().then(setDevices).catch(() => {})
    getRecentlyPlayed().then(setRecent).catch(() => {})
    getPlaylists().then(setPlaylists).catch(() => {})
  }

  useEffect(() => {
    if (connected) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected])

  async function withDevice(action: (id: string) => Promise<unknown>) {
    setError(null)
    try {
      const id = await ensureActiveDevice()
      if (!id) {
        setError('Aucun appareil. Ouvre Spotify et lance une musique, puis choisis l’appareil ci-dessous.')
        return
      }
      await action(id)
      setTimeout(refresh, 500)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const playTrack = (uri: string) => withDevice((id) => playUris([uri], id))
  const playPlaylistFrom = (offsetUri?: string) =>
    openPl && withDevice((id) => playContext(`spotify:playlist:${openPl.id}`, offsetUri, id))

  async function togglePlay() {
    if (now?.isPlaying) {
      setError(null)
      try {
        await spotifyPause()
        setTimeout(refresh, 400)
      } catch (e) {
        setError((e as Error).message)
      }
    } else {
      withDevice(() => spotifyPlay())
    }
  }

  async function doSearch() {
    setError(null)
    try {
      setResults(await searchTracks(query))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function openPlaylist(p: Playlist) {
    setError(null)
    try {
      setOpenPl({ id: p.id, name: p.name, tracks: await getPlaylistTracks(p.id) })
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!configured) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold text-ink">🎵 Musique</h1>
        <div className="card p-4 text-sm text-muted">Spotify pas encore configuré (Client ID manquant).</div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold text-ink">🎵 Musique</h1>
        <p className="text-sm text-muted">Connecte ton compte Spotify.</p>
        <button onClick={() => spotifyLogin()} className="btn-primary" style={{ background: '#1DB954' }}>
          Se connecter à Spotify
        </button>
      </div>
    )
  }

  // Vue détail playlist
  if (openPl) {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setOpenPl(null)} className="text-sm text-copper hover:underline">
          ‹ Retour
        </button>
        <div className="flex items-center justify-between gap-2">
          <h1 className="truncate text-xl font-extrabold text-ink">{openPl.name}</h1>
          <button onClick={() => playPlaylistFrom()} className="btn-primary shrink-0 px-4 py-2" style={{ background: '#1DB954' }}>
            ▶ Tout lire
          </button>
        </div>
        {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}
        <TrackList tracks={openPl.tracks} onPlay={(t) => playPlaylistFrom(t.uri)} />
        <NowBar now={now} onToggle={togglePlay} onPrev={() => withDevice(() => spotifyPrev())} onNext={() => withDevice(() => spotifyNext())} />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink">🎵 Musique</h1>
        <button onClick={() => { spotifyLogout(); setConnected(false) }} className="text-xs text-muted hover:underline">
          Déconnecter
        </button>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      {/* Recherche */}
      <div className="flex items-center gap-2">
        <input
          className="field"
          placeholder="Rechercher un titre, un artiste…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
        />
        <button onClick={doSearch} className="btn-primary shrink-0 px-4 py-2">
          🔎
        </button>
      </div>

      {results !== null ? (
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-ink">Résultats</h2>
            <button onClick={() => { setResults(null); setQuery('') }} className="text-xs text-muted hover:underline">
              Effacer
            </button>
          </div>
          {results.length === 0 ? <p className="text-sm text-muted">Aucun résultat.</p> : <TrackList tracks={results} onPlay={(t) => playTrack(t.uri)} />}
        </section>
      ) : null}

      {/* Appareils */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-ink">📱 Appareils</h2>
          <button onClick={refresh} className="text-sm text-copper">↻</button>
        </div>
        {devices.length === 0 ? (
          <p className="text-xs text-muted">Ouvre Spotify sur un appareil et lance une musique, puis touche ↻.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {devices.map((d) => (
              <button
                key={d.id}
                onClick={() => withDevice(() => transferPlayback(d.id, false))}
                className="chip border transition"
                style={{
                  borderColor: d.is_active ? 'rgb(var(--sage))' : 'rgb(var(--line))',
                  background: d.is_active ? 'rgb(var(--sage) / .25)' : 'transparent',
                  color: 'rgb(var(--ink))',
                }}
              >
                {d.is_active ? '🔊' : '📱'} {d.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Playlists */}
      {playlists.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-extrabold text-ink">Tes playlists</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {playlists.map((p) => (
              <button key={p.id} onClick={() => openPlaylist(p)} className="flex items-center gap-2 rounded-xl2 bg-white/5 p-2 text-left">
                {p.cover ? <img src={p.cover} alt="" className="h-9 w-9 rounded object-cover" /> : <span className="text-lg">🎵</span>}
                <span className="truncate text-xs text-ink">{p.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Récemment écouté */}
      {recent.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-extrabold text-ink">Écoutés récemment</h2>
          <TrackList tracks={recent.slice(0, 15)} onPlay={(t) => playTrack(t.uri)} />
        </section>
      ) : null}

      <NowBar now={now} onToggle={togglePlay} onPrev={() => withDevice(() => spotifyPrev())} onNext={() => withDevice(() => spotifyNext())} />
    </div>
  )
}

function TrackList({ tracks, onPlay }: { tracks: Track[]; onPlay: (t: Track) => void }) {
  return (
    <ul className="space-y-1">
      {tracks.map((t, i) => (
        <li key={t.uri + i} className="flex items-center gap-2">
          {t.cover ? <img src={t.cover} alt="" className="h-9 w-9 shrink-0 rounded object-cover" /> : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-ink">{t.name}</div>
            <div className="truncate text-xs text-muted">{t.artist}</div>
          </div>
          <button onClick={() => onPlay(t)} className="shrink-0 px-2 text-xl" title="Lire">
            ▶️
          </button>
        </li>
      ))}
    </ul>
  )
}

// Mini-barre de lecture fixe en bas (au-dessus de la nav)
function NowBar({
  now,
  onToggle,
  onPrev,
  onNext,
}: {
  now: NowPlaying | null
  onToggle: () => void
  onPrev: () => void
  onNext: () => void
}) {
  if (!now) return null
  return (
    <div className="fixed inset-x-0 bottom-[64px] z-20 mx-auto max-w-3xl px-3">
      <div className="card flex items-center gap-3 p-2 shadow-lift">
        {now.cover ? <img src={now.cover} alt="" className="h-10 w-10 rounded object-cover" /> : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-ink">{now.title}</div>
          <div className="truncate text-[11px] text-muted">{now.artist}</div>
        </div>
        <button onClick={onPrev} className="text-lg">⏮️</button>
        <button onClick={onToggle} className="text-2xl">{now.isPlaying ? '⏸️' : '▶️'}</button>
        <button onClick={onNext} className="text-lg">⏭️</button>
      </div>
    </div>
  )
}
