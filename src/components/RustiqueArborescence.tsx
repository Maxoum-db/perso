import { useEffect, useMemo, useState } from 'react'
import {
  groupDecksByTheme,
  listRustiqueDecks,
  listRustiqueThemeCards,
  submitRustiqueReview,
  type RustiqueCard,
  type RustiqueDeck,
  type RustiqueThemeGroup,
} from '../lib/rustique'

// Arborescence : l'arbre complet du savoir du Hub — thème → paquet → notion —
// à déplier plutôt qu'une liste plate. L'idée n'est pas de lire linéairement
// (c'est le rôle d'Apprentissage) mais de VOIR comment les notions se
// rattachent les unes aux autres avant de les étudier : la structure porte
// une partie du sens (une notion d'apiculture n'a pas le même poids conceptuel
// selon qu'elle tombe sous Cœur apicole ou sous un paquet transversal).
// Mêmes données et même action de révision (FSRS, note 3/4) que
// RustiqueApprentissage — juste une autre porte d'entrée dans le même savoir.
export function RustiqueArborescence() {
  const [decks, setDecks] = useState<RustiqueDeck[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)

  const [openThemes, setOpenThemes] = useState<Set<string>>(new Set())
  const [themeCards, setThemeCards] = useState<Map<string, RustiqueCard[]>>(new Map())
  const [loadingTheme, setLoadingTheme] = useState<string | null>(null)

  const [openDecks, setOpenDecks] = useState<Set<string>>(new Set())
  const [openCards, setOpenCards] = useState<Set<string>>(new Set())
  const [revised, setRevised] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())

  useEffect(() => {
    listRustiqueDecks().then((res) => {
      if (res.status === 'not_configured') return setNotConfigured(true)
      if (res.status === 'error') return setError(res.message ?? 'Impossible de charger les modules.')
      setDecks(res.decks)
    })
  }, [])

  const themeGroups = useMemo(() => (decks ? groupDecksByTheme(decks) : []), [decks])

  async function toggleTheme(g: RustiqueThemeGroup) {
    if (openThemes.has(g.theme.id)) {
      setOpenThemes((s) => {
        const n = new Set(s)
        n.delete(g.theme.id)
        return n
      })
      return
    }
    setOpenThemes((s) => new Set(s).add(g.theme.id))
    if (!themeCards.has(g.theme.id)) {
      setLoadingTheme(g.theme.id)
      const res = await listRustiqueThemeCards(g.theme.id, false)
      setLoadingTheme(null)
      if (res.status === 'ok') setThemeCards((m) => new Map(m).set(g.theme.id, res.cards))
    }
  }

  function toggleDeck(deckId: string) {
    setOpenDecks((s) => {
      const n = new Set(s)
      n.has(deckId) ? n.delete(deckId) : n.add(deckId)
      return n
    })
  }

  function toggleCard(cardId: string) {
    setOpenCards((s) => {
      const n = new Set(s)
      n.has(cardId) ? n.delete(cardId) : n.add(cardId)
      return n
    })
  }

  async function marquerRevisee(cardId: string) {
    if (revised.has(cardId) || pending.has(cardId)) return
    setPending((s) => new Set(s).add(cardId))
    const ok = await submitRustiqueReview(cardId, 3)
    setPending((s) => {
      const n = new Set(s)
      n.delete(cardId)
      return n
    })
    if (ok) setRevised((s) => new Set(s).add(cardId))
  }

  if (notConfigured) {
    return (
      <div className="card space-y-2 border-sand/40 bg-sand/5 p-4 text-sm">
        <p className="font-bold text-ink">🔌 Connexion au hub à finaliser</p>
        <p className="text-muted">
          Ajoute les secrets <code className="rounded bg-bg px-1 text-copper">HUB_URL</code> et
          <code className="mx-1 rounded bg-bg px-1 text-copper">HUB_SERVICE_KEY</code> aux fonctions Rustique.
        </p>
      </div>
    )
  }

  if (error) return <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div>
  if (!decks) return <p className="text-center text-sm text-muted">Chargement de l'arbre…</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        Thème → paquet → notion : déplie pour voir comment tout se relie. Coche au fil de la lecture, comme dans
        Apprentissage.
      </p>
      {themeGroups.map((g) => (
        <ThemeNode
          key={g.theme.id}
          group={g}
          open={openThemes.has(g.theme.id)}
          loading={loadingTheme === g.theme.id}
          cards={themeCards.get(g.theme.id) ?? []}
          openDecks={openDecks}
          openCards={openCards}
          revised={revised}
          pending={pending}
          onToggle={() => toggleTheme(g)}
          onToggleDeck={toggleDeck}
          onToggleCard={toggleCard}
          onRevise={marquerRevisee}
        />
      ))}
    </div>
  )
}

