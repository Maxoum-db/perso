import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { SubTabs } from '../components/SubTabs'
import {
  BREW_EVENT_KINDS,
  BREW_STATUSES,
  type Brew,
  type BrewEvent,
  type BrewEventKind,
  type BrewStatus,
  type HubRecipe,
  type HubRecipesResult,
  addBrewEvent,
  computeAbv,
  createBrew,
  deleteBrew,
  deleteBrewEvent,
  fetchHubRecipes,
  listBrewEvents,
  listBrews,
  updateBrew,
} from '../lib/brews'

const today = () => new Date().toISOString().slice(0, 10)

function frDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
}

function statusMeta(s: BrewStatus) {
  return BREW_STATUSES.find((x) => x.id === s) ?? BREW_STATUSES[0]
}

// Hub Brassage : carnet de brassins (journal de fermentation + dégustations)
// relié en lecture seule au catalogue de recettes du hub.
export function Brassage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'brassins' | 'recettes'>('brassins')
  const [brews, setBrews] = useState<Brew[]>([])
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!user) return
    try {
      setBrews(await listBrews(user.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function brewFromRecipe(r: HubRecipe) {
    if (!user) return
    await createBrew(user.id, {
      recipe_id: r.id,
      recipe_name: r.name,
      recipe_type: r.type || 'beer',
      style: r.style ?? '',
      batch_size_l: r.batch_size_l ?? null,
      brew_date: today(),
      status: 'planifie',
    })
    await reload()
    setTab('brassins')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">🍺 Carnet de brassage</h1>
        <p className="text-sm text-muted">Tes brassins, fermentation et dégustations — reliés à tes recettes du hub.</p>
      </div>

      <SubTabs
        tabs={[
          { id: 'brassins', label: '🍻 Mes brassins' },
          { id: 'recettes', label: '📖 Recettes' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      {tab === 'brassins' ? (
        <BrewsTab userId={user?.id ?? ''} brews={brews} onChange={reload} />
      ) : (
        <RecipesTab onBrew={brewFromRecipe} />
      )}
    </div>
  )
}

// ── Onglet Brassins ─────────────────────────────────────────────────────────

function BrewsTab({ userId, brews, onChange }: { userId: string; brews: Brew[]; onChange: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-3">
      {creating ? (
        <NewBrewForm userId={userId} onDone={() => { setCreating(false); onChange() }} onCancel={() => setCreating(false)} />
      ) : (
        <button onClick={() => setCreating(true)} className="btn-primary w-full py-2.5">
          + Nouveau brassin
        </button>
      )}

      {brews.length === 0 && !creating ? (
        <p className="text-center text-xs text-muted">
          Aucun brassin. Crée-en un, ou pars d'une recette dans l'onglet 📖 Recettes. 🍻
        </p>
      ) : null}

      <ul className="space-y-2">
        {brews.map((b) => (
          <li key={b.id}>
            <BrewCard
              brew={b}
              open={openId === b.id}
              onToggle={() => setOpenId(openId === b.id ? null : b.id)}
              userId={userId}
              onChange={onChange}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function BrewCard({
  brew,
  open,
  onToggle,
  userId,
  onChange,
}: {
  brew: Brew
  open: boolean
  onToggle: () => void
  userId: string
  onChange: () => void
}) {
  const sm = statusMeta(brew.status)
  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        <span className="text-xl">{brew.recipe_type === 'spirit' ? '🥃' : '🍺'}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-ink">{brew.recipe_name || 'Brassin'}</div>
          <div className="truncate text-xs text-muted">
            {brew.style ? `${brew.style} · ` : ''}
            {frDate(brew.brew_date)}
            {brew.abv ? ` · ${brew.abv}%` : ''}
            {brew.rating ? ` · ${'⭐'.repeat(Math.round(brew.rating))}` : ''}
          </div>
        </div>
        <span className="chip shrink-0 bg-copper/15 text-copper">{sm.emoji} {sm.label}</span>
      </button>
      {open ? <BrewDetail brew={brew} userId={userId} onChange={onChange} /> : null}
    </div>
  )
}

function BrewDetail({ brew, userId, onChange }: { brew: Brew; userId: string; onChange: () => void }) {
  const [status, setStatus] = useState<BrewStatus>(brew.status)
  const [og, setOg] = useState(brew.og?.toString() ?? '')
  const [fg, setFg] = useState(brew.fg?.toString() ?? '')
  const [rating, setRating] = useState<number>(brew.rating ?? 0)
  const [tasting, setTasting] = useState(brew.tasting_notes)
  const [notes, setNotes] = useState(brew.notes)
  const [events, setEvents] = useState<BrewEvent[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const num = (s: string) => (s.trim() === '' ? null : parseFloat(s.replace(',', '.')))
  const abv = useMemo(() => computeAbv(num(og), num(fg)), [og, fg])

  async function reloadEvents() {
    setEvents(await listBrewEvents(brew.id))
  }
  useEffect(() => {
    reloadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brew.id])

  async function save() {
    setSaving(true)
    try {
      await updateBrew(brew.id, {
        status,
        og: num(og),
        fg: num(fg),
        abv,
        rating: rating || null,
        tasting_notes: tasting.trim(),
        notes: notes.trim(),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
      onChange()
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm('Supprimer ce brassin et son journal ?')) return
    await deleteBrew(brew.id)
    onChange()
  }

  return (
    <div className="space-y-4 border-t border-line/60 bg-bg/40 p-3">
      {/* Statut */}
      <div className="flex flex-wrap gap-1.5">
        {BREW_STATUSES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStatus(s.id)}
            className={`chip ${status === s.id ? 'bg-copper text-white' : 'bg-card text-muted'}`}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {/* Densités + ABV calculé */}
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="text-xs text-muted">DI (OG)</span>
          <input className="field" inputMode="decimal" placeholder="1.050" value={og} onChange={(e) => setOg(e.target.value)} />
        </label>
        <label className="flex-1">
          <span className="text-xs text-muted">DF (FG)</span>
          <input className="field" inputMode="decimal" placeholder="1.010" value={fg} onChange={(e) => setFg(e.target.value)} />
        </label>
        <div className="flex-1 text-center">
          <div className="text-xs text-muted">ABV estimé</div>
          <div className="text-lg font-extrabold text-copper">{abv != null ? `${abv}%` : '—'}</div>
        </div>
      </div>

      {/* Note dégustation (étoiles) */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Note</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n === rating ? 0 : n)} className="text-xl leading-none">
            {n <= rating ? '⭐' : '☆'}
          </button>
        ))}
      </div>

      <textarea
        className="field"
        rows={2}
        placeholder="Notes de dégustation (arômes, amertume, défauts…)"
        value={tasting}
        onChange={(e) => setTasting(e.target.value)}
      />
      <textarea
        className="field"
        rows={2}
        placeholder="Notes de brassage (process, ajustements…)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="btn-primary flex-1 py-2">
          {saved ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
        <button onClick={remove} className="btn-ghost px-3 py-2 text-clay">
          Supprimer
        </button>
      </div>

      {/* Journal de fermentation */}
      <FermentationLog userId={userId} brewId={brew.id} events={events} onChange={reloadEvents} />
    </div>
  )
}

function FermentationLog({
  userId,
  brewId,
  events,
  onChange,
}: {
  userId: string
  brewId: string
  events: BrewEvent[]
  onChange: () => void
}) {
  const [date, setDate] = useState(today())
  const [kind, setKind] = useState<BrewEventKind>('mesure')
  const [gravity, setGravity] = useState('')
  const [temp, setTemp] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const num = (s: string) => (s.trim() === '' ? null : parseFloat(s.replace(',', '.')))
  const showGravity = kind === 'mesure'

  async function add() {
    setBusy(true)
    try {
      await addBrewEvent(userId, brewId, {
        date,
        kind,
        gravity: showGravity ? num(gravity) : null,
        temp_c: num(temp),
        note,
      })
      setGravity('')
      setTemp('')
      setNote('')
      onChange()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl2 border border-line/60 p-3">
      <h3 className="mb-2 text-sm font-extrabold text-ink">📒 Journal de fermentation</h3>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as BrewEventKind)}>
            {BREW_EVENT_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.emoji} {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          {showGravity ? (
            <input
              className="field w-28 shrink-0"
              inputMode="decimal"
              placeholder="densité"
              value={gravity}
              onChange={(e) => setGravity(e.target.value)}
            />
          ) : null}
          <input
            className="field w-20 shrink-0"
            inputMode="decimal"
            placeholder="°C"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
          />
          <input className="field" placeholder="Remarque…" value={note} onChange={(e) => setNote(e.target.value)} />
          <button onClick={add} disabled={busy} className="btn-primary shrink-0 px-4 py-2">
            +
          </button>
        </div>
      </div>

      {events.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {events.map((ev) => {
            const meta = BREW_EVENT_KINDS.find((k) => k.id === ev.kind)
            return (
              <li key={ev.id} className="flex items-start gap-2 text-sm">
                <span className="w-16 shrink-0 text-xs text-muted">{frDate(ev.date)}</span>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-ink">{meta?.emoji} {meta?.label}</span>
                  {ev.gravity != null ? <span className="text-copper"> · {ev.gravity}</span> : null}
                  {ev.temp_c != null ? <span className="text-muted"> · {ev.temp_c}°C</span> : null}
                  {ev.note ? <div className="text-xs text-muted">{ev.note}</div> : null}
                </div>
                <button
                  onClick={() => deleteBrewEvent(ev.id).then(onChange)}
                  className="shrink-0 text-muted hover:text-clay"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted">Ajoute mesures de densité, dry hop, transferts…</p>
      )}
    </div>
  )
}

function NewBrewForm({ userId, onDone, onCancel }: { userId: string; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('beer')
  const [style, setStyle] = useState('')
  const [batch, setBatch] = useState('')
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await createBrew(userId, {
        recipe_name: name.trim(),
        recipe_type: type,
        style: style.trim(),
        batch_size_l: batch.trim() ? parseFloat(batch.replace(',', '.')) : null,
        brew_date: date,
        status: 'planifie',
      })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card space-y-2 p-3">
      <h2 className="text-sm font-extrabold text-ink">Nouveau brassin</h2>
      <input className="field" placeholder="Nom (ex: IPA maison)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2">
        <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="beer">🍺 Bière</option>
          <option value="spirit">🥃 Spiritueux</option>
        </select>
        <input className="field" placeholder="Style" value={style} onChange={(e) => setStyle(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <input
          className="field w-28 shrink-0"
          inputMode="decimal"
          placeholder="Litres"
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
        />
        <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button onClick={create} disabled={busy || !name.trim()} className="btn-primary flex-1 py-2">
          Créer
        </button>
        <button onClick={onCancel} className="btn-ghost px-4 py-2">
          Annuler
        </button>
      </div>
    </section>
  )
}

// ── Onglet Recettes (hub, lecture seule) ────────────────────────────────────

function RecipesTab({ onBrew }: { onBrew: (r: HubRecipe) => void }) {
  const [res, setRes] = useState<HubRecipesResult | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'beer' | 'spirit'>('all')

  useEffect(() => {
    fetchHubRecipes().then(setRes)
  }, [])

  const recipes = useMemo(() => {
    const all = res?.recipes ?? []
    const ql = q.trim().toLowerCase()
    return all.filter((r) => {
      if (filter === 'beer' && r.type !== 'beer') return false
      if (filter === 'spirit' && r.type !== 'spirit') return false
      if (!ql) return true
      return (
        r.name.toLowerCase().includes(ql) ||
        (r.style ?? '').toLowerCase().includes(ql) ||
        (r.beer_category ?? '').toLowerCase().includes(ql)
      )
    })
  }, [res, q, filter])

  if (!res) {
    return <p className="text-center text-sm text-muted">Chargement des recettes…</p>
  }

  if (res.status === 'not_configured') {
    return (
      <div className="card space-y-2 border-sand/40 bg-sand/5 p-4 text-sm">
        <p className="font-bold text-ink">🔌 Connexion au hub à finaliser</p>
        <p className="text-muted">
          Le proxy sécurisé est en place, mais il manque deux secrets côté serveur pour lire tes recettes :
          <code className="mx-1 rounded bg-bg px-1 text-copper">HUB_URL</code> et
          <code className="mx-1 rounded bg-bg px-1 text-copper">HUB_SERVICE_KEY</code>.
        </p>
        <p className="text-muted">
          Ajoute-les dans les secrets de la fonction <b>hub-recipes</b> (projet Aide), comme pour Google. En attendant, tu
          peux créer tes brassins à la main dans l'onglet 🍻.
        </p>
      </div>
    )
  }

  if (res.status === 'error') {
    return (
      <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">
        Impossible de charger les recettes du hub.{res.message ? ` (${res.message})` : ''}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <input className="field" placeholder="Rechercher une recette…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-1.5">
        {([
          ['all', 'Tout'],
          ['beer', '🍺 Bières'],
          ['spirit', '🥃 Spiritueux'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`chip ${filter === id ? 'bg-copper text-white' : 'bg-card text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted">{recipes.length} recette{recipes.length > 1 ? 's' : ''}</p>

      <ul className="space-y-2">
        {recipes.map((r) => (
          <li key={r.id} className="card flex items-center gap-3 p-3">
            <span className="text-xl">{r.type === 'spirit' ? '🥃' : '🍺'}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-bold text-ink">{r.name}</span>
                {r.favorite ? <span title="Favori">⭐</span> : null}
                {r.tried ? <span title="Déjà brassée">✓</span> : null}
                {r.kind === 'nouvelle' ? (
                  <span className="chip shrink-0 bg-sage/20 px-2 py-0.5 text-[10px] text-sage-dark">🆕 Nouvelle</span>
                ) : null}
                {r.kind === 'optimisation' ? (
                  <span className="chip shrink-0 bg-plum/20 px-2 py-0.5 text-[10px] text-plum">⚗️ Optim.</span>
                ) : null}
              </div>
              <div className="truncate text-xs text-muted">
                {[r.style, r.abv ? `${r.abv}%` : null, r.ibu ? `${r.ibu} IBU` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <button onClick={() => onBrew(r)} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
              Brasser
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
