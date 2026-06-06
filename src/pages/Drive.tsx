import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuth } from '../lib/auth'
import {
  GoogleAuthError,
  getFileText,
  hasFreshGoogleToken,
  listFilesInFolder,
  searchFolders,
  type DriveFile,
} from '../lib/google'
import { fetchSettings, saveSettings, readCachedSettings } from '../lib/settings'
import { ReconnectGoogle } from '../components/ReconnectGoogle'

export function Drive() {
  const { user } = useAuth()
  const [needAuth, setNeedAuth] = useState(!hasFreshGoogleToken())
  const [folderId, setFolderId] = useState<string | null>(readCachedSettings().drive_synthese_folder_id)
  const [folderName, setFolderName] = useState<string | null>(
    readCachedSettings().drive_synthese_folder_name,
  )
  const [files, setFiles] = useState<DriveFile[] | null>(null)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openFile, setOpenFile] = useState<DriveFile | null>(null)

  useEffect(() => {
    if (!hasFreshGoogleToken()) {
      setNeedAuth(true)
      return
    }
    if (user) {
      fetchSettings(user.id).then((s) => {
        setFolderId(s.drive_synthese_folder_id)
        setFolderName(s.drive_synthese_folder_name)
      })
    }
  }, [user])

  useEffect(() => {
    if (needAuth || !folderId) return
    setError(null)
    listFilesInFolder(folderId)
      .then(setFiles)
      .catch((e) => {
        if (e instanceof GoogleAuthError) setNeedAuth(true)
        else setError((e as Error).message)
      })
  }, [folderId, needAuth])

  async function chooseFolder(f: DriveFile) {
    setFolderId(f.id)
    setFolderName(f.name)
    setPicking(false)
    setFiles(null)
    if (user) await saveSettings(user.id, {
      drive_synthese_folder_id: f.id,
      drive_synthese_folder_name: f.name,
    })
  }

  if (needAuth) return <ReconnectGoogle />
  if (openFile) return <FileReader file={openFile} onBack={() => setOpenFile(null)} />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-extrabold text-ink">Synthèses</h1>
        {folderId ? (
          <button onClick={() => setPicking(true)} className="ml-auto text-xs text-copper hover:underline">
            Changer de dossier
          </button>
        ) : null}
      </div>

      {!folderId || picking ? (
        <FolderPicker onPick={chooseFolder} onCancel={folderId ? () => setPicking(false) : undefined} />
      ) : (
        <>
          <p className="text-xs text-muted">
            Dossier : <span className="font-semibold text-ink">{folderName}</span> — dépose ici tes
            synthèses NotebookLM et tes exports Plaud.
          </p>

          {error ? (
            <div className="card border-clay/40 bg-clay/5 p-4 text-sm text-clay">{error}</div>
          ) : null}

          {files === null ? (
            <div className="animate-pulse text-sm text-muted">Chargement des fichiers…</div>
          ) : files.length === 0 ? (
            <div className="card p-6 text-center text-sm text-muted">
              Dossier vide pour l'instant. Ajoute des synthèses dans Google Drive, elles
              apparaîtront ici. 📄
            </div>
          ) : (
            <ul className="space-y-2">
              {files.map((f) => (
                <li key={f.id} className="card flex items-center gap-3 p-3">
                  <span className="text-lg">{fileEmoji(f.mimeType)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-ink">{f.name}</div>
                    <div className="text-xs text-muted">
                      {f.modifiedTime
                        ? format(new Date(f.modifiedTime), "d MMM yyyy 'à' HH:mm", { locale: fr })
                        : ''}
                    </div>
                  </div>
                  {isReadable(f.mimeType) ? (
                    <button onClick={() => setOpenFile(f)} className="btn-ghost px-3 py-1.5 text-xs">
                      Lire
                    </button>
                  ) : null}
                  {f.webViewLink ? (
                    <a
                      href={f.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      Ouvrir
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function FolderPicker({
  onPick,
  onCancel,
}: {
  onPick: (f: DriveFile) => void
  onCancel?: () => void
}) {
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
        className="w-full rounded-xl2 border border-line px-3 py-2 text-sm outline-none focus:border-copper"
      />
      <ul className="mt-3 max-h-80 space-y-1 overflow-auto">
        {loading ? <li className="text-xs text-muted">Recherche…</li> : null}
        {!loading && results.length === 0 ? (
          <li className="text-xs text-muted">Aucun dossier trouvé.</li>
        ) : null}
        {results.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => onPick(f)}
              className="flex w-full items-center gap-2 rounded-xl2 px-3 py-2 text-left text-sm hover:bg-bg"
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFileText(file)
      .then(setText)
      .catch((e) => setError((e as Error).message))
  }, [file])

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-sm text-copper hover:underline">
        ‹ Retour
      </button>
      <h1 className="text-lg font-extrabold text-ink">{file.name}</h1>
      {error ? (
        <div className="card border-clay/40 bg-clay/5 p-4 text-sm text-clay">{error}</div>
      ) : text === null ? (
        <div className="animate-pulse text-sm text-muted">Lecture…</div>
      ) : (
        <article className="card whitespace-pre-wrap p-4 text-sm leading-relaxed text-ink">
          {text}
        </article>
      )}
    </div>
  )
}

function fileEmoji(mime: string): string {
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
