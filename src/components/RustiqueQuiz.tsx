import { useEffect, useState } from 'react'
import {
  listRustiqueCards,
  listRustiqueDecks,
  submitRustiqueReview,
  type RustiqueCard,
  type RustiqueDeck,
} from '../lib/rustique'

type Rating = 1 | 2 | 3 | 4

const RATING_BUTTONS: { rating: Rating; label: string; className: string }[] = [
  { rating: 1, label: 'À revoir', className: 'bg-clay text-white' },
  { rating: 2, label: 'Difficile', className: 'bg-sand text-ink' },
  { rating: 3, label: 'Correct', className: 'bg-sage text-white' },
  { rating: 4, label: 'Facile', className: 'bg-copper text-white' },
]

// Quiz Rustique : révise les vraies cartes du hub (BPREA + bibliothèque). Une
// note ici avance le même planning FSRS que dans l'app Hub — pas de doublon,
// pas de données inventées : c'est la même carte, le même planning.
export function RustiqueQuiz() {
  const [decks, setDecks] = useState<RustiqueDeck[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const [session, setSession] = useState<{ deck: RustiqueDeck; cards: RustiqueCard[] } | null>(null)

  async function reloadDecks() {
    setError(null)
    const res = await listRustiqueDecks()
    if (res.status === 'not_configured') {
      setNotConfigured(true)
      return
    }
    if (res.status === 'error') {
      setError(res.message ?? 'Impossible de charger les paquets.')
      return
    }
    setDecks(res.decks)
  }

  useEffect(() => {
    reloadDecks()
  }, [])

  async function openDeck(deck: RustiqueDeck, dueOnly: boolean) {
    setError(null)
    const res = await listRustiqueCards(deck.id, dueOnly)
    if (res.status !== 'ok') {
      setError(res.message ?? 'Impossible de charger les cartes.')
      return
    }
    setSession({ deck, cards: res.cards })
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

  if (session) {
    return (
      <QuizSession
        deck={session.deck}
        cards={session.cards}
        onExit={() => {
          setSession(null)
          reloadDecks()
        }}
      />
    )
  }

  if (error) return <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div>
  if (!decks) return <p className="text-center text-sm text-muted">Chargement des paquets…</p>

  const modules = decks.filter((d) => d.scope === 'generale')
  const biblio = decks.filter((d) => d.scope !== 'generale')

  return (
    <div className="space-y-4">
      <DeckGroup title="📗 Modules BPREA" decks={modules} onOpen={openDeck} />
      <DeckGroup title="📚 Bibliothèque" decks={biblio} onOpen={openDeck} />
    </div>
  )
}

function DeckGroup({
  title,
  decks,
  onOpen,
}: {
  title: string
  decks: RustiqueDeck[]
  onOpen: (deck: RustiqueDeck, dueOnly: boolean) => void
}) {
  if (decks.length === 0) return null
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-extrabold text-ink">{title}</h2>
      <ul className="space-y-1.5">
        {decks.map((d) => (
          <li key={d.id} className="card flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">{d.title}</div>
              <div className="text-xs text-muted">
                {d.cardCount} carte{d.cardCount > 1 ? 's' : ''}
                {d.dueCount > 0 ? ` · ${d.dueCount} à réviser` : ''}
              </div>
            </div>
            {d.dueCount > 0 ? (
              <button onClick={() => onOpen(d, true)} className="btn-primary shrink-0 px-3 py-1.5 text-xs">
                Réviser
              </button>
            ) : (
              <button onClick={() => onOpen(d, false)} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
                Consulter
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function QuizSession({ deck, cards, onExit }: { deck: RustiqueDeck; cards: RustiqueCard[]; onExit: () => void }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sending, setSending] = useState(false)

  if (cards.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-muted">Rien à réviser dans « {deck.title} » aujourd'hui. 🎉</p>
        <button onClick={onExit} className="btn-ghost mx-auto block px-4 py-2 text-xs">
          Retour aux paquets
        </button>
      </div>
    )
  }

  if (index >= cards.length) {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-muted">Terminé pour « {deck.title} » — {cards.length} carte{cards.length > 1 ? 's' : ''} revue{cards.length > 1 ? 's' : ''}. ✅</p>
        <button onClick={onExit} className="btn-primary mx-auto block px-4 py-2 text-xs">
          Retour aux paquets
        </button>
      </div>
    )
  }

  const card = cards[index]

  async function rate(rating: Rating) {
    setSending(true)
    try {
      await submitRustiqueReview(card.id, rating)
      setFlipped(false)
      setIndex((i) => i + 1)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{deck.title}</span>
        <span>
          {index + 1} / {cards.length}
        </span>
        <button onClick={onExit} className="text-copper">
          Quitter
        </button>
      </div>

      <div className="card min-h-[160px] space-y-3 p-4">
        <div className="whitespace-pre-wrap text-sm text-ink">{card.front}</div>
        {flipped ? (
          <div className="whitespace-pre-wrap border-t border-line/60 pt-3 text-sm text-muted">{card.back}</div>
        ) : null}
      </div>

      {!flipped ? (
        <button onClick={() => setFlipped(true)} className="btn-primary w-full py-2.5">
          Afficher la réponse
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {RATING_BUTTONS.map((b) => (
            <button
              key={b.rating}
              onClick={() => rate(b.rating)}
              disabled={sending}
              className={`rounded-xl2 py-2.5 text-sm font-semibold ${b.className}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
