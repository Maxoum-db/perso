import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuth } from '../lib/auth'
import {
  FOLDER_MIME,
  GoogleAuthError,
  getFileBlobUrl,
  getFileText,
  hasFreshGoogleToken,
  listFilesInFolder,
  searchFolders,
  type DriveFile,
} from '../lib/google'
import { fetchSettings, saveSettings, readCachedSettings } from '../lib/settings'
import { ReconnectGoogle } from '../components/ReconnectGoogle'

type Crumb = { id: string; name: string }

export function Drive() {
  const { user } = useAuth()
  const [needAuth, setNeedAuth] = useState(!hasFreshGoogleToken())
  const cached = readCachedSettings()
  const [rootId, setRootId] = useState<string | null>(cached.drive_synthese_folder_id)
  const [path, setPath] = useState<Crumb[]>(
    cached.drive_synthese_folder_id
      ? [{ id: cached.drive_synthese_folder_id, name: cached.drive_synthese_folder_name || 'Synthèses' }]
      : [],
  )
  const [items, setItems] = useState<DriveFile[] | null>(null)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [openFile, setOpenFile] = useState<DriveFile | null>(null)

  const current = path[path.length - 1] ?? null

  useEffect(() => {
    if (!hasFreshGoogleToken()) {
      setNeedAuth(true)
      return
    }
    if (user) {
      fetchSettings(user.id).then((s) => {
        setRootId(s.drive_synthese_folder_id)
        if (s.drive_synthese_folder_id) {
          setPath([{ id: s.drive_synthese_folder_id, name: s.drive_synthese_folder_name || 'Synthèses' }])
        }
      })
    }
  }, [user])

  useEffect(() => {
    if (needAuth || !current) return
    setItems(null)
    setError(null)
    setQuery('')
    listFilesInFolder(current.id)
      .then(setItems)
      .catch((e) => {
        if (e instanceof GoogleAuthError) setNeedAuth(true)
        else setError((e as Error).message)
      })
  }, [current?.id, needAuth])

  async function chooseRoot(f: DriveFile) {
    setRootId(f.id)
    setPath([{ id: f.id, name: f.name }])
    setPicking(false)
    if (user) await saveSettings(user.id, { drive_synthese_folder_id: f.id, drive_synthese_folder_name: f.name })
  }

  const { folders, docs } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (items ?? []).filter((f) => !q || f.name.toLowerCase().includes(q))
    return {
      folders: list.filter((f) => f.mimeType === FOLDER_MIME),
      docs: list.filter((f) => f.mimeType !== FOLDER_MIME),
    }
  }, [items, query])

  if (needAuth) return <ReconnectGoogle />
  if (openFile) return <FileReader file={openFile} onBack={() => setOpenFile(null)} />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-extrabold text-ink">Synthèses</h1>
        {rootId ? (
          <button onClick={() => setPicking(true)} className="ml-auto text-xs text-copper hover:underline">
            Changer de dossier
          </button>
        ) : null}
      </div>

      {!rootId || picking ? (
        <FolderPicker onPick={chooseRoot} onCancel={rootId ? () => setPicking(false) : undefined} />
      ) : (
        <>
          {/* Fil d'Ariane */}
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
            {path.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                {i > 0 ? <span className="opacity-50">›</span> : null}
                <button
                  onClick={() => setPath((p) => p.slice(0, i + 1))}
                  className={i === path.length - 1 ? 'font-semibold text-ink' : 'text-copper hover:underline'}
                >
                  {i === 0 ? `📁 ${c.name}` : c.name}
                </button>
              </span>
            ))}
          </div>

          <p className="text-[11px] text-muted">
            Dépose ici tes synthèses <b>NotebookLM</b> et tes exports <b>Plaud</b> (organise-les en
            sous-dossiers, tu peux naviguer dedans).
          </p>

          <input className="field" placeholder="Rechercher dans ce dossier…" value={query} onChange={(e) => setQuery(e.target.value)} />

          {error ? <div className="card border-clay/40 bg-clay/5 p-4 text-sm text-clay">{error}</div> : null}

          {items === null ? (
            <div className="animate-pulse text-sm text-muted">Chargement…</div>
          ) : folders.length === 0 && docs.length === 0 ? (
            <div className="card p-6 text-center text-sm text-muted">
              {query ? 'Rien ne correspond.' : 'Dossier vide. Ajoute des synthèses dans Google Drive, elles apparaîtront ici. 📄'}
            </div>
          ) : (
            <div className="space-y-2">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPath((p) => [...p, { id: f.id, name: f.name }])}
                  className="card flex w-full items-center gap-3 p-3 text-left transition hover:shadow-lift"
                >
                  <span className="text-lg">📁</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{f.name}</span>
                  <span className="text-muted">›</span>
                </button>
              ))}

              {docs.map((f) => (
                <div key={f.id} className="card flex items-center gap-3 p-3">
                  <span className="text-lg">{fileEmoji(f.mimeType)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-ink">{f.name}</div>
                    <div className="text-xs text-muted">
                      {f.modifiedTime ? format(new Date(f.modifiedTime), "d MMM yyyy 'à' HH:mm", { locale: fr }) : ''}
                    </div>
                  </div>
                  {isReadable(f.mimeType) ? (
                    <button onClick={() => setOpenFile(f)} className="btn-ghost px-3 py-1.5 text-xs">
                      Lire
                    </button>
                  ) : null}
                  {f.webViewLink ? (
                    <a href={f.webViewLink} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5 text-xs">
                      Ouvrir
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FolderPicker({ onPick, onCancel }: { onPick: (f: DriveFile) => void; onCancel?: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      searchFolders(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center">
        <p className="text-sm font-semibold text-ink">Choisis ton dossier de synthèses</p>
        {onCancel ? (
          <button onClick={onCancel} className="ml-auto text-xs text-muted hover:underline">
            Annuler
          </button>
        ) : null}
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un dossier Drive…"
        className="field"
      />
      <ul className="mt-3 max-h-80 space-y-1 overflow-auto">
        {loading ? <li className="text-xs text-muted">Recherche…</li> : null}
        {!loading && results.length === 0 ? <li className="text-xs text-muted">Aucun dossier trouvé.</li> : null}
        {results.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => onPick(f)}
              className="flex w-full items-center gap-2 rounded-xl2 px-3 py-2 text-left text-sm text-ink hover:bg-bg"
            >
              <span>📁</span>
              <span className="truncate">{f.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FileReader({ file, onBack }: { file: DriveFile; onBack: () => void }) {
  const [text, setText] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isAudio = file.mimeType.startsWith('audio/')

  useEffect(() => {
    if (isAudio) {
      getFileBlobUrl(file)
        .then(setAudioUrl)
        .catch((e) => setError((e as Error).message))
      return () => {
        setAudioUrl((u) => {
          if (u) URL.revokeObjectURL(u)
          return null
        })
      }
    }
    getFileText(file)
      .then(setText)
      .catch((e) => setError((e as Error).message))
  }, [file, isAudio])

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-sm text-copper hover:underline">
        ‹ Retour
      </button>
      <h1 className="text-lg font-extrabold text-ink">
        {fileEmoji(file.mimeType)} {file.name}
      </h1>
      {error ? (
        <div className="card border-clay/40 bg-clay/5 p-4 text-sm text-clay">{error}</div>
      ) : isAudio ? (
        audioUrl ? (
          <audio controls src={audioUrl} className="w-full" />
        ) : (
          <div className="animate-pulse text-sm text-muted">Chargement de l'audio…</div>
        )
      ) : text === null ? (
        <div className="animate-pulse text-sm text-muted">Lecture…</div>
      ) : (
        <article className="card whitespace-pre-wrap p-4 text-sm leading-relaxed text-ink">{text}</article>
      )}
    </div>
  )
}

function fileEmoji(mime: string): string {
  if (mime === FOLDER_MIME) return '📁'
  if (mime === 'application/vnd.google-apps.document') return '📝'
  if (mime === 'application/vnd.google-apps.spreadsheet') return '📊'
  if (mime.startsWith('audio/')) return '🎧'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime === 'application/pdf') return '📕'
  return '📄'
}

function isReadable(mime: string): boolean {
  return mime === 'application/vnd.google-apps.document' || mime.startsWith('text/')
}
