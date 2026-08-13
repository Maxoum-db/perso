import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { SubTabs } from '../components/SubTabs'
import { RustiqueApprentissage } from '../components/RustiqueApprentissage'
import { RustiqueChat } from '../components/RustiqueChat'
import { RustiqueQuiz } from '../components/RustiqueQuiz'
import { groupDecksByTheme, listRustiqueDecks, type RustiqueDecksResult } from '../lib/rustique'
import { QCM_KIND_LABELS } from '../lib/qcmBridge'
import { getQcmStats } from '../lib/qcmStats'

function num(v: unknown): string {
  if (typeof v === 'number') return v.toLocaleString('fr-FR')
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (v == null) return '—'
  return String(v)
}

function HubNotConfigured() {
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

// Rustique : deuxième cerveau — apprentissage (fiches, modules, BPREA) sur
// les données du Hub Prométhée + un assistant qui pioche dans les deux bases.
export function Rustique() {
  // Arrivée depuis la Notion du jour (accueil) avec `state: { openTheme,
  // openCard }` : capturé une fois au montage, pas à chaque changement de
  // route — sinon un aller-retour d'onglet rouvrirait l'article à chaque fois.
  const location = useLocation()
  const [navState] = useState(() => location.state as { openTheme?: string; openCard?: string } | null)
  const [tab, setTab] = useState<'apprentissage' | 'quiz' | 'apercu' | 'assistant'>('apprentissage')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">🧠 Rustique</h1>
        <p className="text-sm text-muted">Ce que raconte le Hub Prométhée, et un assistant pour croiser les deux.</p>
      </div>

      <SubTabs
        tabs={[
          { id: 'apprentissage', label: '🎓 Apprentissage' },
          { id: 'quiz', label: '📚 Quiz' },
          { id: 'apercu', label: '📊 Aperçu' },
          { id: 'assistant', label: '💬 Assistant' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === 'apprentissage' ? (
        <RustiqueApprentissage autoOpenThemeId={navState?.openTheme} autoOpenCardId={navState?.openCard} />
      ) : tab === 'quiz' ? (
        <RustiqueQuiz />
      ) : tab === 'apercu' ? (
        <RustiqueApercu />
      ) : (
        <RustiqueChat />
      )}
    </div>
  )
}

// Aperçu : dédié à l'avancement — thèmes FSRS à réviser (Quiz) + progression
// sur le QCM à choix multiple (Notion du jour de l'accueil). Deux systèmes
// distincts, donc deux sources : les decks du hub pour les thèmes, le
// localStorage local (qcmStats) pour le QCM — aucune des deux ne remplace l'autre.
function RustiqueApercu() {
  const [decksRes, setDecksRes] = useState<RustiqueDecksResult | null>(null)
  const [qcmStats] = useState(() => getQcmStats())

  useEffect(() => {
    listRustiqueDecks().then(setDecksRes)
  }, [])

  const themeGroups = useMemo(() => (decksRes?.status === 'ok' ? groupDecksByTheme(decksRes.decks) : []), [decksRes])
  const aReviser = useMemo(() => [...themeGroups].filter((g) => g.dueCount > 0).sort((a, b) => b.dueCount - a.dueCount), [themeGroups])
  const totalDue = themeGroups.reduce((s, g) => s + g.dueCount, 0)
  const totalCards = themeGroups.reduce((s, g) => s + g.cardCount, 0)
  const qcmPct = qcmStats.attempts > 0 ? Math.round((100 * qcmStats.correct) / qcmStats.attempts) : null

  return (
    <div className="space-y-3">
      {decksRes?.status === 'not_configured' ? <HubNotConfigured /> : null}
      {decksRes?.status === 'error' ? (
        <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">
          Impossible de charger le hub.{decksRes.message ? ` (${decksRes.message})` : ''}
        </div>
      ) : null}

      <CardShell title="Thèmes à réviser" emoji="🎯" badge={totalDue > 0 ? `${totalDue} due${totalDue > 1 ? 's' : ''}` : undefined}>
        {!decksRes ? (
          <p className="text-xs text-muted">Chargement…</p>
        ) : aReviser.length === 0 ? (
          <p className="text-xs text-muted">Rien à réviser pour l'instant. 🎉</p>
        ) : (
          <ul className="space-y-1.5">
            {aReviser.map((g) => (
              <li key={g.theme.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g.theme.color }} />
                <span className="min-w-0 flex-1 truncate text-ink">{g.theme.title}</span>
                <span className="shrink-0 font-semibold text-copper">{g.dueCount}</span>
              </li>
            ))}
          </ul>
        )}
        {totalCards > 0 ? (
          <p className="mt-1 border-t border-line/60 pt-2 text-[11px] text-muted">
            {totalCards} carte{totalCards > 1 ? 's' : ''} au total dans {themeGroups.length} thème{themeGroups.length > 1 ? 's' : ''}.
          </p>
        ) : null}
      </CardShell>

      <CardShell title="QCM — Notion du jour" emoji="🧠">
        <Stat label="Questions répondues" value={num(qcmStats.attempts)} />
        <Stat label="Bonnes réponses" value={num(qcmStats.correct)} />
        <Stat label="Taux de réussite" value={qcmPct == null ? '—' : `${qcmPct} %`} />
        {qcmStats.attempts === 0 ? (
          <p className="mt-1 text-[11px] text-muted">Réponds à la Notion du jour sur l'accueil pour démarrer le suivi.</p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line/60 pt-2 text-[11px]">
            {(Object.keys(QCM_KIND_LABELS) as (keyof typeof QCM_KIND_LABELS)[])
              .filter((k) => qcmStats.byKind[k].attempts > 0)
              .map((k) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="truncate text-muted">{QCM_KIND_LABELS[k]}</span>
                  <span className="shrink-0 font-semibold text-ink">
                    {qcmStats.byKind[k].correct}/{qcmStats.byKind[k].attempts}
                  </span>
                </div>
              ))}
          </div>
        )}
      </CardShell>
    </div>
  )
}

function CardShell({ title, emoji, badge, children }: { title: string; emoji: string; badge?: string; children: ReactNode }) {
  return (
    <div className="card space-y-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-ink">
          {emoji} {title}
        </h2>
        {badge ? <span className="chip bg-clay/15 text-clay">{badge}</span> : null}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  )
}

