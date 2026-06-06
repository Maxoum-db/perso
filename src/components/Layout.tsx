import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const tabs = [
  { to: '/', label: 'Accueil', icon: IconHome },
  { to: '/agenda', label: 'Agenda', icon: IconCalendar },
  { to: '/behourd', label: 'Béhourd', icon: IconShield },
  { to: '/drive', label: 'Synthèses', icon: IconFolder },
  { to: '/reglages', label: 'Réglages', icon: IconGear },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-navy/95 px-4 py-3 text-white backdrop-blur">
        <span className="text-lg font-extrabold tracking-tight">
          Aide
        </span>
        <div className="ml-auto flex items-center gap-3">
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className="h-7 w-7 rounded-full border border-white/30"
            />
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

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {tabs.map((t) => (
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
        </div>
      </nav>
    </div>
  )
}

type IconProps = { active?: boolean }
const stroke = (active?: boolean) => (active ? '#b87333' : '#7a6e63')

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
function IconShield({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
    </svg>
  )
}
function IconFolder({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
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
