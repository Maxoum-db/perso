import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import {
  storeGoogleToken,
  clearGoogleToken,
  hasFreshGoogleToken,
  refreshGoogleToken,
  saveGoogleRefreshToken,
} from './google'

// Scopes Google demandés :
//  - calendar       : lecture + écriture des agendas (l'écriture servira à la
//                     phase "optimisation" ; demandé maintenant pour éviter un
//                     second écran de consentement plus tard)
//  - drive.readonly : lecture des dossiers/fichiers (synthèses NotebookLM, Plaud)
//  - drive.file     : création/màj des fichiers créés par l'app (backup des notes)
//  - tasks          : Google Tasks (lecture + écriture)
//  - contacts.readonly : anniversaires & contacts
//  - gmail.readonly : repérer les mails importants
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ')

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Juste après le retour OAuth, la session contient provider_token (access)
    // et provider_refresh_token : on capte les deux. Le refresh_token est stocké
    // côté serveur pour régénérer l'access token ensuite (connexion permanente).
    const capture = (s: Session | null) => {
      storeGoogleToken(s?.provider_token)
      if (s?.user && s.provider_refresh_token) {
        saveGoogleRefreshToken(s.user.id, s.provider_refresh_token).catch(() => {})
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      capture(data.session)
      // Au rechargement, provider_token est absent : on régénère via le serveur.
      if (data.session?.user && !hasFreshGoogleToken()) refreshGoogleToken()
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') capture(s)
      if (event === 'SIGNED_OUT') clearGoogleToken()
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // Renouvellement proactif du jeton Google : périodique + au retour au premier plan.
  useEffect(() => {
    if (!session?.user) return
    const interval = setInterval(() => refreshGoogleToken(), 45 * 60 * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !hasFreshGoogleToken()) refreshGoogleToken()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [session?.user?.id])

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: GOOGLE_SCOPES,
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  async function signOut() {
    clearGoogleToken()
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, loading, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
