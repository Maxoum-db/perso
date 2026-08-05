import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { fetchSettings, readCachedSettings, type Discipline } from '../lib/settings'
import { QuickCapture } from './QuickCapture'

type Tab = { to: string; label: string; icon: (p: IconProps) => ReactNode }

// 4 destinations principales dans la barre + le reste dans le menu « Plus »
// (éviter une barre surchargée sur téléphone).
// La barre : 🏠 Accueil (dashboard) à gauche, puis le player et l'essentiel.
const primaryTabs: Tab[] = [
  { to: '/', label: 'Accueil', icon: IconHome },
  { to: '/agenda', label: 'Agenda', icon: IconCalendar },
  { to: '/notes', label: 'Notes', icon: IconNote },
  { to: '/musculation', label: 'Muscu', icon: IconDumbbell },
]
// Le menu « Plus » liste toutes les sections (lanceur complet). Réglages n'y est
// plus : l'écrou de l'en-tête est visible depuis n'importe quel écran, alors que
// le menu demande deux touchers. Une seule porte, toujours au même endroit.
// L'onglet de discipline dépend du réglage : béhourd ou course à pied. Deux
// personnes utilisent l'application et ne font pas le même sport.
const DISCIPLINES: Record<Discipline, Tab> = {
  behourd: { to: '/behourd', label: 'Béhourd', icon: IconShield },
  course: { to: '/course', label: 'Course', icon: IconRun },
}

const moreTabs = (discipline: Discipline): Tab[] => [
  { to: '/', label: 'Accueil', icon: IconHome },
  { to: '/agenda', label: 'Agenda', icon: IconCalendar },
  { to: '/notes', label: 'Notes', icon: IconNote },
  { to: '/partage', label: 'À deux', icon: IconHeart },
  DISCIPLINES[discipline],
  { to: '/musculation', label: 'Muscu', icon: IconDumbbell },
  { to: '/brassage', label: 'Brassage', icon: IconBeer },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  // Le cache local d'abord : la barre de navigation doit être juste dès la
  // première image, pas après un aller-retour réseau. Le serveur corrige
  // ensuite si le réglage a changé sur l'autre appareil.
  const [discipline, setDiscipline] = useState<Discipline>(() => readCachedSettings().discipline)
  useEffect(() => {
    if (user) fetchSettings(user.id).then((s) => setDiscipline(s.discipline))
  }, [user])
  const sections = moreTabs(discipline)
  const primaryPaths = primaryTabs.map((t) => t.to)
  const moreActive = !primaryPaths.includes(location.pathname)

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      {/* La bande de l'encoche, peinte à part.
          `body` porte un padding haut pour l'encoche, donc l'en-tête collant
          commence SOUS elle et la page défilait dans la bande heure/batterie.
          Une marge négative sur l'en-tête ne règle rien : son parent est un
          conteneur flex, qui place son premier enfant au bord de sa boîte de
          contenu sans tenir compte d'une marge négative. Un élément `fixed`, en
          revanche, se positionne par rapport à l'écran et ignore le padding du
          body — c'est le seul moyen simple d'atteindre ces pixels-là. */}
      <div className="fixed inset-x-0 top-0 z-20 h-[env(safe-area-inset-top)] bg-navy" />

      {/* `bg-navy` plein et non /95 : à 95 % on devinait la page derrière. */}
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-navy px-4 py-3 text-white">
        {/* Le logo ramène à l'accueil. C'est le geste attendu de toute application
            — on touche le titre pour revenir au début —, et il ne coûtait rien
            puisque l'en-tête est visible partout. */}
        <NavLink to="/" end aria-label="Retour à l'accueil" title="Accueil" className="shrink-0 rounded-lg transition hover:opacity-80">
          <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-lg object-cover" />
        </NavLink>
        <div className="ml-auto flex items-center gap-3">
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="" className="h-7 w-7 rounded-full border border-white/30" />
          ) : null}
          <button
            onClick={signOut}
            className="text-xs text-white/70 underline-offset-2 hover:text-white hover:underline"
          >
            Déconnexion
          </button>
          {/* Juste l'écrou : les réglages se cherchent à l'icône, pas au mot. */}
          <NavLink
            to="/reglages"
            aria-label="Réglages"
            title="Réglages"
            className={({ isActive }) =>
              `flex h-8 w-8 items-center justify-center rounded-full transition ${
                isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <IconGearHeader />
          </NavLink>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      {!moreOpen ? <QuickCapture /> : null}

      {/* Voile pour fermer le menu Plus en touchant ailleurs */}
      {moreOpen ? <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} /> : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur">
        {moreOpen ? (
          /* Menu déployé : on n'affiche QUE le menu complet */
          <div className="mx-auto max-w-3xl px-2 py-2 pb-[env(safe-area-inset-bottom)]">
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="text-xs font-bold text-muted">Toutes les sections</span>
              <button onClick={() => setMoreOpen(false)} className="text-xs font-semibold text-copper">
                Fermer ▾
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {sections.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.to === '/'}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 rounded-xl2 px-1 py-2 text-center text-[10px] font-semibold leading-tight transition ${
                      isActive ? 'bg-copper/15 text-copper' : 'text-muted hover:text-ink'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <t.icon active={isActive} />
                      {t.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ) : (
          /* Barre repliée : 4 onglets principaux + Plus */
          <div className="mx-auto flex max-w-3xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
            {primaryTabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                    isActive ? 'text-copper' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <t.icon active={isActive} />
                    {t.label}
                  </>
                )}
              </NavLink>
            ))}
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                moreActive ? 'text-copper' : 'text-muted hover:text-ink'
              }`}
            >
              <IconMore active={moreActive} />
              Plus
            </button>
          </div>
        )}
      </nav>
    </div>
  )
}

