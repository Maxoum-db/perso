import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  GoogleAuthError,
  createTask,
  hasFreshGoogleToken,
  listRecentEmails,
  listTaskLists,
  type GMessage,
} from '../lib/google'
import { createNote } from '../lib/notes'
import { ReconnectGoogle } from '../components/ReconnectGoogle'

const FILTERS = [
  { id: 'in:inbox', label: 'Boîte de réception' },
  { id: 'is:unread', label: 'Non lus' },
  { id: 'is:important', label: 'Importants' },
]

export function Mails() {
  const { user } = useAuth()
  const [needAuth, setNeedAuth] = useState(!hasFreshGoogleToken())
  const [filter, setFilter] = useState('in:inbox')
  const [mails, setMails] = useState<GMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!hasFreshGoogleToken()) {
      setNeedAuth(true)
      return
    }
    setMails(null)
    setError(null)
    listRecentEmails(filter, 15)
      .then(setMails)
      .catch((e) => (e instanceof GoogleAuthError ? setNeedAuth(true) : setError((e as Error).message)))
  }, [filter])

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function toNote(m: GMessage) {
    if (!user) return
    try {
      await createNote(user.id, {
        title: m.subject,
        body: `📧 De : ${m.from}\n\n${m.snippet}`,
        category: 'autre',
        pinned: false,
      })
      flash('Note créée ✓')
    } catch (e) {
      flash('Erreur : ' + (e as Error).message)
    }
  }

  async function toTask(m: GMessage) {
    try {
      const lists = await listTaskLists()
      const listId = lists[0]?.id
      if (!listId) return flash('Aucune liste de tâches')
      await createTask(listId, m.subject)
      flash('Tâche créée ✓')
    } catch (e) {
      flash('Erreur : ' + (e as Error).message)
    }
  }

  if (needAuth) return <ReconnectGoogle />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-ink">📧 Mails</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="chip border transition"
            style={{
              borderColor: filter === f.id ? 'rgb(var(--copper))' : 'rgb(var(--line))',
              background: filter === f.id ? 'rgb(var(--copper) / .25)' : 'transparent',
              color: 'rgb(var(--ink))',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="card whitespace-pre-line break-words border-clay/40 bg-clay/5 p-3 text-sm text-clay">
          {error}
        </div>
      ) : null}
      {mails === null && !error ? <div className="animate-pulse text-sm text-muted">Chargement…</div> : null}
      {mails && mails.length === 0 ? <div className="card p-6 text-center text-sm text-muted">Aucun mail. 📭</div> : null}

      <ul className="space-y-2">
        {(mails || []).map((m) => (
          <li key={m.id} className="card p-3">
            <div className="flex items-baseline gap-2">
              {m.unread ? <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-copper" /> : null}
              <span className={`truncate text-xs ${m.unread ? 'font-bold text-ink' : 'text-muted'}`}>{m.from}</span>
              <span className="ml-auto shrink-0 text-[10px] text-muted">{shortDate(m.date)}</span>
            </div>
            <div className={`mt-0.5 truncate text-sm ${m.unread ? 'font-bold text-ink' : 'text-ink'}`}>{m.subject}</div>
            <div className="mt-0.5 line-clamp-2 text-xs text-muted">{m.snippet}</div>
            <div className="mt-2 flex items-center gap-2">
              <a
                href={`https://mail.google.com/mail/u/0/#all/${m.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost px-2.5 py-1 text-xs"
              >
                Ouvrir
              </a>
              <button onClick={() => toNote(m)} className="btn-ghost px-2.5 py-1 text-xs">
                📝 Note
              </button>
              <button onClick={() => toTask(m)} className="btn-ghost px-2.5 py-1 text-xs">
                ✅ Tâche
              </button>
            </div>
          </li>
        ))}
      </ul>

      {toast ? (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-xs font-semibold text-bg shadow-lift">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

function shortDate(d?: string): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
