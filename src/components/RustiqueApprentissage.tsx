import { useEffect, useMemo, useState } from 'react'
import { dysTextStyle, readDyslexiaMode, writeDyslexiaMode } from '../lib/dyslexiaMode'
import {
  groupDecksByTheme,
  listRustiqueDecks,
  listRustiqueThemeCards,
  type RustiqueCard,
  type RustiqueDeck,
  type RustiqueThemeGroup,
} from '../lib/rustique'

// Apprentissage : lecture continue de tout un thème (tous ses paquets, toutes
// leurs cartes, question + réponse affichées ensemble) plutôt qu'une carte à
// la fois — pour étudier en profondeur un sujet avant de se tester au Quiz.
// Mêmes données que le Quiz (learn_decks/learn_cards du hub), présentation
// différente : un document à lire, pas une session de révision FSRS.
export function RustiqueApprentissage() {
  const [decks, setDecks] = useState<RustiqueDeck[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const [reading, setReading] = useState<{ theme: RustiqueThemeGroup; cards: RustiqueCard[] } | null>(null)
  const [loadingTheme, setLoadingTheme] = useState<string | null>(null)
  const [dys, setDys] = useState(false)

  useEffect(() => {
    setDys(readDyslexiaMode())
    listRustiqueDecks().then((res) => {
      if (res.status === 'not_configured') return setNotConfigured(true)
      if (res.status === 'error') return setError(res.message ?? 'Impossible de charger les modules.')
      setDecks(res.decks)
    })
  }, [])

  function toggleDys() {
    const next = !dys
    setDys(next)
    writeDyslexiaMode(next)
  }

  const themeGroups = useMemo(() => (decks ? groupDecksByTheme(decks) : []), [decks])

  async function openTheme(group: RustiqueThemeGroup) {
    setError(null)
    setLoadingTheme(group.theme.id)
    const res = await listRustiqueThemeCards(group.theme.id, false)
    setLoadingTheme(null)
    if (res.status !== 'ok') {
      setError(res.message ?? 'Impossible de charger le contenu.')
      return
    }
    setReading({ theme: group, cards: res.cards })
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

  if (reading) {
    return <ThemeReader theme={reading.theme} cards={reading.cards} dys={dys} onToggleDys={toggleDys} onExit={() => setReading(null)} />
  }

  if (error) return <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div>
  if (!decks) return <p className="text-center text-sm text-muted">Chargement des modules…</p>

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted">
          Un thème = tout ce que le Hub sait sur un sujet (modules BPREA + bibliothèque), à lire d'affilée avant de te
          tester au Quiz.
        </p>
        <DysToggle actif={dys} onToggle={toggleDys} />
      </div>
      {themeGroups.map((g) => (
        <button
          key={g.theme.id}
          onClick={() => openTheme(g)}
          disabled={g.cardCount === 0 || loadingTheme === g.theme.id}
          className="card flex w-full items-center gap-3 p-3 text-left disabled:opacity-50"
        >
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: g.theme.color }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink">{g.theme.title}</div>
            <div className="text-xs text-muted">
              {g.decks.length} paquet{g.decks.length > 1 ? 's' : ''} · {g.cardCount} notion
              {g.cardCount > 1 ? 's' : ''}
            </div>
          </div>
          <span className="shrink-0 text-xs font-semibold text-copper">
            {loadingTheme === g.theme.id ? '…' : 'Étudier →'}
          </span>
        </button>
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

function ThemeReader({
  theme,
  cards,
  dys,
  onToggleDys,
  onExit,
}: {
  theme: RustiqueThemeGroup
  cards: RustiqueCard[]
  dys: boolean
  onToggleDys: () => void
  onExit: () => void
}) {
  const byDeck = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, RustiqueCard[]>()
    for (const c of cards) {
      const key = c.deckTitle ?? '—'
      if (!map.has(key)) {
        map.set(key, [])
        order.push(key)
      }
      map.get(key)!.push(c)
    }
    return order.map((title) => ({ title, cards: map.get(title)! }))
  }, [cards])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: theme.theme.color }} />
            <h2 className="truncate text-base font-extrabold text-ink">{theme.theme.title}</h2>
          </div>
          <p className="text-xs text-muted">
            {byDeck.length} paquet{byDeck.length > 1 ? 's' : ''} · {cards.length} notion{cards.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DysToggle actif={dys} onToggle={onToggleDys} />
          <button onClick={onExit} className="btn-ghost px-3 py-1.5 text-xs">
            ← Thèmes
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="text-center text-sm text-muted">Rien à étudier dans ce thème pour l'instant.</p>
      ) : (
        // Mesure limitée en mode dyslexie : des lignes plus courtes évitent de
        // perdre le fil d'un retour à la ligne à l'autre, l'une des difficultés
        // de lecture les plus citées pour la dyslexie.
        <div className="space-y-4" style={dys ? { maxWidth: '38em' } : undefined}>
          {byDeck.map(({ title, cards: deckCards }) => (
            <div key={title} className="space-y-1.5">
              <h3
                className={`text-xs font-extrabold text-copper ${dys ? '' : 'uppercase tracking-wide'}`}
                style={dys ? { ...dysTextStyle(true), fontSize: '0.8rem' } : undefined}
              >
                {title}
              </h3>
              <div className="space-y-2">
                {deckCards.map((c) => (
                  <CardEntry key={c.id} card={c} dys={dys} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CardEntry({ card, dys }: { card: RustiqueCard; dys: boolean }) {
  const mastered = card.review && card.review.state >= 2
  const textStyle = dysTextStyle(dys)
  return (
    <div className={`card space-y-1.5 ${dys ? 'p-4' : 'p-3'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`whitespace-pre-wrap font-semibold text-ink ${dys ? 'text-base' : 'text-sm'}`} style={textStyle}>
          {card.front}
        </div>
        {card.review ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${mastered ? 'bg-sage/20 text-sage' : 'bg-sand/30 text-sand'}`}>
            {mastered ? 'acquis' : 'en cours'}
          </span>
        ) : null}
      </div>
      <div
        className={`whitespace-pre-wrap border-t border-line/60 pt-1.5 text-ink ${dys ? 'text-base' : 'text-sm'}`}
        style={textStyle}
      >
        {card.back}
      </div>
    </div>
  )
}
