import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

type Tab = { to: string; label: string; icon: (p: IconProps) => ReactNode }

// 4 destinations principales dans la barre + le reste dans le menu « Plus »
// (éviter une barre surchargée sur téléphone).
// La barre : 🏠 Accueil (dashboard) à gauche, puis le player et l'essentiel.
const primaryTabs: Tab[] = [
  { to: '/', label: 'Accueil', icon: IconHome },
  { to: '/agenda', label: 'Agenda', icon: IconCalendar },
  { to: '/notes', label: 'Notes', icon: IconNote },
  { to: '/listes', label: 'Listes', icon: IconList },
]
// Le menu « Plus » liste toutes les sections (lanceur complet).
const moreTabs: Tab[] = [
  { to: '/', label: 'Accueil', icon: IconHome },
  { to: '/agenda', label: 'Agenda', icon: IconCalendar },
  { to: '/notes', label: 'Notes', icon: IconNote },
  { to: '/listes', label: 'Listes', icon: IconList },
  { to: '/taches', label: 'Tâches', icon: IconCheck },
  { to: '/mails', label: 'Mails', icon: IconMail },
  { to: '/behourd', label: 'Béhourd', icon: IconShield },
  { to: '/brassage', label: 'Brassage', icon: IconBeer },
  { to: '/reglages', label: 'Réglages', icon: IconGear },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const primaryPaths = primaryTabs.map((t) => t.to)
  const moreActive = !primaryPaths.includes(location.pathname)

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-navy/95 px-4 py-3 text-white backdrop-blur">
        <img src="/icon-192.png" alt="Aide" className="h-9 w-9 rounded-lg object-cover" />
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
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

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
              {moreTabs.map((t) => (
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
function IconShield({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
    </svg>
  )
}
function IconGear({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
    </svg>
  )
}
function IconMail({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}
function IconCheck({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  )
}
function IconList({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
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
function IconMore({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}