function ThemeNode({
  group,
  open,
  loading,
  cards,
  openDecks,
  openCards,
  revised,
  pending,
  onToggle,
  onToggleDeck,
  onToggleCard,
  onRevise,
}: {
  group: RustiqueThemeGroup
  open: boolean
  loading: boolean
  cards: RustiqueCard[]
  openDecks: Set<string>
  openCards: Set<string>
  revised: Set<string>
  pending: Set<string>
  onToggle: () => void
  onToggleDeck: (deckId: string) => void
  onToggleCard: (cardId: string) => void
  onRevise: (cardId: string) => void
}) {
  const revisedInTheme = cards.filter((c) => revised.has(c.id)).length

  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} disabled={group.cardCount === 0} className="flex w-full items-center gap-3 p-3 text-left disabled:opacity-50">
        <span className="shrink-0 text-muted">{open ? '▾' : '▸'}</span>
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: group.theme.color }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-ink">{group.theme.title}</div>
          <div className="text-xs text-muted">
            {group.decks.length} paquet{group.decks.length > 1 ? 's' : ''} · {group.cardCount} notion
            {group.cardCount > 1 ? 's' : ''}
            {revisedInTheme > 0 ? ` · ${revisedInTheme} révisée${revisedInTheme > 1 ? 's' : ''} ici` : ''}
          </div>
        </div>
        {loading ? <span className="shrink-0 text-xs text-muted">…</span> : null}
      </button>

      {open ? (
        <div className="space-y-0.5 border-t border-line/60 bg-bg/40 p-2 pl-4">
          {group.decks.map((deck) => (
            <DeckNode
              key={deck.id}
              deck={deck}
              cards={cards.filter((c) => c.deck_id === deck.id)}
              open={openDecks.has(deck.id)}
              openCards={openCards}
              revised={revised}
              pending={pending}
              onToggle={() => onToggleDeck(deck.id)}
              onToggleCard={onToggleCard}
              onRevise={onRevise}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DeckNode({
  deck,
  cards,
  open,
  openCards,
  revised,
  pending,
  onToggle,
  onToggleCard,
  onRevise,
}: {
  deck: RustiqueDeck
  cards: RustiqueCard[]
  open: boolean
  openCards: Set<string>
  revised: Set<string>
  pending: Set<string>
  onToggle: () => void
  onToggleCard: (cardId: string) => void
  onRevise: (cardId: string) => void
}) {
  return (
    <div>
      <button onClick={onToggle} disabled={deck.cardCount === 0} className="flex w-full items-center gap-2 py-1.5 text-left disabled:opacity-50">
        <span className="shrink-0 text-[10px] text-muted">{open ? '▾' : '▸'}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{deck.title}</span>
        <span className="shrink-0 text-[11px] text-muted">{deck.cardCount}</span>
      </button>

      {open ? (
        <ul className="space-y-1 border-l border-line/40 py-1 pl-4">
          {cards.length === 0 ? (
            <li className="text-[11px] text-muted">Chargement…</li>
          ) : (
            cards.map((c) => (
              <CardNode
                key={c.id}
                card={c}
                open={openCards.has(c.id)}
                revised={revised.has(c.id)}
                pending={pending.has(c.id)}
                onToggle={() => onToggleCard(c.id)}
                onRevise={() => onRevise(c.id)}
              />
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}

function CardNode({
  card,
  open,
  revised,
  pending,
  onToggle,
  onRevise,
}: {
  card: RustiqueCard
  open: boolean
  revised: boolean
  pending: boolean
  onToggle: () => void
  onRevise: () => void
}) {
  return (
    <li className="rounded-lg bg-card/60 p-2">
      <button onClick={onToggle} className="flex w-full items-start gap-2 text-left">
        <span className="mt-0.5 shrink-0 text-[10px] text-muted">{open ? '▾' : '▸'}</span>
        <span className={`min-w-0 flex-1 whitespace-pre-wrap text-xs ${revised ? 'text-muted line-through' : 'text-ink'}`}>
          {card.front}
        </span>
      </button>
      {open ? (
        <div className="ml-4 mt-1.5 space-y-1.5 border-t border-line/40 pt-1.5">
          <div className="whitespace-pre-wrap text-xs text-ink">{card.back}</div>
          <button
            onClick={onRevise}
            disabled={revised || pending}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              revised ? 'bg-sage/20 text-sage' : 'bg-white/5 text-muted hover:text-ink'
            }`}
          >
            {revised ? '✓ révisée' : pending ? '…' : 'Marquer révisée'}
          </button>
        </div>
      ) : null}
    </li>
  )
}
