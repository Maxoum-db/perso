import { useEffect, useState, type ReactElement } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { accesEnCache, chargerAcces, routeAutorisee, type Section } from './lib/acces'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Agenda } from './pages/Agenda'
import { Settings } from './pages/Settings'
import { Home } from './pages/Home'
import { Behourd } from './pages/Behourd'
import { Course } from './pages/Course'
import { Musculation } from './pages/Musculation'
import { Brassage } from './pages/Brassage'
import { Rustique } from './pages/Rustique'
import { Notes } from './pages/Notes'
import { Partage } from './pages/Partage'
import { Mails } from './pages/Mails'

/**
 * Écran d'une section non accordée.
 *
 * On le montre plutôt que de rediriger : une redirection silencieuse laisse
 * croire à un lien cassé, alors que la raison est simple et se dit en une
 * phrase. Et le message ne nomme pas la section demandée — inutile d'apprendre
 * à qui n'y a pas droit ce qui existe derrière.
 */
function SansAcces() {
  return (
    <div className="card p-6 text-center">
      <div className="text-3xl">🔒</div>
      <h1 className="mt-2 text-lg font-extrabold text-ink">Section non accessible</h1>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        Ce compte n'a pas accès à cette partie de l'application. Si c'est une erreur, demande à Maximilien de
        l'ouvrir depuis ses réglages.
      </p>
      <Link to="/" className="btn-ghost mt-4 inline-flex text-xs">
        Retour à l'accueil
      </Link>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  // Le cache d'abord pour éviter que la navigation clignote au démarrage ; la
  // base ensuite, qui seule fait autorité.
  const [sections, setSections] = useState<Section[]>(() => accesEnCache() ?? [])
  useEffect(() => {
    if (user) chargerAcces(user.id, user.email).then(setSections)
  }, [user])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        <div className="animate-pulse text-sm">Chargement…</div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  // Cacher une entrée du menu ne protège rien : une adresse tapée à la main, un
  // signet ou un lien reçu contournent la navigation sans effort. Chaque route
  // est donc gardée pour elle-même. (La base garde les DONNÉES, de son côté :
  // c'est la seule barrière qu'on ne peut pas contourner depuis le navigateur.)
  const garde = (route: string, ecran: ReactElement) =>
    routeAutorisee(route, sections) ? ecran : <SansAcces />

  return (
    <Layout sections={sections}>
      <Routes>
        <Route path="/" element={<Home sections={sections} />} />
        <Route path="/agenda" element={garde('/agenda', <Agenda />)} />
        <Route path="/notes" element={garde('/notes', <Notes />)} />
        <Route path="/listes" element={garde('/notes', <Notes initial="listes" />)} />
        <Route path="/partage" element={garde('/partage', <Partage />)} />
        <Route path="/taches" element={garde('/notes', <Notes initial="taches" />)} />
        <Route path="/mails" element={garde('/mails', <Mails />)} />
        <Route path="/behourd" element={garde('/behourd', <Behourd />)} />
        <Route path="/course" element={garde('/course', <Course />)} />
        <Route path="/musculation" element={garde('/musculation', <Musculation sections={sections} />)} />
        <Route path="/brassage" element={garde('/brassage', <Brassage />)} />
        <Route path="/rustique" element={garde('/rustique', <Rustique />)} />
        <Route path="/reglages" element={<Settings />} />
        {/* Mails en veille : la route reste accessible en direct, mais la
            section a quitté la navigation. */}
        {/* Anciennes routes désormais regroupées dans des hubs */}
        <Route path="/journee" element={<Navigate to="/agenda" replace />} />
        <Route path="/humeur" element={<Navigate to="/notes" replace />} />
        <Route path="/drive" element={<Navigate to="/notes" replace />} />
        <Route path="/carnet" element={<Navigate to="/musculation" replace />} />
        <Route path="/habitudes" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
