import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Agenda } from './pages/Agenda'
import { Settings } from './pages/Settings'
import { Home } from './pages/Home'
import { Behourd } from './pages/Behourd'
import { Notes } from './pages/Notes'
import { Listes } from './pages/Listes'
import { Tasks } from './pages/Tasks'
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
        <Route path="/listes" element={<Listes />} />
        <Route path="/taches" element={<Tasks />} />
        <Route path="/mails" element={<Mails />} />
        <Route path="/behourd" element={<Behourd />} />
        <Route path="/reglages" element={<Settings />} />
        {/* Anciennes routes désormais regroupées dans des hubs */}
        <Route path="/journee" element={<Navigate to="/agenda" replace />} />
        <Route path="/humeur" element={<Navigate to="/notes" replace />} />
        <Route path="/drive" element={<Navigate to="/notes" replace />} />
        <Route path="/musculation" element={<Navigate to="/behourd" replace />} />
        <Route path="/carnet" element={<Navigate to="/behourd" replace />} />
        <Route path="/habitudes" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
