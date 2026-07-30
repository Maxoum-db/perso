import { useEffect, useState } from 'react'
import {
  GoogleAuthError,
  createTask,
  deleteTask,
  hasFreshGoogleToken,
  listTaskLists,
  listTasks,
  setTaskStatus,
  type GTask,
  type GTaskList,
} from '../lib/google'
import { ReconnectGoogle } from '../components/ReconnectGoogle'

/**
 * Tâches Google.
 *
 * `embedded` sert à la fusion avec les notes : dans l'onglet commun, ce bloc
 * n'est plus une page mais une section. Il perd son titre de niveau 1 et, quand
 * Google n'est pas connecté, il se réduit à une ligne au lieu de confisquer
 * l'écran — sinon les notes, qui n'ont rien à voir avec Google, disparaîtraient
 * avec lui.
 */
export function Tasks({ embedded = false }: { embedded?: boolean } = {}) {
  const [needAuth, setNeedAuth] = useState(!hasFreshGoogleToken())
  const [lists, setLists] = useState<GTaskList[]>([])
  const [listId, setListId] = useState<string>('')
  const [tasks, setTasks] = useState<GTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    if (!hasFreshGoogleToken()) {
      setNeedAuth(true)
      return
    }
    listTaskLists()
      .then((ls) => {
        setLists(ls)
        setListId((id) => id || ls[0]?.id || '')
      })
      .catch((e) => (e instanceof GoogleAuthError ? setNeedAuth(true) : setError((e as Error).message)))
  }, [])

  function reload(id = listId) {
    if (!id) return
    setLoading(true)
    setError(null)
    listTasks(id, showDone)
      .then(setTasks)
      .catch((e) => (e instanceof GoogleAuthError ? setNeedAuth(true) : setError((e as Error).message)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (listId) reload(listId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, showDone])

  async function add() {
    const t = newTitle.trim()
    if (!t || !listId) return
    setNewTitle('')
    try {
      await createTask(listId, t)
      reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function toggle(task: GTask) {
    // Optimiste
    setTasks((prev) => prev.filter((x) => x.id !== task.id || showDone))
    try {
      await setTaskStatus(listId, task.id, task.status === 'completed' ? 'needsAction' : 'completed')
      reload()
    } catch (e) {
      setError((e as Error).message)
      reload()
    }
  }

  async function remove(task: GTask) {
    setTasks((prev) => prev.filter((x) => x.id !== task.id))
    try {
      await deleteTask(listId, task.id)
    } catch (e) {
      setError((e as Error).message)
      reload()
    }
  }

  if (needAuth) {
    if (!embedded) return <ReconnectGoogle />
    return (
      <p className="text-xs text-muted">
        ✅ Tâches : <b className="text-ink">Google non connecté</b> — va dans Réglages ⚙️ pour les récupérer ici.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {embedded ? (
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">✅ À faire</h2>
        ) : (
          <h1 className="text-2xl font-extrabold text-ink">✅ Tâches</h1>
        )}
        {lists.length > 1 ? (
          <select className="field max-w-[55%]" value={listId} onChange={(e) => setListId(e.target.value)}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <input
          className="field"
          placeholder="Nouvelle tâche…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} className="btn-primary shrink-0 px-4 py-2">
          +
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
        Afficher les tâches terminées
      </label>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}
      {loading ? <div className="animate-pulse text-sm text-muted">Chargement…</div> : null}

      {!loading && tasks.length === 0 ? (
        // Intégré, la grosse carte vide pousserait les notes hors de l'écran.
        embedded ? (
          <p className="text-xs text-muted">Rien à faire. 🎉</p>
        ) : (
          <div className="card p-6 text-center text-sm text-muted">Rien à faire ici. 🎉</div>
        )
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="card flex items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={t.status === 'completed'}
                onChange={() => toggle(t)}
                className="h-5 w-5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className={`truncate ${t.status === 'completed' ? 'text-muted line-through' : 'text-ink'}`}>
                  {t.title || '(sans titre)'}
                </div>
                {t.due ? <div className="text-[11px] text-muted">📅 {new Date(t.due).toLocaleDateString('fr-FR')}</div> : null}
              </div>
              <button onClick={() => remove(t)} title="Supprimer" className="shrink-0 text-muted hover:text-clay">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
