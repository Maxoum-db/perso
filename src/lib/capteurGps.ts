import { useCallback, useEffect, useRef, useState } from 'react'
import { accumulateurVide, accumuler, bilan, type AccumulateurGps, type BilanTrajet, type ModeTrajet, type PointGps } from './gps'
import { prendreVerrou, rendreVerrou, type Verrou } from './verrouEcran'

// Le GPS du téléphone, branché directement au navigateur.
//
// ── Ce que ça remplace, et ce que ça ne demande pas ─────────────────────────
//
// Aucune application tierce, aucun compte, aucun cloud. L'API de géolocalisation
// est dans tous les navigateurs depuis quinze ans ; ce qui change, c'est qu'on
// lui demande un SUIVI (`watchPosition`) et non une position ponctuelle.
//
// ── Ce qui ne marchera pas, et il faut le dire ──────────────────────────────
//
//   · hors HTTPS, l'API est refusée. Vercel sert en HTTPS, donc c'est bon ;
//   · la permission se donne UNE FOIS par site, et le navigateur la retient —
//     contrairement au Bluetooth, qui redemande un geste à chaque appairage.
//     C'est la bonne nouvelle de ce fichier ;
//   · en revanche, comme le Bluetooth, TOUT S'ARRÊTE quand la page passe en
//     arrière-plan ou que l'écran se verrouille. D'où le verrou d'écran, pris
//     pendant l'enregistrement et rendu à l'arrêt ;
//   · la première position met dix à trente secondes à arriver, le temps que
//     le récepteur accroche les satellites. C'est normal, et l'écran le dit
//     plutôt que d'afficher « 0 m » comme si rien ne se passait.
//
// ── Haute précision, et ce que ça coûte ─────────────────────────────────────
//
// `enableHighAccuracy` allume le vrai récepteur GNSS au lieu de se contenter
// des antennes-relais et du Wi-Fi. Sans lui, la précision annoncée tourne
// autour de la centaine de mètres — au-dessus du plafond qu'on s'est fixé, donc
// pas un seul point ne serait retenu. Ça consomme, et c'est le prix : une
// mesure fausse ne coûterait pas moins cher, elle serait juste inutile.

export type EtatGps = 'absent' | 'prêt' | 'accroche' | 'mesure' | 'refusé' | 'perdu'

export interface CapteurGps {
  etat: EtatGps
  /** Précision annoncée du dernier point reçu, en mètres. */
  precision: number | null
  bilan: BilanTrajet | null
  /** Vitesse du dernier segment retenu, en km/h. */
  vitesseKmh: number | null
  /** Durée totale de l'enregistrement, arrêts compris, en secondes. */
  dureeS: number
  erreur: string | null
  demarrer: () => void
  arreter: () => void
}

export function gpsDisponible(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

/** Un point trop vieux ne dit plus où l'on est. */
const AGE_MAX_MS = 10_000

export function useCapteurGps(mode: ModeTrajet): CapteurGps {
  const [etat, setEtat] = useState<EtatGps>(() => (gpsDisponible() ? 'prêt' : 'absent'))
  const [precision, setPrecision] = useState<number | null>(null)
  const [acc, setAcc] = useState<AccumulateurGps>(accumulateurVide)
  const [erreur, setErreur] = useState<string | null>(null)
  const [dureeS, setDureeS] = useState(0)

  const montre = useRef<number | null>(null)
  const verrou = useRef<Verrou | null>(null)
  const depart = useRef<number | null>(null)
  // Le mode change les plafonds de vitesse ; la sonde, elle, est posée une
  // fois. Sans cette référence, elle garderait le mode du jour du démarrage.
  const modeRef = useRef(mode)
  modeRef.current = mode

  const arreter = useCallback(() => {
    if (montre.current !== null) {
      navigator.geolocation.clearWatch(montre.current)
      montre.current = null
    }
    rendreVerrou(verrou)
    setEtat(gpsDisponible() ? 'prêt' : 'absent')
  }, [])

  const demarrer = useCallback(() => {
    if (!gpsDisponible()) {
      setEtat('absent')
      return
    }
    if (montre.current !== null) return
    setErreur(null)
    setAcc(accumulateurVide())
    setDureeS(0)
    depart.current = Date.now()
    setEtat('accroche')
    montre.current = navigator.geolocation.watchPosition(
      (pos) => {
        // Un point que le navigateur garde en cache peut arriver daté d'il y a
        // plusieurs minutes. Le compter reviendrait à mesurer un déplacement
        // qui a déjà été mesuré, ou pire, à relier deux positions éloignées
        // dans le temps comme si elles se suivaient.
        if (Date.now() - pos.timestamp > AGE_MAX_MS) return
        const p: PointGps = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          precision: pos.coords.accuracy,
          instant: pos.timestamp,
        }
        setPrecision(pos.coords.accuracy)
        setEtat('mesure')
        setAcc((prev) => accumuler(prev, p, modeRef.current))
      },
      (e) => {
        // Permission refusée : ce n'est pas une panne à réessayer, c'est une
        // décision. On arrête la montre plutôt que de laisser le navigateur
        // rejouer l'erreur en boucle.
        if (e.code === 1) {
          setEtat('refusé')
          setErreur('Autorisation de localisation refusée. Elle se redonne dans les réglages du site, dans le navigateur.')
          arreter()
          return
        }
        // Position indisponible ou délai dépassé : le récepteur cherche encore,
        // ou on est sous un toit. La montre continue — c'est justement ce
        // qu'elle sait faire.
        setEtat('perdu')
        setErreur(e.code === 3 ? 'Le récepteur met du temps à accrocher — dehors, ça vient en général en trente secondes.' : 'Position indisponible pour l’instant.')
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    )
    void prendreVerrou(verrou)
  }, [arreter])

  // La durée TOTALE, arrêts compris — celle qu'on a passée dehors. Elle avance
  // même quand plus aucun point n'arrive, et c'est voulu : sans elle, un tunnel
  // de dix minutes ne se verrait nulle part.
  useEffect(() => {
    if (etat !== 'mesure' && etat !== 'accroche' && etat !== 'perdu') return
    const t = setInterval(() => {
      if (depart.current !== null) setDureeS(Math.round((Date.now() - depart.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [etat])

  // Le verrou est rendu par le navigateur dès que la page passe en
  // arrière-plan, et il n'est PAS repris tout seul au retour. Sans ce
  // réarmement, il suffirait de basculer une fois sur une autre application
  // pour que l'écran recommence à s'éteindre — et le trajet à se perdre.
  useEffect(() => {
    if (etat !== 'mesure' && etat !== 'accroche') return
    const reprendre = () => {
      if (document.visibilityState === 'visible') void prendreVerrou(verrou)
    }
    document.addEventListener('visibilitychange', reprendre)
    return () => document.removeEventListener('visibilitychange', reprendre)
  }, [etat])

  // Couper en quittant l'écran : une montre qui tourne sur une page fermée
  // interroge le GNSS pour personne, et l'écran n'a plus à rester allumé.
  useEffect(() => {
    return () => {
      if (montre.current !== null) {
        navigator.geolocation.clearWatch(montre.current)
        montre.current = null
      }
      rendreVerrou(verrou)
    }
  }, [])

  return {
    etat,
    precision,
    bilan: bilan(acc),
    vitesseKmh: acc.vitesseKmh,
    dureeS,
    erreur,
    demarrer,
    arreter,
  }
}
