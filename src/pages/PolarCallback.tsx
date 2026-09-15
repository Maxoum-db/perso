import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { lierPolar } from '../lib/polarLien'

// Le retour de Polar après l'autorisation.
//
// Polar renvoie sur cette page avec un `code` d'usage unique, qu'on transmet au
// serveur pour l'échanger contre un jeton. Puis on repart vers les réglages,
// d'où on venait.

export function PolarCallback() {
  const navigate = useNavigate()
  const [erreur, setErreur] = useState<string | null>(null)
  // Le code ne s'échange qu'UNE fois : Polar le refuse au second essai. En
  // développement, React monte les effets deux fois, et sans ce garde-fou le
  // second échange échouerait et afficherait une erreur sur une connexion qui
  // vient pourtant de réussir.
  const consomme = useRef(false)

  useEffect(() => {
    if (consomme.current) return
    consomme.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const err = params.get('error')
    if (err) {
      setErreur('Autorisation refusée : ' + err)
      return
    }
    if (!code) {
      navigate('/reglages', { replace: true })
      return
    }
    lierPolar(code)
      .then(() => navigate('/reglages', { replace: true, state: { polar: 'lie' } }))
      .catch((e: Error) => setErreur(e.message))
  }, [navigate])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      {erreur ? (
        <>
          <p className="text-sm text-clay">{erreur}</p>
          <button onClick={() => navigate('/reglages', { replace: true })} className="btn-ghost text-xs">
            Retour aux réglages
          </button>
        </>
      ) : (
        <p className="animate-pulse text-sm text-muted">Connexion à Polar Flow…</p>
      )}
    </div>
  )
}
