import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Agenda } from './pages/Agenda'
import { Drive } from './pages/Drive'
import { Settings } from './pages/Settings'
import { Home } from './pages/Home'
import { Behourd } from './pages/Behourd'
import { Musculation } from './pages/Musculation'
import { Notes } from './pages/Notes'
import { Tasks } from './pages/Tasks'
import { Mails } from './pages/Mails'
import { Carnet } from './pages/Carnet'

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
        <Route path="/behourd" element={<Behourd />} />
        <Route path="/musculation" element={<Musculation />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/taches" element={<Tasks />} />
        <Route path="/mails" element={<Mails />} />
        <Route path="/carnet" element={<Carnet />} />
        <Route path="/drive" element={<Drive />} />
        <Route path="/reglages" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
