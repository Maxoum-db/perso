import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { SubTabs } from '../components/SubTabs'
import {
  type MySpace,
  type SharedEvent,
  type SharedListItem,
  type SharedListWithCount,
  type SharedNote,
  addSharedItem,
  clearDoneShared,
  createInvite,
  createSharedEvent,
  createSharedList,
  createSharedNote,
  createSpace,
  deleteSharedEvent,
  deleteSharedItem,
  deleteSharedList,
  deleteSharedNote,
  getMySpace,
  joinSpace,
  listSharedEvents,
  listSharedItems,
  listSharedLists,
  listSharedNotes,
  setSharedEventGoogleId,
  setSpaceCalendar,
  toggleSharedItem,
  updateSharedNote,
} from '../lib/space'
import { canWriteCalendar, createEvent, deleteEvent, listCalendars, type EventInput, type GCalendar } from '../lib/google'

const LIST_EMOJIS = ['📝', '🛒', '✅', '🎁', '🍽️', '🏖️', '🏠', '💡', '💕', '🧳']

const today = () => new Date().toISOString().slice(0, 10)
function frDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}
function frDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function Partage() {
  const { user } = useAuth()
  const [space, setSpace] = useState<MySpace | null | undefined>(undefined)
  const [tab, setTab] = useState<'listes' | 'mots' | 'agenda'>('mots')

  const me = useMemo(
    () => ({
      id: user?.id ?? '',
      name: (user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || user?.email || 'Moi',
      email: user?.email ?? '',
    }),
    [user],
  )

  async function reload() {
    setSpace(await getMySpace())
  }
  useEffect(() => {
    reload()
  }, [])

  if (space === undefined) return <p className="py-10 text-center text-sm text-muted">Chargement…</p>

  if (!space) return <Onboarding me={me} onReady={reload} />

  return (
    <div className="space-y-4">
      <SpaceHeader space={space} meId={me.id} />
      <SubTabs
        tabs={[
          { id: 'mots', label: '💌 Petits mots' },
          { id: 'listes', label: '🛒 Listes' },
          { id: 'agenda', label: '📅 Agenda' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === 'mots' ? (
        <NotesTab spaceId={space.spaceId} me={me} />
      ) : tab === 'listes' ? (
        <ListsTab spaceId={space.spaceId} />
      ) : (
        <EventsTab space={space} me={me} onSpaceReload={reload} />
      )}
    </div>
  )
}

// ── Onboarding : créer ou rejoindre un espace ───────────────────────────────

function Onboarding({ me, onReady }: { me: { id: string; name: string; email: string }; onReady: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setBusy(true)
    setError(null)
    try {
      await createSpace(me.name, me.email)
      onReady()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function join() {
    if (!code.trim()) return
    setBusy(true)
    setError(null)
    try {
      await joinSpace(code, me.name, me.email)
      onReady()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">💕 Espace partagé</h1>
        <p className="text-sm text-muted">Un espace à deux : listes, petits mots et agenda communs.</p>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      <section className="card space-y-2 p-4">
        <h2 className="font-bold text-ink">Créer notre espace</h2>
        <p className="text-sm text-muted">Crée l'espace, puis invite l'autre avec un code.</p>
        <button onClick={create} disabled={busy} className="btn-primary w-full py-2.5">
          Créer notre espace
        </button>
      </section>

      <div className="text-center text-xs text-muted">— ou —</div>

      <section className="card space-y-2 p-4">
        <h2 className="font-bold text-ink">Rejoindre avec un code</h2>
        <p className="text-sm text-muted">Tu as reçu un code d'invitation ? Saisis-le ici.</p>
        <div className="flex gap-2">
          <input
            className="field uppercase tracking-widest"
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button onClick={join} disabled={busy || !code.trim()} className="btn-primary shrink-0 px-4 py-2">
            Rejoindre
          </button>
        </div>
      </section>
    </div>
  )
}

// ── En-tête : membres + invitation ──────────────────────────────────────────

function SpaceHeader({ space, meId }: { space: MySpace; meId: string }) {
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const alone = space.members.length < 2

  async function invite() {
    setBusy(true)
    try {
      setCode(await createInvite())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-extrabold text-ink">💕 Espace partagé</h1>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {space.members.map((m) => (
          <span key={m.user_id} className="chip bg-copper/15 text-copper">
            {m.user_id === meId ? '🫶 ' : '👤 '}
            {m.display_name || m.email || 'Membre'}
          </span>
        ))}
        {alone ? (
          <button onClick={invite} disabled={busy} className="btn-ghost px-3 py-1 text-xs">
            + Inviter
          </button>
        ) : null}
      </div>

      {code ? (
        <div className="card border-copper/40 bg-copper/5 p-3 text-sm">
          <p className="text-muted">Partage ce code (valable 7 jours) :</p>
          <p className="mt-1 text-center text-2xl font-extrabold tracking-[0.3em] text-copper">{code}</p>
        </div>
      ) : null}
    </div>
  )
}

// ── Onglet Petits mots ──────────────────────────────────────────────────────

function NotesTab({ spaceId, me }: { spaceId: string; me: { id: string; name: string } }) {
  const [notes, setNotes] = useState<SharedNote[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  async function reload() {
    setNotes(await listSharedNotes(spaceId))
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId])

  async function send() {
    if (!draft.trim()) return
    setBusy(true)
    try {
      await createSharedNote(spaceId, draft, me)
      setDraft('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-2 p-3">
        <textarea
          className="field"
          rows={2}
          placeholder="Écris un petit mot… 💌"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button onClick={send} disabled={busy || !draft.trim()} className="btn-primary w-full py-2">
          Envoyer
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-center text-xs text-muted">Aucun mot pour l'instant. Lance-toi ! 💕</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} canEdit={n.author_id === me.id} onChange={reload} />
          ))}
        </ul>
      )}
    </div>
  )
}

function NoteCard({ note, canEdit, onChange }: { note: SharedNote; canEdit: boolean; onChange: () => void }) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(note.body)

  async function save() {
    await updateSharedNote(note.id, body)
    setEditing(false)
    onChange()
  }

  return (
    <li className="card p-3">
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span className="font-semibold text-ink">{note.author_name || 'Quelqu’un'}</span>
        <span>{frDateTime(note.updated_at)}</span>
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea className="field" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary flex-1 py-1.5 text-sm">
              Enregistrer
            </button>
            <button onClick={() => { setBody(note.body); setEditing(false) }} className="btn-ghost px-3 py-1.5 text-sm">
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm text-ink">{note.body}</p>
          {canEdit ? (
            <div className="mt-2 flex gap-3 text-xs">
              <button onClick={() => setEditing(true)} className="text-muted hover:text-copper">
                Modifier
              </button>
              <button
                onClick={() => confirm('Supprimer ce mot ?') && deleteSharedNote(note.id).then(onChange)}
                className="text-muted hover:text-clay"
              >
                Supprimer
              </button>
            </div>
          ) : null}
        </>
      )}
    </li>
  )
}

