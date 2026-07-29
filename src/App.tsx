import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Agenda } from './pages/Agenda'
import { Settings } from './pages/Settings'
import { Home } from './pages/Home'
import { Behourd } from './pages/Behourd'
import { Musculation } from './pages/Musculation'
import { Brassage } from './pages/Brassage'
import { Notes } from './pages/Notes'
import { Partage } from './pages/Partage'
import { Mails } from './pages/Mails'

export default function App() {
  const { user, loading } = useAuth()

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

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/listes" element={<Notes initial="listes" />} />
        <Route path="/partage" element={<Partage />} />
        <Route path="/taches" element={<Notes initial="taches" />} />
        <Route path="/mails" element={<Mails />} />
        <Route path="/behourd" element={<Behourd />} />
        <Route path="/musculation" element={<Musculation />} />
        <Route path="/brassage" element={<Brassage />} />
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
