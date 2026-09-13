import { useCallback, useEffect, useRef, useState } from 'react'
import { accumulateurVide, accumuler, bilan, parseMesureFC, type AccumulateurCardio, type BilanCardio } from './cardio'

// Le capteur, branché directement au navigateur.
//
// Web Bluetooth : le téléphone parle au brassard sans passer par Polar Flow, ni
// par Health Connect, ni par aucun cloud. Rien à inscrire nulle part, aucune
// clé, aucun compte — et la mesure reste sur l'appareil.
//
// ── Pourquoi le service STANDARD et pas le SDK Polar ────────────────────────
//
// Le Polar Verity Sense expose le service Bluetooth « Heart Rate » (0x180D),
// qui est une norme : le même code lira un H10, une ceinture Garmin ou
// n'importe quel cardiofréquencemètre. Passer par le SDK propriétaire de Polar
// donnerait accès à plus de choses (ECG brut, accéléromètre) au prix d'une
// dépendance à une marque — et d'un SDK Android, donc inutilisable ici.
//
// ── Ce qui ne marchera pas, et il faut le dire ──────────────────────────────
//
//   · iOS : Safari n'implémente pas Web Bluetooth, et aucun navigateur iOS ne
//     le peut (ils sont tous Safari dessous). Sur iPhone, ce bouton ne peut pas
//     exister — l'écran le dit plutôt que de proposer un bouton qui échoue ;
//   · Firefox : même chose ;
//   · hors HTTPS : l'API est refusée. Vercel sert en HTTPS, donc c'est bon ;
//   · l'appairage demande un GESTE : impossible de se reconnecter tout seul au
//     chargement de la page. C'est une protection du navigateur, pas un défaut
//     à contourner.
//
// ── L'écran qui s'éteint ────────────────────────────────────────────────────
//
// Un téléphone verrouille son écran au bout d'une minute, met la page en
// arrière-plan, et les notifications Bluetooth s'arrêtent. Sur une séance
// d'une heure, la liaison serait donc perdue en permanence — la fonction ne
// servirait à rien. On demande donc un verrou d'écran TANT QUE le capteur est
// branché, et on le rend en le débranchant : garder l'écran allumé coûte de la
// batterie, ça ne se fait pas « au cas où ».

/** Service et caractéristique normalisés. Les deux seuls identifiants du fichier. */
const SERVICE_FC = 0x180d
const CARACT_MESURE = 0x2a37

/**
 * Combien d'intervalles RR on garde en mémoire.
 *
 * Six cents, soit une dizaine de minutes : bien plus que la fenêtre de deux
 * minutes d'une mesure au repos, la seule qui les lise. Sans plafond, la liste
 * grandit d'un élément par battement pendant toute la séance et se recopie
 * entièrement à chacun — quelques milliers d'éléments recopiés trois mille
 * fois, pour une donnée que personne ne regarde en séance.
 */
const RR_GARDES = 600

export type EtatCapteur = 'absent' | 'prêt' | 'recherche' | 'connexion' | 'connecté' | 'perdu'

export interface Capteur {
  etat: EtatCapteur
  /** Nom du brassard tel qu'il s'annonce (« Polar Sense C1A2B3 »). */
  nom: string | null
  /** Dernier battement reçu. `null` tant que rien n'est arrivé. */
  bpm: number | null
  /** `false` = brassard décroché ; `null` = le capteur ne sait pas le dire. */
  contact: boolean | null
  /** Intervalles RR reçus depuis le début, pour la variabilité. */
  rr: number[]
  erreur: string | null
  acc: AccumulateurCardio
  bilan: BilanCardio | null
  connecter: () => Promise<void>
  deconnecter: () => void
  /** Repart de zéro sans couper la liaison — au début d'une séance, d'une mesure. */
  remettreAZero: () => void
}

