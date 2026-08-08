import { useEffect, useMemo, useState } from 'react'
import {
  listRustiqueCards,
  listRustiqueDecks,
  listRustiqueThemeCards,
  submitRustiqueReview,
  type RustiqueCard,
  type RustiqueDeck,
  type RustiqueTheme,
} from '../lib/rustique'

type Rating = 1 | 2 | 3 | 4

const RATING_BUTTONS: { rating: Rating; label: string; className: string }[] = [
  { rating: 1, label: 'À revoir', className: 'bg-clay text-white' },
  { rating: 2, label: 'Difficile', className: 'bg-sand text-ink' },
  { rating: 3, label: 'Correct', className: 'bg-sage text-white' },
  { rating: 4, label: 'Facile', className: 'bg-copper text-white' },
]

type ThemeGroup = { theme: RustiqueTheme; decks: RustiqueDeck[]; cardCount: number; dueCount: number }
type SessionSource = { label: string; deckId?: string; themeId?: string }

// Quiz Rustique : révise les vraies cartes du hub, regroupées par thème (les
// 8 phases du programme d'auto-formation) pour apprendre large sur un sujet
// plutôt que paquet par paquet. Une note ici avance le même planning FSRS
// que dans l'app Hub — pas de doublon, pas de données inventées.
export function RustiqueQuiz() {
  const [decks, setDecks] = useState<RustiqueDeck[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const [openTheme, setOpenTheme] = useState<string | null>(null)
  const [session, setSession] = useState<{ source: SessionSource; cards: RustiqueCard[] } | null>(null)

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

  const themeGroups = useMemo<ThemeGroup[]>(() => {
    if (!decks) return []
    const byId = new Map<string, ThemeGroup>()
    for (const d of decks) {
      const g = byId.get(d.theme.id) ?? { theme: d.theme, decks: [], cardCount: 0, dueCount: 0 }
      g.decks.push(d)
      g.cardCount += d.cardCount
      g.dueCount += d.dueCount
      byId.set(d.theme.id, g)
    }
    return [...byId.values()].sort((a, b) => a.theme.order - b.theme.order)
  }, [decks])

  async function openSession(source: SessionSource, dueOnly: boolean) {
    setError(null)
    const res = source.themeId
      ? await listRustiqueThemeCards(source.themeId, dueOnly)
      : await listRustiqueCards(source.deckId as string, dueOnly)
    if (res.status !== 'ok') {
      setError(res.message ?? 'Impossible de charger les cartes.')
      return
    }
    setSession({ source, cards: res.cards })
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
        label={session.source.label}
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

  return (
    <div className="space-y-2">
      {themeGroups.map((g) => (
        <ThemeCard
          key={g.theme.id}
          group={g}
          open={openTheme === g.theme.id}
          onToggle={() => setOpenTheme(openTheme === g.theme.id ? null : g.theme.id)}
          onReviewTheme={() => openSession({ label: g.theme.title, themeId: g.theme.id }, g.dueCount > 0)}
          onOpenDeck={(d) => openSession({ label: d.title, deckId: d.id }, d.dueCount > 0)}
        />
      ))}
    </div>
  )
}

function ThemeCard({
  group,
  open,
  onToggle,
  onReviewTheme,
  onOpenDeck,
}: {
  group: ThemeGroup
  open: boolean
  onToggle: () => void
  onReviewTheme: () => void
  onOpenDeck: (deck: RustiqueDeck) => void
}) {
  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: group.theme.color }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-ink">{group.theme.title}</div>
          <div className="text-xs text-muted">
            {group.decks.length} paquet{group.decks.length > 1 ? 's' : ''} · {group.cardCount} carte
            {group.cardCount > 1 ? 's' : ''}
            {group.dueCount > 0 ? ` · ${group.dueCount} à réviser` : ''}
          </div>
        </div>
        <span className="shrink-0 text-muted">{open ? '▾' : '▸'}</span>
      </button>

      <div className="flex gap-2 border-t border-line/60 bg-bg/40 p-3">
        <button
          onClick={onReviewTheme}
          disabled={group.cardCount === 0}
          className="btn-primary flex-1 py-2 text-xs disabled:opacity-40"
        >
          {group.dueCount > 0 ? `Réviser tout le thème (${group.dueCount})` : 'Consulter tout le thème'}
        </button>
      </div>

      {open ? (
        <ul className="space-y-1.5 border-t border-line/60 bg-bg/40 p-3">
          {group.decks.map((d) => (
            <li key={d.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-ink">{d.title}</div>
                <div className="text-[11px] text-muted">
                  {d.cardCount} carte{d.cardCount > 1 ? 's' : ''}
                  {d.dueCount > 0 ? ` · ${d.dueCount} due${d.dueCount > 1 ? 's' : ''}` : ''}
                </div>
              </div>
              <button onClick={() => onOpenDeck(d)} disabled={d.cardCount === 0} className="btn-ghost shrink-0 px-2.5 py-1 text-[11px] disabled:opacity-40">
                {d.dueCount > 0 ? 'Réviser' : 'Consulter'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function QuizSession({ label, cards, onExit }: { label: string; cards: RustiqueCard[]; onExit: () => void }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sending, setSending] = useState(false)

  if (cards.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-muted">Rien à réviser dans « {label} » aujourd'hui. 🎉</p>
        <button onClick={onExit} className="btn-ghost mx-auto block px-4 py-2 text-xs">
          Retour aux thèmes
        </button>
      </div>
    )
  }

  if (index >= cards.length) {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-muted">
          Terminé pour « {label} » — {cards.length} carte{cards.length > 1 ? 's' : ''} revue{cards.length > 1 ? 's' : ''}. ✅
        </p>
        <button onClick={onExit} className="btn-primary mx-auto block px-4 py-2 text-xs">
          Retour aux thèmes
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
        <span className="truncate">{label}</span>
        <span className="shrink-0">
          {index + 1} / {cards.length}
        </span>
        <button onClick={onExit} className="shrink-0 text-copper">
          Quitter
        </button>
      </div>

      <div className="card min-h-[160px] space-y-3 p-4">
        {card.deckTitle && card.deckTitle !== label ? (
          <div className="text-[11px] font-semibold uppercase text-muted">{card.deckTitle}</div>
        ) : null}
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
