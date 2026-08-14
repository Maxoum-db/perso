import { useEffect, useMemo, useState } from 'react'
import { dysTextStyle, readDyslexiaMode, writeDyslexiaMode } from '../lib/dyslexiaMode'
import { useNotionsLues } from '../lib/notionsLues'
import {
  groupDecksByTheme,
  listRustiqueDecks,
  listRustiqueThemeCards,
  type RustiqueCard,
  type RustiqueDeck,
  type RustiqueThemeGroup,
} from '../lib/rustique'

/** Même ordre que l'affichage de l'arbre (regroupé par paquet, dans l'ordre du thème) — sert au Précédent/Suivant plein écran. */
function flattenByDeck(theme: RustiqueThemeGroup, cards: RustiqueCard[]): RustiqueCard[] {
  return theme.decks.flatMap((d) => cards.filter((c) => c.deck_id === d.id))
}

// Apprentissage : l'arbre du savoir du Hub (thème → paquet → notion), avec de
// vraies lignes de branche — pour voir comment tout se relie avant de plonger.
// Cliquer une notion l'ouvre en PLEIN ÉCRAN (question, réponse, coche, et
// Précédent/Suivant pour enchaîner sans revenir à l'arbre) plutôt qu'un petit
// bloc replié dans la liste. La coche est locale et librement réversible
// (lib/notionsLues) ; noter une carte pour de vrai (FSRS) reste un geste à
// part, au Quiz ou depuis la Notion du jour de l'accueil.
export function RustiqueApprentissage({
  autoOpenThemeId,
  autoOpenCardId,
}: {
  autoOpenThemeId?: string
  autoOpenCardId?: string
}) {
  const [decks, setDecks] = useState<RustiqueDeck[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const [dys, setDys] = useState(false)

  const [openThemes, setOpenThemes] = useState<Set<string>>(new Set())
  const [themeCards, setThemeCards] = useState<Map<string, RustiqueCard[]>>(new Map())
  const [loadingTheme, setLoadingTheme] = useState<string | null>(null)
  const [openDecks, setOpenDecks] = useState<Set<string>>(new Set())
  const [fullscreen, setFullscreen] = useState<{ theme: RustiqueThemeGroup; index: number } | null>(null)
  const { lues, toggle: toggleLue } = useNotionsLues()

  useEffect(() => {
    setDys(readDyslexiaMode())
    listRustiqueDecks().then((res) => {
      if (res.status === 'not_configured') return setNotConfigured(true)
      if (res.status === 'error') return setError(res.message ?? 'Impossible de charger les modules.')
      setDecks(res.decks)
      // Arrivée depuis la Notion du jour (accueil) : ouvre directement le
      // thème, et si une carte précise est visée, saute droit en plein écran.
      if (autoOpenThemeId) {
        const target = groupDecksByTheme(res.decks).find((g) => g.theme.id === autoOpenThemeId)
        if (target) openTheme(target, autoOpenCardId)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleDys() {
    const next = !dys
    setDys(next)
    writeDyslexiaMode(next)
  }

  const themeGroups = useMemo(() => (decks ? groupDecksByTheme(decks) : []), [decks])

  async function openTheme(g: RustiqueThemeGroup, jumpToCardId?: string) {
    setOpenThemes((s) => new Set(s).add(g.theme.id))
    let cards = themeCards.get(g.theme.id)
    if (!cards) {
      setLoadingTheme(g.theme.id)
      const res = await listRustiqueThemeCards(g.theme.id, 'toutes')
      setLoadingTheme(null)
      if (res.status !== 'ok') {
        setError(res.message ?? 'Impossible de charger le contenu.')
        return
      }
      cards = res.cards
      setThemeCards((m) => new Map(m).set(g.theme.id, cards!))
    }
    if (jumpToCardId) {
      const flat = flattenByDeck(g, cards)
      const index = flat.findIndex((c) => c.id === jumpToCardId)
      if (index >= 0) setFullscreen({ theme: g, index })
    }
  }

  function toggleTheme(g: RustiqueThemeGroup) {
    if (openThemes.has(g.theme.id)) {
      setOpenThemes((s) => {
        const n = new Set(s)
        n.delete(g.theme.id)
        return n
      })
      return
    }
    openTheme(g)
  }

  function toggleDeck(deckId: string) {
    setOpenDecks((s) => {
      const n = new Set(s)
      n.has(deckId) ? n.delete(deckId) : n.add(deckId)
      return n
    })
  }

  function openFullscreen(theme: RustiqueThemeGroup, cardId: string) {
    const cards = themeCards.get(theme.theme.id) ?? []
    const flat = flattenByDeck(theme, cards)
    const index = flat.findIndex((c) => c.id === cardId)
    if (index >= 0) setFullscreen({ theme, index })
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

  if (fullscreen) {
    const cards = flattenByDeck(fullscreen.theme, themeCards.get(fullscreen.theme.theme.id) ?? [])
    return (
      <FullscreenNotion
        theme={fullscreen.theme}
        cards={cards}
        index={fullscreen.index}
        dys={dys}
        onToggleDys={toggleDys}
        lues={lues}
        onToggleLue={toggleLue}
        onNavigate={(index) => setFullscreen({ theme: fullscreen.theme, index })}
        onExit={() => setFullscreen(null)}
      />
    )
  }

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs text-muted">
          Thème → paquet → notion : déplie pour voir comment tout se relie, clique une notion pour l'ouvrir en plein
          écran. Décoche librement en cas de mis-clic — ça ne touche à rien côté révision.
        </p>
        <DysToggle actif={dys} onToggle={toggleDys} />
      </div>
      {themeGroups.map((g) => (
        <ThemeNode
          key={g.theme.id}
          group={g}
          open={openThemes.has(g.theme.id)}
          loading={loadingTheme === g.theme.id}
          cards={themeCards.get(g.theme.id) ?? []}
          openDecks={openDecks}
          lues={lues}
          onToggle={() => toggleTheme(g)}
          onToggleDeck={toggleDeck}
          onOpenCard={(cardId) => openFullscreen(g, cardId)}
          onToggleLue={toggleLue}
        />
      ))}
    </div>
  )
}

/**
 * Bascule du mode dyslexie : police plus distinguée (Verdana/Tahoma),
 * interlignage et espacements augmentés, lignes plus courtes — recommandations
 * de la British Dyslexia Association. Local à l'appareil, comme la taille du
 * texte dans Réglages.
 */
function DysToggle({ actif, onToggle }: { actif: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
        actif ? 'bg-copper text-white' : 'bg-white/5 text-muted hover:text-ink'
      }`}
      title="Police, interlignage et espacements adaptés à la lecture pour dyslexie"
    >
      🔤 Dyslexie {actif ? '✓' : ''}
    </button>
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
  lues,
  onToggle,
  onToggleDeck,
  onOpenCard,
  onToggleLue,
}: {
  group: RustiqueThemeGroup
  open: boolean
  loading: boolean
  cards: RustiqueCard[]
  openDecks: Set<string>
  lues: Set<string>
  onToggle: () => void
  onToggleDeck: (deckId: string) => void
  onOpenCard: (cardId: string) => void
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
        <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: group.theme.color, boxShadow: `0 0 0 2px ${group.theme.color}33` }} />
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
                lues={lues}
                onToggle={() => onToggleDeck(deck.id)}
                onOpenCard={onOpenCard}
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
  lues,
  onToggle,
  onOpenCard,
  onToggleLue,
}: {
  deck: RustiqueDeck
  cards: RustiqueCard[]
  open: boolean
  lues: Set<string>
  onToggle: () => void
  onOpenCard: (cardId: string) => void
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
                <CardRow card={c} lue={lues.has(c.id)} onOpen={() => onOpenCard(c.id)} onToggleLue={() => onToggleLue(c.id)} />
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function CardRow({ card, lue, onOpen, onToggleLue }: { card: RustiqueCard; lue: boolean; onOpen: () => void; onToggleLue: () => void }) {
  // Lue sans jamais avoir été notée = jamais entrée dans le planning FSRS :
  // un point ambre pour le signaler, distinct du vert (déjà suivie).
  const jamaisNotee = lue && !card.review
  return (
    <div className="flex items-start gap-2 py-1">
      <button
        onClick={onToggleLue}
        title={lue ? 'Décocher (marquer comme non lue)' : 'Marquer comme lue'}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition ${
          lue ? 'border-sage bg-sage text-white' : 'border-line text-transparent hover:border-copper'
        }`}
      >
        ✓
      </button>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-1.5 text-left">
        <span className={`whitespace-pre-wrap text-xs ${lue ? 'text-muted line-through' : 'text-ink'}`}>{card.front}</span>
        {jamaisNotee ? (
          <span
            className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sand"
            title="Lue mais jamais notée — pas encore suivie par les révisions, à passer au Quiz"
          />
        ) : null}
      </button>
    </div>
  )
}

/**
 * La notion en plein écran : question, réponse repliée par défaut (rappel
 * actif), coche, et Précédent/Suivant pour enchaîner sur tout le thème sans
 * repasser par l'arbre — l'ancien mode de lecture continue d'Apprentissage,
 * conservé ici comme façon de naviguer DANS le plein écran plutôt que comme
 * écran séparé.
 */
function FullscreenNotion({
  theme,
  cards,
  index,
  dys,
  onToggleDys,
  lues,
  onToggleLue,
  onNavigate,
  onExit,
}: {
  theme: RustiqueThemeGroup
  cards: RustiqueCard[]
  index: number
  dys: boolean
  onToggleDys: () => void
  lues: Set<string>
  onToggleLue: (cardId: string) => void
  onNavigate: (index: number) => void
  onExit: () => void
}) {
  const [revele, setRevele] = useState(false)
  useEffect(() => setRevele(false), [index])

  const card = cards[index]
  if (!card) return null
  const mastered = card.review && card.review.state >= 2
  const lue = lues.has(card.id)
  const textStyle = dysTextStyle(dys)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: theme.theme.color }} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-ink">{theme.theme.title}</div>
            <div className="truncate text-[11px] text-muted">
              {card.deckTitle} · {index + 1}/{cards.length}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DysToggle actif={dys} onToggle={onToggleDys} />
          <button onClick={onExit} className="btn-ghost px-3 py-1.5 text-xs">
            ✕ Arbre
          </button>
        </div>
      </div>

      <div className="card space-y-3 p-4" style={dys ? { maxWidth: '38em' } : undefined}>
        <div className="flex items-start justify-between gap-2">
          <div className={`whitespace-pre-wrap font-semibold text-ink ${dys ? 'text-lg' : 'text-base'}`} style={textStyle}>
            {card.front}
          </div>
          {card.review ? (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${mastered ? 'bg-sage/20 text-sage' : 'bg-sand/30 text-sand'}`}>
              {mastered ? 'acquis' : 'en cours'}
            </span>
          ) : lue ? (
            <span className="shrink-0 rounded-full bg-clay/15 px-2 py-0.5 text-[10px] font-bold text-clay" title="Jamais notée : pas encore suivie par les révisions">
              jamais notée
            </span>
          ) : null}
        </div>
        {!card.review && lue ? (
          <p className="-mt-1.5 text-[11px] italic text-muted">
            Lue mais jamais notée au Quiz — elle ne reviendra pas toute seule tant qu'elle n'a pas été notée une fois.
          </p>
        ) : null}

        {!revele ? (
          <button onClick={() => setRevele(true)} className="btn-primary w-full py-2.5">
            Afficher la réponse
          </button>
        ) : (
          <>
            <div className={`whitespace-pre-wrap border-t border-line/60 pt-3 text-ink ${dys ? 'text-lg' : 'text-base'}`} style={textStyle}>
              {card.back}
            </div>
            <button
              onClick={() => onToggleLue(card.id)}
              className={`w-full rounded-xl2 py-2 text-sm font-semibold transition ${
                lue ? 'bg-sage/20 text-sage' : 'bg-white/5 text-muted hover:text-ink'
              }`}
            >
              {lue ? '✓ Marquée comme lue' : 'Marquer comme lue'}
            </button>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onNavigate(index - 1)}
          disabled={index === 0}
          className="btn-ghost flex-1 py-2.5 text-sm disabled:opacity-30"
        >
          ← Précédente
        </button>
        <button
          onClick={() => onNavigate(index + 1)}
          disabled={index >= cards.length - 1}
          className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-30"
        >
          Suivante →
        </button>
      </div>
    </div>
  )
}