type IconProps = { active?: boolean }
const stroke = (active?: boolean) => (active ? '#c87c3a' : '#a89a8d')

function IconHome({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}
function IconCalendar({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  )
}
function IconNote({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h10l4 4v14H5z" />
      <path d="M14 3v5h5M8 13h8M8 17h6" />
    </svg>
  )
}
function IconRun({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="15.5" cy="4.5" r="1.6" />
      <path d="M12.5 21l1.8-5.2-3.1-2.6-1 4.4" />
      <path d="M6.5 12.2l2.6-3.9 3.6-1.2 2.8 2.4 3 1" />
      <path d="M14.3 15.8l3.2 2.1 1.2 3.1" />
      <path d="M4 9.5h3.2" />
    </svg>
  )
}

function IconShield({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
    </svg>
  )
}
/**
 * Corps de l'écrou.
 *
 * L'anneau intermédiaire n'est pas décoratif : sans lui, les huit dents partent
 * du vide autour d'un petit cercle et l'icône se lit comme un soleil — flagrant
 * à 19 px dans l'en-tête, où aucun libellé ne vient corriger l'impression.
 */
function GearShape() {
  return (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <circle cx="12" cy="12" r="6.6" />
      <path d="M12 2.9v2.5M12 18.6v2.5M5.1 5.1l1.8 1.8M17.1 17.1l1.8 1.8M2.9 12h2.5M18.6 12h2.5M5.1 18.9l1.8-1.8M17.1 6.9l1.8-1.8" />
    </>
  )
}

/**
 * Écrou de l'en-tête, désormais la seule porte vers les réglages : ils ont quitté
 * le menu « Plus » (deux touchers) alors que l'en-tête est visible partout. Sur
 * fond marine, il hérite de la couleur du texte au lieu de la palette
 * cuivre/muted de la barre du bas.
 */
function IconGearHeader() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <GearShape />
    </svg>
  )
}

function IconDumbbell({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 12h7" />
      <rect x="4.5" y="8" width="3" height="8" rx="1" />
      <rect x="16.5" y="8" width="3" height="8" rx="1" />
      <path d="M2 10.5v3M22 10.5v3" />
    </svg>
  )
}
function IconBeer({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h9v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8Z" />
      <path d="M15 10h2.5a2.5 2.5 0 0 1 0 5H15" />
      <path d="M8 8c0-1.5-1-2-1-3.2C7 3.4 8 3 9 3M11.5 8c0-1.5-1-2-1-3.2 0-1.4 1-1.8 2-1.8" />
    </svg>
  )
}
function IconHeart({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20Z" />
    </svg>
  )
}
function IconMore({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}
