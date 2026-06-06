import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useSpeech } from '../lib/useSpeech'
import {
  NOTE_CATEGORIES,
  backupNotesToDrive,
  categoryMeta,
  createNote,
  deleteNote,
  listNotes,
  updateNote,
  type Note,
} from '../lib/notes'

type EditorState = { note: Note | null } | null

export function Notes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [editor, setEditor] = useState<EditorState>(null)
  const [backup, setBackup] = useState<{ state: 'idle' | 'saving' | 'ok' | 'err'; msg?: string }>({ state: 'idle' })

  async function doBackup() {
    if (!user) return
    setBackup({ state: 'saving' })
    try {
      await backupNotesToDrive(user.id, notes)
      setBackup({ state: 'ok', msg: 'Notes sauvegardées dans ton Drive ✓ (fichier « Aide — Sauvegarde Notes.md »)' })
    } catch (e) {
      setBackup({ state: 'err', msg: (e as Error).message })
    }
  }

  async function reload() {
    if (!user) return
    try {
      setNotes(await listNotes(user.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes.filter((n) => {
      if (filter !== 'all' && n.category !== filter) return false
      if (q && !(`${n.title} ${n.body}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [notes, query, filter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-ink">📝 Notes</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={doBackup}
            disabled={backup.state === 'saving' || notes.length === 0}
            title="Sauvegarder toutes les notes dans Google Drive"
            className="btn-ghost px-3 py-2 text-xs"
          >
            {backup.state === 'saving' ? '…' : '💾 Drive'}
          </button>
          <button onClick={() => setEditor({ note: null })} className="btn-primary px-4 py-2">
            + Note
          </button>
        </div>
      </div>

      {backup.state === 'ok' ? <p className="text-xs text-sage-dark">{backup.msg}</p> : null}
      {backup.state === 'err' ? <p className="text-xs text-clay">{backup.msg}</p> : null}

      <input
        className="field"
        placeholder="Rechercher…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <FilterChip label="Tout" active={filter === 'all'} onClick={() => setFilter('all')} />
        {NOTE_CATEGORIES.map((c) => (
          <FilterChip
            key={c.id}
            label={`${c.emoji} ${c.label}`}
            color={c.color}
            active={filter === c.id}
            onClick={() => setFilter(c.id)}
          />
        ))}
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}
      {loading ? <div className="animate-pulse text-sm text-muted">Chargement…</div> : null}

      {!loading && filtered.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          {notes.length === 0 ? 'Aucune note pour l’instant. Touche « + Note » pour commencer. ✍️' : 'Aucune note ne correspond.'}
        </div>
      ) : null}

      <div className="space-y-2">
        {filtered.map((n) => {
          const m = categoryMeta(n.category)
          return (
            <button
              key={n.id}
              onClick={() => setEditor({ note: n })}
              className="card flex w-full flex-col items-start gap-1 p-3 text-left transition hover:shadow-lift"
              style={{ borderLeft: `3px solid ${m.color}` }}
            >
              <div className="flex w-full items-center gap-2">
                {n.pinned ? <span title="Épinglée">📌</span> : null}
                <span className="truncate font-bold text-ink">{n.title || '(sans titre)'}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted">{m.emoji} {prettyDate(n.updated_at)}</span>
              </div>
              {n.body ? <div className="line-clamp-2 text-xs text-muted">{n.body}</div> : null}
            </button>
          )
        })}
      </div>

      {editor ? (
        <NoteEditor
          note={editor.note}
          userId={user?.id ?? ''}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string
  color?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="chip border transition"
      style={{
        borderColor: active ? color || 'rgb(var(--copper))' : 'rgb(var(--line))',
        background: active ? (color ? color + '33' : 'rgb(var(--copper) / .25)') : 'transparent',
        color: 'rgb(var(--ink))',
      }}
    >
      {label}
    </button>
  )
}

function NoteEditor({
  note,
  userId,
  onClose,
  onSaved,
}: {
  note: Note | null
  userId: string
  onClose: () => void
  onSaved: () => void
}) {
  const editing = !!note
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [category, setCategory] = useState(note?.category ?? 'perso')
  const [pinned, setPinned] = useState(note?.pinned ?? false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const { supported, listening, start, stop } = useSpeech((text) =>
    setBody((b) => (b ? `${b} ${text}` : text)),
  )

  async function save() {
    if (!userId) return
    setBusy(true)
    setErr(null)
    try {
      const input = { title: title.trim(), body, category, pinned }
      if (editing && note) await updateNote(note.id, input)
      else await createNote(userId, input)
      onSaved()
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  async function remove() {
    if (!note) return
    if (!confirm('Supprimer cette note ?')) return
    setBusy(true)
    try {
      await deleteNote(note.id)
      onSaved()
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[92vh] w-full max-w-md overflow-y-auto rounded-b-none p-5 sm:rounded-xl2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-ink">{editing ? 'Note' : 'Nouvelle note'}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>

        <div className="space-y-3">
          <input className="field" placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {NOTE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>

          <div className="relative">
            <textarea
              className="field min-h-[180px] pr-12"
              placeholder="Écris ou dicte ta note…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {supported ? (
              <button
                type="button"
                onClick={() => (listening ? stop() : start())}
                title={listening ? 'Arrêter la dictée' : 'Dicter'}
                className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-lg ${
                  listening ? 'animate-pulse bg-clay text-white' : 'bg-copper text-white'
                }`}
              >
                🎤
              </button>
            ) : null}
          </div>
          {!supported ? (
            <p className="text-[11px] text-muted">
              💡 Sur iPhone, touche la zone de texte puis le <b>micro 🎤 du clavier</b> pour dicter.
            </p>
          ) : listening ? (
            <p className="text-[11px] text-copper">🎙️ Dictée en cours… parle, puis touche le micro pour arrêter.</p>
          ) : null}

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            📌 Épingler en haut
          </label>

          {err ? <div className="rounded-xl2 bg-clay/10 p-2 text-xs text-clay">{err}</div> : null}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={busy} className="btn-primary flex-1">
              {busy ? '…' : 'Enregistrer'}
            </button>
            {editing ? (
              <button onClick={remove} disabled={busy} className="btn border border-clay/50 text-clay">
                Supprimer
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function prettyDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
