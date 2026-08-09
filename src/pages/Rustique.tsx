import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { SubTabs } from '../components/SubTabs'
import { RustiqueApprentissage } from '../components/RustiqueApprentissage'
import { RustiqueChat } from '../components/RustiqueChat'
import { RustiqueQuiz } from '../components/RustiqueQuiz'
import { fetchRustiqueOverview, type RustiqueOverview, type RustiqueOverviewResult } from '../lib/rustique'
import { fetchHubRecipes, type HubRecipesResult } from '../lib/brews'

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

// Rustique : deuxième cerveau — aperçu du Hub Prométhée (apiculture,
// distillation, BPREA, recettes) + un assistant qui pioche dans les deux bases.
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

function RustiqueApercu() {
  const [res, setRes] = useState<RustiqueOverviewResult | null>(null)
  const [recipes, setRecipes] = useState<HubRecipesResult | null>(null)

  useEffect(() => {
    fetchRustiqueOverview().then(setRes)
    fetchHubRecipes().then(setRecipes)
  }, [])

  if (!res) return <p className="text-center text-sm text-muted">Chargement du hub…</p>
  if (res.status === 'not_configured') return <HubNotConfigured />
  if (res.status === 'error')
    return (
      <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">
        Impossible de charger le hub.{res.message ? ` (${res.message})` : ''}
      </div>
    )

  const overview = res.overview as RustiqueOverview

  return (
    <div className="space-y-3">
      <ApicultureCard params={overview.params.apiculture} paused={Boolean(overview.params.pauses.pause_apiculture)} />
      <DistillationCard
        distillation={overview.params.distillation}
        ambulant={overview.params.ambulant}
        paused={Boolean(overview.params.pauses.pause_dist_fixe)}
        ambPaused={Boolean(overview.params.pauses.pause_ambulant)}
      />
      <BpreaCard bprea={overview.bprea} />
      <RecettesCard recipes={recipes} />
      {overview.updatedAt ? (
        <p className="text-center text-[11px] text-muted">Hub mis à jour le {new Date(overview.updatedAt).toLocaleString('fr-FR')}</p>
      ) : null}
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

function ApicultureCard({ params, paused }: { params: Record<string, unknown>; paused: boolean }) {
  return (
    <CardShell title="Apiculture" emoji="🐝" badge={paused ? 'En pause' : undefined}>
      <Stat label="Ruches (départ)" value={num(params.api_nb_ruches_depart)} />
      <Stat label="Croissance ruches/an" value={num(params.api_croissance_ruches_an)} />
      <Stat label="Rendement (kg/ruche)" value={num(params.api_rendement_kg_ruche)} />
      <Stat label="Prix du miel (€/kg)" value={num(params.api_prix_kg_miel)} />
    </CardShell>
  )
}

function DistillationCard({
  distillation,
  ambulant,
  paused,
  ambPaused,
}: {
  distillation: Record<string, unknown>
  ambulant: Record<string, unknown>
  paused: boolean
  ambPaused: boolean
}) {
  return (
    <CardShell title="Distillation & Ambulant" emoji="🥃" badge={paused ? 'Fixe en pause' : undefined}>
      <Stat label="Année de lancement (fixe)" value={num(distillation.dist_annee_lancement)} />
      <Stat label="Capacité (LAP)" value={num(distillation.dist_capacite_LAP)} />
      <Stat label="Ambulant" value={ambPaused ? 'En pause' : 'Actif'} />
      <Stat label="LAP façon/an (ambulant)" value={num(ambulant.amb_lap_an_facon)} />
    </CardShell>
  )
}

function BpreaCard({ bprea }: { bprea: RustiqueOverview['bprea'] }) {
  if (bprea.modulesDecks === 0 && bprea.biblioDecks === 0) {
    return (
      <CardShell title="BPREA / Étude" emoji="📚">
        <p className="text-xs text-muted">Rien à réviser pour l'instant.</p>
      </CardShell>
    )
  }
  return (
    <CardShell title="BPREA / Étude" emoji="📚">
      <Stat label="Modules BPREA" value={`${bprea.modulesDecks} decks · ${bprea.modulesCards} cartes`} />
      <Stat label="Bibliothèque" value={`${bprea.biblioDecks} decks · ${bprea.biblioCards} cartes`} />
      <Stat label="Cartes dues aujourd'hui" value={num(bprea.dueToday)} />
    </CardShell>
  )
}

function RecettesCard({ recipes }: { recipes: HubRecipesResult | null }) {
  if (!recipes || recipes.status !== 'ok') {
    return (
      <CardShell title="Recettes & Brassage" emoji="🍺">
        <p className="text-xs text-muted">Chargement…</p>
      </CardShell>
    )
  }
  const beer = recipes.recipes.filter((r) => r.type === 'beer').length
  const spirit = recipes.recipes.filter((r) => r.type !== 'beer').length
  return (
    <CardShell title="Recettes & Brassage" emoji="🍺">
      <Stat label="Bières" value={num(beer)} />
      <Stat label="Spiritueux & whiskies" value={num(spirit)} />
      <p className="mt-1 text-[11px] text-muted">Le détail est dans l'onglet 📖 Recettes du Brassage.</p>
    </CardShell>
  )
}