/** Web Bluetooth est-il seulement là ? Testé sans rien demander à l'utilisateur. */
export function bluetoothDisponible(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

type BluetoothAvecScan = Navigator & {
  bluetooth: {
    requestDevice(o: unknown): Promise<BluetoothDeviceMin>
  }
}

interface BluetoothDeviceMin {
  name?: string | null
  gatt?: {
    connected: boolean
    connect(): Promise<{ getPrimaryService(u: number): Promise<GattServiceMin> }>
    disconnect(): void
  }
  addEventListener(t: string, f: () => void): void
  removeEventListener(t: string, f: () => void): void
}

interface GattServiceMin {
  getCharacteristic(u: number): Promise<{
    startNotifications(): Promise<unknown>
    stopNotifications(): Promise<unknown>
    addEventListener(t: string, f: (e: Event) => void): void
    removeEventListener(t: string, f: (e: Event) => void): void
  }>
}

/**
 * Branche le capteur et tient l'état de la mesure.
 *
 * @param fcMax  la fréquence maximale servant aux zones. Peut être `null` : on
 *               enregistre alors les battements sans les ranger, plutôt que de
 *               les ranger n'importe où.
 */
export function useCapteurCardio(fcMax: number | null): Capteur {
  const [etat, setEtat] = useState<EtatCapteur>(() => (bluetoothDisponible() ? 'prêt' : 'absent'))
  const [nom, setNom] = useState<string | null>(null)
  const [bpm, setBpm] = useState<number | null>(null)
  const [contact, setContact] = useState<boolean | null>(null)
  const [rr, setRr] = useState<number[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [acc, setAcc] = useState<AccumulateurCardio>(accumulateurVide)

  const appareil = useRef<BluetoothDeviceMin | null>(null)
  const verrou = useRef<{ release: () => Promise<void> } | null>(null)
  // La FC max change quand le profil change ; la sonde de notification, elle,
  // est posée une fois. Sans cette référence elle garderait la valeur du jour
  // de l'appairage — les zones resteraient calculées sur l'ancienne.
  const fcMaxRef = useRef(fcMax)
  fcMaxRef.current = fcMax

  const surMesure = useCallback((e: Event) => {
    const vue = (e.target as unknown as { value: DataView }).value
    let m
    try {
      m = parseMesureFC(vue)
    } catch {
      // Une trame illisible n'interrompt pas la séance : on saute celle-là.
      return
    }
    setBpm(m.bpm)
    setContact(m.contact)
    if (m.rr.length) setRr((prev) => [...prev, ...m.rr].slice(-RR_GARDES))
    setAcc((prev) => accumuler(prev, m.bpm, fcMaxRef.current, Date.now()))
  }, [])

  const connecter = useCallback(async () => {
    if (!bluetoothDisponible()) {
      setEtat('absent')
      return
    }
    setErreur(null)
    setEtat('recherche')
    try {
      // On filtre sur le SERVICE et non sur le nom : « Polar Sense », « Polar
      // H10 », « TICKR »… le navigateur montre alors tout ce qui sait envoyer
      // une fréquence cardiaque, et rien d'autre.
      const dev = await (navigator as unknown as BluetoothAvecScan).bluetooth.requestDevice({
        filters: [{ services: [SERVICE_FC] }],
      })
      setEtat('connexion')
      appareil.current = dev
      setNom(dev.name ?? 'Capteur')
      dev.addEventListener('gattserverdisconnected', () => setEtat('perdu'))
      const serveur = await dev.gatt!.connect()
      const service = await serveur.getPrimaryService(SERVICE_FC)
      const caract = await service.getCharacteristic(CARACT_MESURE)
      caract.addEventListener('characteristicvaluechanged', surMesure)
      await caract.startNotifications()
      setEtat('connecté')
      void prendreVerrou(verrou)
    } catch (e) {
      const msg = (e as Error).message ?? ''
      // Fermer le sélecteur du navigateur n'est pas une panne : on retourne à
      // l'état d'avant, sans message rouge.
      if (/User cancelled|cancell?ed/i.test(msg)) setEtat('prêt')
      else {
        setErreur(msg || 'Connexion au capteur impossible.')
        setEtat('prêt')
      }
    }
  }, [surMesure])

  const deconnecter = useCallback(() => {
    try {
      appareil.current?.gatt?.disconnect()
    } catch {
      /* déjà parti */
    }
    appareil.current = null
    verrou.current?.release().catch(() => {})
    verrou.current = null
    setEtat(bluetoothDisponible() ? 'prêt' : 'absent')
    setBpm(null)
    setContact(null)
  }, [])

  const remettreAZero = useCallback(() => {
    setAcc(accumulateurVide())
    setRr([])
  }, [])

  // Le verrou d'écran est rendu par le navigateur dès que la page passe en
  // arrière-plan, et il n'est PAS repris tout seul au retour. Sans ce
  // réarmement, il suffirait de basculer une fois sur une autre application
  // pour que l'écran recommence à s'éteindre — et la liaison à se perdre.
  useEffect(() => {
    if (etat !== 'connecté') return
    const reprendre = () => {
      if (document.visibilityState === 'visible') void prendreVerrou(verrou)
    }
    document.addEventListener('visibilitychange', reprendre)
    return () => document.removeEventListener('visibilitychange', reprendre)
  }, [etat])

  // Couper la liaison en quittant l'écran : un brassard qui reste appairé à une
  // page fermée vide sa pile pour personne, et l'écran n'a plus à rester allumé.
  useEffect(() => {
    return () => {
      try {
        appareil.current?.gatt?.disconnect()
      } catch {
        /* rien à faire */
      }
      verrou.current?.release().catch(() => {})
      verrou.current = null
    }
  }, [])

  return {
    etat,
    nom,
    bpm,
    contact,
    rr,
    erreur,
    acc,
    bilan: bilan(acc),
    connecter,
    deconnecter,
    remettreAZero,
  }
}

/**
 * Demande le verrou d'écran, en silence.
 *
 * Absent d'un navigateur sur deux, refusé en arrière-plan, révoqué à
 * l'économiseur de batterie : tous ces cas sont normaux et aucun ne doit
 * interrompre une séance. On essaie, et s'il n'y a pas de verrou, tant pis —
 * la liaison tiendra tant que l'écran reste allumé à la main.
 */
async function prendreVerrou(ref: { current: { release: () => Promise<void> } | null }): Promise<void> {
  if (ref.current) return
  const api = (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } })
    .wakeLock
  if (!api) return
  try {
    ref.current = await api.request('screen')
  } catch {
    ref.current = null
  }
}