// ── Onglet Listes partagées ─────────────────────────────────────────────────

function ListsTab({ spaceId }: { spaceId: string }) {
  const [lists, setLists] = useState<SharedListWithCount[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🛒')

  async function reload() {
    setLists(await listSharedLists(spaceId))
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId])

  async function create() {
    if (!title.trim()) return
    await createSharedList(spaceId, title, emoji)
    setTitle('')
    setEmoji('🛒')
    setCreating(false)
    await reload()
  }

  return (
    <div className="space-y-3">
      {creating ? (
        <div className="card space-y-2 p-3">
          <input className="field" placeholder="Nom de la liste" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {LIST_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`rounded-lg px-2 py-1 text-lg ${emoji === e ? 'bg-copper/20' : 'bg-bg'}`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={!title.trim()} className="btn-primary flex-1 py-2">
              Créer
            </button>
            <button onClick={() => setCreating(false)} className="btn-ghost px-4 py-2">
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="btn-primary w-full py-2.5">
          + Nouvelle liste
        </button>
      )}

      {lists.length === 0 && !creating ? (
        <p className="text-center text-xs text-muted">Aucune liste partagée. 🛒</p>
      ) : null}

      <ul className="space-y-2">
        {lists.map((l) => (
          <li key={l.id} className="card overflow-hidden">
            <button onClick={() => setOpenId(openId === l.id ? null : l.id)} className="flex w-full items-center gap-3 p-3 text-left">
              <span className="text-xl">{l.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-ink">{l.title}</div>
                <div className="text-xs text-muted">{l.done}/{l.total} fait{l.total > 1 ? 's' : ''}</div>
              </div>
              <span className="shrink-0 text-muted">{openId === l.id ? '▾' : '▸'}</span>
            </button>
            {openId === l.id ? <ListItems spaceId={spaceId} listId={l.id} onCountChange={reload} onDeleteList={() => deleteSharedList(l.id).then(() => { setOpenId(null); reload() })} /> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ListItems({
  spaceId,
  listId,
  onCountChange,
  onDeleteList,
}: {
  spaceId: string
  listId: string
  onCountChange: () => void
  onDeleteList: () => void
}) {
  const [items, setItems] = useState<SharedListItem[]>([])
  const [content, setContent] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function reload() {
    setItems(await listSharedItems(listId))
    onCountChange()
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId])

  async function add() {
    const val = content.trim()
    if (!val) return
    setContent('')
    inputRef.current?.focus() // garder le clavier/curseur sur la barre
    try {
      await addSharedItem(spaceId, listId, val)
      await reload()
    } finally {
      inputRef.current?.focus()
    }
  }

  const hasDone = items.some((i) => i.done)

  return (
    <div className="space-y-2 border-t border-line/60 bg-bg/40 p-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          className="field"
          placeholder="Ajouter…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button onClick={add} disabled={!content.trim()} className="btn-primary shrink-0 px-4 py-2">
          +
        </button>
      </div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2">
            <button onClick={() => toggleSharedItem(it.id, !it.done).then(reload)} className="text-lg leading-none">
              {it.done ? '☑️' : '⬜'}
            </button>
            <span className={`flex-1 text-sm ${it.done ? 'text-muted line-through' : 'text-ink'}`}>{it.content}</span>
            <button onClick={() => deleteSharedItem(it.id).then(reload)} className="text-muted hover:text-clay">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-between pt-1 text-xs">
        {hasDone ? (
          <button onClick={() => clearDoneShared(listId).then(reload)} className="text-muted hover:text-copper">
            Effacer les cochés
          </button>
        ) : <span />}
        <button onClick={onDeleteList} className="text-muted hover:text-clay">
          Supprimer la liste
        </button>
      </div>
    </div>
  )
}

// ── Onglet Agenda commun ────────────────────────────────────────────────────

const TZ = 'Europe/Paris'
const pad = (n: number) => String(n).padStart(2, '0')

/** Convertit un événement partagé en événement Google (timé ou journée entière). */
function toEventInput(ev: { title: string; date: string; time?: string; note?: string }): EventInput {
  const description = ev.note?.trim() || undefined
  if (ev.time) {
    const [h, m] = ev.time.split(':').map(Number)
    let eh = h + 1
    let endDate = ev.date
    if (eh >= 24) {
      eh -= 24
      const d = new Date(`${ev.date}T00:00:00`)
      d.setDate(d.getDate() + 1)
      endDate = d.toISOString().slice(0, 10)
    }
    return {
      summary: ev.title,
      description,
      start: { dateTime: `${ev.date}T${pad(h)}:${pad(m)}:00`, timeZone: TZ },
      end: { dateTime: `${endDate}T${pad(eh)}:${pad(m)}:00`, timeZone: TZ },
    }
  }
  const next = new Date(`${ev.date}T00:00:00`)
  next.setDate(next.getDate() + 1)
  return { summary: ev.title, description, start: { date: ev.date }, end: { date: next.toISOString().slice(0, 10) } }
}

function EventsTab({
  space,
  me,
  onSpaceReload,
}: {
  space: MySpace
  me: { id: string; name: string }
  onSpaceReload: () => void
}) {
  const [events, setEvents] = useState<SharedEvent[]>([])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today())
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState<string | null>(null)

  const calId = space.googleCalendarId

  async function reload() {
    setEvents(await listSharedEvents(space.spaceId))
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.spaceId])

  async function add() {
    if (!title.trim()) return
    setBusy(true)
    setWarn(null)
    try {
      const id = await createSharedEvent(space.spaceId, { title, date, time, note }, me)
      if (calId) {
        try {
          const res = await createEvent(calId, toEventInput({ title, date, time, note }))
          if (res?.id) await setSharedEventGoogleId(id, res.id)
        } catch (e) {
          setWarn('Événement ajouté, mais pas copié dans Google Agenda : ' + (e as Error).message)
        }
      }
      setTitle('')
      setTime('')
      setNote('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(ev: SharedEvent) {
    if (!confirm('Supprimer cet événement ?')) return
    if (calId && ev.google_event_id) {
      try {
        await deleteEvent(calId, ev.google_event_id)
      } catch {
        // suppression Google best-effort
      }
    }
    await deleteSharedEvent(ev.id)
    await reload()
  }

  const todayStr = today()
  const upcoming = events.filter((e) => e.date >= todayStr)
  const past = events.filter((e) => e.date < todayStr).reverse()

  return (
    <div className="space-y-3">
      <CalendarLink space={space} onChange={onSpaceReload} />

      {warn ? <div className="card border-sand/40 bg-sand/5 p-2 text-xs text-clay">{warn}</div> : null}

      <div className="card space-y-2 p-3">
        <input className="field" placeholder="Événement (ex: Resto, Anniv…)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex gap-2">
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="field w-28 shrink-0" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <input className="field" placeholder="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={add} disabled={busy || !title.trim()} className="btn-primary w-full py-2">
          {calId ? 'Ajouter (+ Google Agenda)' : 'Ajouter'}
        </button>
      </div>

      <EventList title="À venir" events={upcoming} onDelete={handleDelete} empty="Rien de prévu. 📅" />
      {past.length > 0 ? <EventList title="Passés" events={past} onDelete={handleDelete} muted /> : null}
    </div>
  )
}

function CalendarLink({ space, onChange }: { space: MySpace; onChange: () => void }) {
  const [picking, setPicking] = useState(false)
  const [cals, setCals] = useState<GCalendar[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function openPicker() {
    setPicking(true)
    setError(null)
    if (cals) return
    try {
      const all = await listCalendars()
      setCals(all.filter(canWriteCalendar))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function pick(c: GCalendar) {
    setBusy(true)
    try {
      await setSpaceCalendar(c.id, c.summary)
      setPicking(false)
      onChange()
    } finally {
      setBusy(false)
    }
  }

  async function unlink() {
    setBusy(true)
    try {
      await setSpaceCalendar('', '')
      setPicking(false)
      onChange()
    } finally {
      setBusy(false)
    }
  }

  if (!picking) {
    return (
      <div className="card flex items-center gap-2 p-3 text-sm">
        <span className="text-lg">📆</span>
        <div className="min-w-0 flex-1">
          {space.googleCalendarId ? (
            <>
              <div className="font-semibold text-ink">Agenda Google lié</div>
              <div className="truncate text-xs text-muted">{space.googleCalendarName || space.googleCalendarId}</div>
            </>
          ) : (
            <div className="text-muted">Aucun agenda Google lié — les événements restent dans l'app.</div>
          )}
        </div>
        <button onClick={openPicker} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
          {space.googleCalendarId ? 'Changer' : 'Lier un agenda'}
        </button>
      </div>
    )
  }

  return (
    <div className="card space-y-2 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink">Choisis l'agenda Google partagé</span>
        <button onClick={() => setPicking(false)} className="text-xs text-copper">
          Fermer
        </button>
      </div>
      <p className="text-xs text-muted">
        Crée d'abord un agenda « Nous deux » dans Google Agenda et partage-le avec l'autre (droit de modification). Il
        apparaîtra ici.
      </p>
      {error ? <div className="text-xs text-clay">{error}</div> : null}
      {!cals ? (
        <p className="text-xs text-muted">Chargement des agendas…</p>
      ) : (
        <ul className="space-y-1">
          {cals.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => pick(c)}
                disabled={busy}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  space.googleCalendarId === c.id ? 'bg-copper/20 text-copper' : 'bg-bg text-ink hover:bg-copper/10'
                }`}
              >
                {c.summary}
                {c.primary ? ' (principal)' : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
      {space.googleCalendarId ? (
        <button onClick={unlink} disabled={busy} className="btn-ghost w-full py-1.5 text-xs text-clay">
          Délier l'agenda
        </button>
      ) : null}
    </div>
  )
}

function EventList({
  title,
  events,
  onDelete,
  empty,
  muted,
}: {
  title: string
  events: SharedEvent[]
  onDelete: (ev: SharedEvent) => void
  empty?: string
  muted?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
      {events.length === 0 ? (
        <p className="text-center text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className={`card flex items-start gap-3 p-3 ${muted ? 'opacity-60' : ''}`}>
              <div className="shrink-0 text-center">
                <div className="text-xs font-bold text-copper">{frDate(e.date)}</div>
                {e.time ? <div className="text-[11px] text-muted">{e.time}</div> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">
                  {e.title}
                  {e.google_event_id ? <span title="Dans Google Agenda"> 📆</span> : null}
                </div>
                {e.note ? <div className="text-xs text-muted">{e.note}</div> : null}
                {e.author_name ? <div className="text-[10px] text-muted">par {e.author_name}</div> : null}
              </div>
              <button onClick={() => onDelete(e)} className="shrink-0 text-muted hover:text-clay">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
