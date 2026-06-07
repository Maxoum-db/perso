import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  LIST_EMOJIS,
  addItem,
  clearDone,
  createListe,
  deleteItem,
  deleteListe,
  listItems,
  listListes,
  toggleItem,
  updateListe,
  type ListItem,
  type ListeWithCount,
} from '../lib/lists'

export function Listes() {
  const { user } = useAuth()
  const [lists, setLists] = useState<ListeWithCount[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newListTitle, setNewListTitle] = useState('')

  async function reloadLists() {
    if (!user) return
    try {
      setLists(await listListes(user.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    reloadLists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function addList() {
    if (!user) return
    // Le + crée toujours une liste, même sans nom (renommable ensuite).
    const t = newListTitle.trim() || 'Ma liste'
    setNewListTitle('')
    setError(null)
    try {
      const l = await createListe(user.id, t)
      await reloadLists()
      setOpenId(l.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (openId) {
    const current = lists?.find((l) => l.id === openId)
    return (
      <ListDetail
        listId={openId}
        title={current?.title ?? 'Liste'}
        emoji={current?.emoji ?? '📝'}
        onBack={() => {
          setOpenId(null)
          reloadLists()
        }}
        onChanged={reloadLists}
      />
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-ink">📝 Mes listes</h1>

      <div className="flex items-center gap-2">
        <input
          className="field"
          placeholder="Nouvelle liste (Courses, À faire…)"
          value={newListTitle}
          onChange={(e) => setNewListTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addList()}
        />
        <button onClick={addList} className="btn-primary shrink-0 px-4 py-2">
          +
        </button>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      {lists === null ? (
        <div className="animate-pulse text-sm text-muted">Chargement…</div>
      ) : lists.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          Aucune liste pour l'instant. Crée-en une ci-dessus. 🙂
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {lists.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => setOpenId(l.id)}
                className="card flex h-full w-full flex-col items-start p-4 text-left transition hover:shadow-lift"
              >
                <span className="text-2xl">{l.emoji}</span>
                <span className="mt-1 w-full truncate text-sm font-bold text-ink">{l.title}</span>
                <span className="text-xs text-muted">
                  {l.total === 0
                    ? 'vide'
                    : l.done === l.total
                      ? `tout fait ✓ (${l.total})`
                      : `${l.done}/${l.total} fait`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ListDetail({
  listId,
  title,
  emoji,
  onBack,
  onChanged,
}: {
  listId: string
  title: string
  emoji: string
  onBack: () => void
  onChanged: () => void
}) {
  const { user } = useAuth()
  const [items, setItems] = useState<ListItem[] | null>(null)
  const [newItem, setNewItem] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftEmoji, setDraftEmoji] = useState(emoji)

  async function reload() {
    try {
      setItems(await listItems(listId))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId])

  async function add() {
    const t = newItem.trim()
    if (!t || !user) return
    setNewItem('')
    try {
      const it = await addItem(user.id, listId, t)
      setItems((prev) => [...(prev ?? []), it])
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function toggle(it: ListItem) {
    setItems((prev) => prev?.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)) ?? null)
    try {
      await toggleItem(it.id, !it.done)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
      reload()
    }
  }

  async function remove(it: ListItem) {
    setItems((prev) => prev?.filter((x) => x.id !== it.id) ?? null)
    try {
      await deleteItem(it.id)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
      reload()
    }
  }

  async function saveHeader() {
    setEditing(false)
    try {
      await updateListe(listId, { title: draftTitle.trim() || 'Liste', emoji: draftEmoji })
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function removeList() {
    if (!confirm('Supprimer cette liste et tout son contenu ?')) return
    try {
      await deleteListe(listId)
      onBack()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const doneCount = items?.filter((i) => i.done).length ?? 0

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm font-semibold text-copper">
        ‹ Toutes les listes
      </button>

      {editing ? (
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {LIST_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setDraftEmoji(e)}
                className={`rounded-xl2 px-2 py-1 text-xl transition ${
                  draftEmoji === e ? 'bg-copper/20 ring-1 ring-copper' : 'hover:bg-card'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            className="field"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveHeader()}
            autoFocus
          />
          <div className="flex items-center justify-between">
            <button onClick={removeList} className="text-sm font-semibold text-clay">
              🗑️ Supprimer la liste
            </button>
            <button onClick={saveHeader} className="btn-primary px-4 py-2">
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex min-w-0 items-center gap-2 text-2xl font-extrabold text-ink">
            <span>{emoji}</span>
            <span className="truncate">{title}</span>
          </h1>
          <button
            onClick={() => {
              setDraftTitle(title)
              setDraftEmoji(emoji)
              setEditing(true)
            }}
            className="shrink-0 text-sm font-semibold text-muted hover:text-ink"
          >
            Modifier
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          className="field"
          placeholder="Ajouter un élément…"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} className="btn-primary shrink-0 px-4 py-2">
          +
        </button>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      {items === null ? (
        <div className="animate-pulse text-sm text-muted">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">Liste vide. Ajoute un premier élément. ✍️</div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="card flex items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={it.done}
                onChange={() => toggle(it)}
                className="h-5 w-5 shrink-0"
              />
              <span className={`min-w-0 flex-1 break-words ${it.done ? 'text-muted line-through' : 'text-ink'}`}>
                {it.content}
              </span>
              <button onClick={() => remove(it)} title="Supprimer" className="shrink-0 text-muted hover:text-clay">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {doneCount > 0 ? (
        <button
          onClick={async () => {
            await clearDone(listId)
            reload()
            onChanged()
          }}
          className="text-xs font-semibold text-muted hover:text-clay"
        >
          Effacer les {doneCount} élément(s) coché(s)
        </button>
      ) : null}
    </div>
  )
}
