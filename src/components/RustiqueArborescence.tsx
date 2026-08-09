import { useEffect, useMemo, useState } from 'react'
import { useNotionsLues } from '../lib/notionsLues'
import {
  groupDecksByTheme,
  listRustiqueDecks,
  listRustiqueThemeCards,
  type RustiqueCard,
  type RustiqueDeck,
  type RustiqueThemeGroup,
} from '../lib/rustique'

// Arborescence : l'arbre VISUEL du savoir du Hub — thème → paquet → notion,
// avec de vraies lignes de branche (pas juste une liste indentée) — pour voir
// comment les notions se rattachent les unes aux autres avant de les étudier.
// La coche par notion est locale et librement réversible (lib/notionsLues) :
// cocher/décocher ne touche pas au planning FSRS, qui reste noté ailleurs
// (Quiz, Notion du jour) — un mis-clic ici ne coûte rien.
export function RustiqueArborescence() {
  const [decks, setDecks] = useState<RustiqueDeck[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)

  const [openThemes, setOpenThemes] = useState<Set<string>>(new Set())
  const [themeCards, setThemeCards] = useState<Map<string, RustiqueCard[]>>(new Map())
  const [loadingTheme, setLoadingTheme] = useState<string | null>(null)
  const [openDecks, setOpenDecks] = useState<Set<string>>(new Set())
  const [openCards, setOpenCards] = useState<Set<string>>(new Set())
  const { lues, toggle: toggleLue } = useNotionsLues()

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
    <div className="space-y-1">
      <p className="mb-2 text-xs text-muted">
        Thème → paquet → notion : déplie les branches pour voir comment tout se relie. Coche au fil de la lecture —
        décoche librement si tu coches par erreur, ça ne touche à rien côté révision.
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
          lues={lues}
          onToggle={() => toggleTheme(g)}
          onToggleDeck={toggleDeck}
          onToggleCard={toggleCard}
          onToggleLue={toggleLue}
        />
      ))}
    </div>
  )
}

/** Trait horizontal de branche, ancré à gauche de la ligne verticale du parent. */
function Branch({ color }: { color: string }) {
  return <span className="absolute -left-4 top-1/2 h-px w-4 -translate-y-1/2" style={{ background: color }} />
}

function ThemeNode({
  group,
  open,
  loading,
  cards,
  openDecks,
  openCards,
  lues,
  onToggle,
  onToggleDeck,
  onToggleCard,
  onToggleLue,
}: {
  group: RustiqueThemeGroup
  open: boolean
  loading: boolean
  cards: RustiqueCard[]
  openDecks: Set<string>
  openCards: Set<string>
  lues: Set<string>
  onToggle: () => void
  onToggleDeck: (deckId: string) => void
  onToggleCard: (cardId: string) => void
  onToggleLue: (cardId: string) => void
}) {
  const luesDansTheme = cards.filter((c) => lues.has(c.id)).length
  const lineColor = `${group.theme.color}88`

  return (
    <div className="py-0.5">
      <button
        onClick={onToggle}
        disabled={group.cardCount === 0}
        className="flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left transition hover:bg-white/5 disabled:opacity-50"
      >
        <span className="w-3 shrink-0 text-center text-[10px] text-muted">{group.cardCount > 0 ? (open ? '▾' : '▸') : ''}</span>
        <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-bg" style={{ backgroundColor: group.theme.color, boxShadow: `0 0 0 2px ${group.theme.color}33` }} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{group.theme.title}</span>
        <span className="shrink-0 text-[11px] text-muted">
          {loading ? '…' : `${group.decks.length}p · ${group.cardCount}n${luesDansTheme > 0 ? ` · ${luesDansTheme} lues` : ''}`}
        </span>
      </button>

      {open && group.decks.length > 0 ? (
        <div className="ml-[13px] space-y-0.5 border-l-2 py-1 pl-4" style={{ borderColor: lineColor }}>
          {group.decks.map((deck) => (
            <div key={deck.id} className="relative">
              <Branch color={lineColor} />
              <DeckNode
                deck={deck}
                cards={cards.filter((c) => c.deck_id === deck.id)}
                open={openDecks.has(deck.id)}
                openCards={openCards}
                lues={lues}
                onToggle={() => onToggleDeck(deck.id)}
                onToggleCard={onToggleCard}
                onToggleLue={onToggleLue}
              />
            </div>
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
  lues,
  onToggle,
  onToggleCard,
  onToggleLue,
}: {
  deck: RustiqueDeck
  cards: RustiqueCard[]
  open: boolean
  openCards: Set<string>
  lues: Set<string>
  onToggle: () => void
  onToggleCard: (cardId: string) => void
  onToggleLue: (cardId: string) => void
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        disabled={deck.cardCount === 0}
        className="flex w-full items-center gap-2 rounded-lg py-1 pr-2 text-left transition hover:bg-white/5 disabled:opacity-50"
      >
        <span className="w-2.5 shrink-0 text-center text-[9px] text-muted">{deck.cardCount > 0 ? (open ? '▾' : '▸') : ''}</span>
        <span className="h-2 w-2 shrink-0 rounded-sm bg-muted/70" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{deck.title}</span>
        <span className="shrink-0 text-[10px] text-muted">{deck.cardCount}</span>
      </button>

      {open ? (
        <div className="ml-[9px] space-y-0.5 border-l-2 border-line/40 py-1 pl-4">
          {cards.length === 0 ? (
            <p className="text-[11px] text-muted">Chargement…</p>
          ) : (
            cards.map((c) => (
              <div key={c.id} className="relative">
                <Branch color="rgb(var(--line))" />
                <CardNode
                  card={c}
                  open={openCards.has(c.id)}
                  lue={lues.has(c.id)}
                  onToggle={() => onToggleCard(c.id)}
                  onToggleLue={() => onToggleLue(c.id)}
                />
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function CardNode({
  card,
  open,
  lue,
  onToggle,
  onToggleLue,
}: {
  card: RustiqueCard
  open: boolean
  lue: boolean
  onToggle: () => void
  onToggleLue: () => void
}) {
  return (
    <div className="rounded-lg py-1">
      <div className="flex items-start gap-2">
        <button
          onClick={onToggleLue}
          title={lue ? 'Décocher (marquer comme non lue)' : 'Marquer comme lue'}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition ${
            lue ? 'border-sage bg-sage text-white' : 'border-line text-transparent hover:border-copper'
          }`}
        >
          ✓
        </button>
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-1.5 text-left">
          <span className="mt-0.5 shrink-0 text-[9px] text-muted">{open ? '▾' : '▸'}</span>
          <span className={`min-w-0 flex-1 whitespace-pre-wrap text-xs ${lue ? 'text-muted line-through' : 'text-ink'}`}>
            {card.front}
          </span>
        </button>
      </div>
      {open ? (
        <div className="ml-[26px] mt-1 whitespace-pre-wrap border-t border-line/40 pt-1.5 text-xs text-ink">{card.back}</div>
      ) : null}
    </div>
  )
}
