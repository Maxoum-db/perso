import { useCallback, useEffect, useRef, useState } from 'react'
import { prendreVerrou } from './verrouEcran'
import { accumulateurVide, accumuler, bilan, parseMesureFC, type AccumulateurCardio, type BilanCardio } from './cardio'
import {
  COMMANDE_ARRETER_PPI,
  COMMANDE_DEMARRER_PPI,
  intervallesUtilisables,
  parsePpi,
  parseTramePmd,
  PMD_CONTROL,
  PMD_DATA,
  PMD_SERVICE,
} from './polarPmd'

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
// ── Deux services, et le second n'existe que chez Polar ─────────────────────
//
// Le service NORMALISÉ donne les battements par minute : c'est lui qui fait
// tout ce qui s'affiche pendant la séance, et il marche avec n'importe quelle
// marque.
//
// Le service PMD de Polar donne en plus le PPI — les intervalles entre
// battements, avec leur marge d'erreur. Sur un capteur optique comme le Verity
// Sense, le service normalisé ne publie généralement AUCUN intervalle : sans
// PMD, la mesure de variabilité ne marcherait jamais avec ce brassard.
//
// ⚠️ MAIS LE PPI COÛTE CHER, et la documentation de Polar est formelle
// (documentation/products/PolarVeritySense.md) :
//
//   « When PPI recording is enabled, HR is only updated every 5 seconds. Also
//     it takes around 25 seconds for the first sample batch to be sent […]
//     enabling PPI recording will abort any ongoing training. »
//
// Autrement dit : demander le PPI pendant une séance dégrade la fréquence
// cardiaque à une mesure toutes les cinq secondes — exactement le chiffre
// qu'on regarde entre deux séries —, met vingt-cinq secondes à démarrer, et
// interrompt l'enregistrement interne du brassard.
//
// Le PPI ne se demande donc QUE là où la variabilité est le sujet : la mesure
// au repos, où l'on ne bouge pas pendant deux minutes et où un battement
// toutes les cinq secondes ne gêne personne. En séance, on s'en passe.
//
// ── Ce qui ne marchera pas, et il faut le dire ──────────────────────────────
//
//   · iOS : Safari n'implémente pas Web Bluetooth, et aucun navigateur iOS ne
//     le peut (ils sont tous Safari dessous). Sur iPhone, ce bouton ne peut pas
//     exister — l'écran le dit plutôt que de proposer un bouton qui échoue ;
//   · Firefox : même chose ;
//   · hors HTTPS : l'API est refusée. Vercel sert en HTTPS, donc c'est bon ;
//   · l'appairage demande un GESTE. On ne peut donc pas rebrancher le capteur
//     tout seul au lancement d'une séance : il faut un appui, à chaque fois.
//
//     Et ce n'est pas faute d'avoir cherché. La spécification prévoit bien de
//     quoi s'en passer — `getDevices()` rend les appareils déjà autorisés,
//     `watchAdvertisements()` dit quand l'un d'eux repasse à portée, et les
//     « Persistent Device Permissions » font survivre l'autorisation à la
//     fermeture du navigateur. Les trois ensemble permettraient un
//     rebranchement silencieux.
//
//     Les trois sont derrière un drapeau Chrome
//     (`#enable-experimental-web-platform-features` et
//     `#enable-web-bluetooth-new-permissions-backend`), d'après le tableau
//     d'état du groupe de travail lui-même. Les coder aujourd'hui ne servirait
//     donc personne sur un téléphone ordinaire — et le repli serait de toute
//     façon le bouton. À reconsidérer le jour où ces lignes perdent leur
//     drapeau ; d'ici là, l'appui est la seule voie, et l'écran le demande
//     franchement plutôt que de faire mine d'essayer.
//
// ── L'écran qui s'éteint ────────────────────────────────────────────────────
//
// Un téléphone verrouille son écran au bout d'une minute, met la page en
// arrière-plan, et les notifications Bluetooth s'arrêtent. Sur une séance
// d'une heure, la liaison serait donc perdue en permanence — la fonction ne
// servirait à rien. On demande donc un verrou d'écran TANT QUE le capteur est
// branché, et on le rend en le débranchant : garder l'écran allumé coûte de la
// batterie, ça ne se fait pas « au cas où ».
//
// Le verrou lui-même vit dans `verrouEcran.ts` depuis que le GPS a le même
// besoin, et pour la même raison. Deux copies auraient divergé.

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
  /** Le capteur parle-t-il le protocole Polar ? Sinon, pas de variabilité. */
  ppi: boolean
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
  /**
   * Allume ou éteint les intervalles Polar sur une liaison déjà ouverte.
   *
   * Réservé à la mesure au repos, et à elle seule. Le PPI coûte cher en séance :
   * la fréquence n'est plus rafraîchie que toutes les cinq secondes, le premier
   * lot se fait attendre vingt-cinq, et le capteur interrompt son propre
   * enregistrement. On l'allume donc pour deux minutes d'immobilité, et on
   * l'éteint juste après.
   */
  activerPpi: (on: boolean) => Promise<void>
}

/**
 * Combien de temps on attend une étape de connexion avant d'abandonner.
 *
 * Quinze secondes : un appairage qui marche prend une à trois secondes. Au-delà,
 * ce n'est plus de la lenteur, c'est que ça ne viendra pas — et le plus souvent
 * parce qu'une autre application tient déjà le capteur.
 */
const DELAI_CONNEXION_MS = 15_000

/**
 * Impose un délai à une promesse qui pourrait ne jamais se résoudre.
 *
 * Web Bluetooth ne garantit AUCUN délai : `connect()` peut rester en suspens
 * indéfiniment, sans succès ni erreur. Une promesse qui ne retombe jamais est
 * le pire des cas pour une interface — elle ne montre ni résultat, ni panne,
 * juste un bouton grisé.
 */
export function sousDelai<T>(promesse: Promise<T>, etape: string, ms = DELAI_CONNEXION_MS): Promise<T> {
  return Promise.race([
    promesse,
    new Promise<T>((_, rejeter) =>
      setTimeout(
        () =>
          rejeter(
            new Error(
              `Le capteur n’a pas répondu (${etape}). Le plus souvent, une autre application le tient déjà : ` +
                `ferme Polar Flow ou Polar Beat, éteins et rallume le brassard, puis réessaie.`,
            ),
          ),
        ms,
      ),
    ),
  ])
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
    connect(): Promise<{ getPrimaryService(u: number | string): Promise<GattServiceMin> }>
    disconnect(): void
  }
  addEventListener(t: string, f: () => void): void
  removeEventListener(t: string, f: () => void): void
}

interface CaracteristiqueMin {
  startNotifications(): Promise<unknown>
  stopNotifications(): Promise<unknown>
  addEventListener(t: string, f: (e: Event) => void): void
  removeEventListener(t: string, f: (e: Event) => void): void
  writeValue(v: BufferSource): Promise<void>
  writeValueWithResponse?(v: BufferSource): Promise<void>
}

interface GattServiceMin {
  getCharacteristic(u: number | string): Promise<CaracteristiqueMin>
}

/**
 * Branche le capteur et tient l'état de la mesure.
 *
 * @param fcMax  la fréquence maximale servant aux zones. Peut être `null` : on
 *               enregistre alors les battements sans les ranger, plutôt que de
 *               les ranger n'importe où.
 */
export function useCapteurCardio(fcMax: number | null, options?: { ppi?: boolean }): Capteur {
  const veutPpi = options?.ppi === true
  const [etat, setEtat] = useState<EtatCapteur>(() => (bluetoothDisponible() ? 'prêt' : 'absent'))
  const [nom, setNom] = useState<string | null>(null)
  const [bpm, setBpm] = useState<number | null>(null)
  const [contact, setContact] = useState<boolean | null>(null)
  const [rr, setRr] = useState<number[]>([])
  const [ppi, setPpi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [acc, setAcc] = useState<AccumulateurCardio>(accumulateurVide)

  const appareil = useRef<BluetoothDeviceMin | null>(null)
  const verrou = useRef<{ release: () => Promise<void> } | null>(null)
  const controlePmd = useRef<{ writeValueWithResponse?(v: BufferSource): Promise<void>; writeValue(v: BufferSource): Promise<void> } | null>(null)
  // Le serveur GATT, gardé après la connexion.
  //
  // Le PPI n'était demandé qu'À L'APPAIRAGE, d'après une option figée au montage
  // du composant. C'était tenable tant que chaque écran ouvrait sa propre
  // liaison ; ça ne l'est plus depuis que la liaison est unique et partagée —
  // la mesure au repos doit pouvoir allumer les intervalles sur une liaison
  // déjà ouverte par une séance, et les éteindre en repartant.
  const serveurGatt = useRef<{ getPrimaryService(u: string): Promise<GattServiceMin> } | null>(null)
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

  /**
   * Les intervalles Polar, quand le capteur les propose.
   *
   * Tout échoue en silence et c'est voulu : un brassard d'une autre marque n'a
   * pas ce service, un Polar peut refuser la commande, et dans les deux cas la
   * séance doit se dérouler normalement avec les battements du service
   * standard. Perdre la variabilité n'est pas perdre la mesure.
   */
  const brancherPpi = useCallback(
    async (serveur: { getPrimaryService(u: string): Promise<GattServiceMin> }) => {
      try {
        const service = await sousDelai(serveur.getPrimaryService(PMD_SERVICE), 'le service Polar')
        const donnees = await sousDelai(service.getCharacteristic(PMD_DATA), 'les données Polar')
        donnees.addEventListener('characteristicvaluechanged', (e: Event) => {
          const vue = (e.target as unknown as { value: DataView }).value
          try {
            const utiles = intervallesUtilisables(parsePpi(parseTramePmd(vue)))
            if (utiles.length) setRr((prev) => [...prev, ...utiles].slice(-RR_GARDES))
          } catch {
            // Trame d'un autre type de mesure, ou abîmée : on saute celle-là.
          }
        })
        await sousDelai(donnees.startNotifications(), 'l’abonnement au PPI')
        const controle = await sousDelai(service.getCharacteristic(PMD_CONTROL), 'le point de contrôle Polar')
        // Le point de contrôle répond par une notification : il faut l'écouter
        // AVANT d'écrire, sinon la réponse du capteur tombe dans le vide et
        // certaines piles Bluetooth rejettent l'écriture suivante.
        await controle.startNotifications().catch(() => {})
        await ecrire(controle, COMMANDE_DEMARRER_PPI)
        controlePmd.current = controle as never
        setPpi(true)
      } catch {
        setPpi(false)
      }
    },
    [],
  )

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
        // Le service Polar doit être demandé ICI : le navigateur interdit
        // d'accéder à un service qu'on n'a pas annoncé au moment de
        // l'appairage, même une fois connecté. Il reste facultatif — un
        // capteur qui ne l'a pas se connecte quand même.
        optionalServices: [PMD_SERVICE],
      })
      setEtat('connexion')
      appareil.current = dev
      setNom(dev.name ?? 'Capteur')
      dev.addEventListener('gattserverdisconnected', () => setEtat('perdu'))
      // Chaque étape sous délai. Sans ça, un `connect()` qui ne rend jamais la
      // main laisse « Connexion… » grisé POUR TOUJOURS : pas d'erreur, pas de
      // retour en arrière, rien à faire que recharger la page. C'est ce qui
      // arrive quand une autre application tient déjà le capteur — et c'est un
      // défaut de cet écran, pas seulement du brassard : une attente sans fin
      // n'est pas un message.
      const serveur = await sousDelai(dev.gatt!.connect(), 'la liaison')
      serveurGatt.current = serveur
      const service = await sousDelai(serveur.getPrimaryService(SERVICE_FC), 'le service cardiaque')
      const caract = await sousDelai(service.getCharacteristic(CARACT_MESURE), 'la mesure')
      caract.addEventListener('characteristicvaluechanged', surMesure)
      await sousDelai(caract.startNotifications(), 'l’abonnement aux battements')
      setEtat('connecté')
      void prendreVerrou(verrou)
      if (veutPpi) void brancherPpi(serveur)
    } catch (e) {
      const msg = (e as Error).message ?? ''
      // On lâche la liaison à moitié ouverte : sans ça, le capteur reste
      // occupé par une connexion que plus personne n'écoute, et l'essai
      // suivant échoue pour la même raison que le premier.
      try {
        appareil.current?.gatt?.disconnect()
      } catch {
        /* rien à rendre */
      }
      // Fermer le sélecteur du navigateur n'est pas une panne : on retourne à
      // l'état d'avant, sans message rouge.
      if (/User cancelled|cancell?ed/i.test(msg)) setEtat('prêt')
      else {
        setErreur(msg || 'Connexion au capteur impossible.')
        setEtat('prêt')
      }
    }
  }, [surMesure, brancherPpi, veutPpi])

  const deconnecter = useCallback(() => {
    // On arrête la mesure Polar avant de couper : un capteur laissé en PPI
    // continue d'échantillonner et vide sa pile pour personne.
    const c = controlePmd.current
    controlePmd.current = null
    if (c) void ecrire(c, COMMANDE_ARRETER_PPI).catch(() => {})
    setPpi(false)
    try {
      appareil.current?.gatt?.disconnect()
    } catch {
      /* déjà parti */
    }
    appareil.current = null
    serveurGatt.current = null
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

  const activerPpi = useCallback(
    async (on: boolean) => {
      if (on) {
        // Déjà allumé : ne pas renvoyer la commande de démarrage. Certaines
        // piles Bluetooth refusent la seconde, et on perdrait la première.
        if (controlePmd.current) return
        const serveur = serveurGatt.current
        if (!serveur) return
        await brancherPpi(serveur)
        return
      }
      const c = controlePmd.current
      controlePmd.current = null
      setPpi(false)
      if (c) await ecrire(c, COMMANDE_ARRETER_PPI).catch(() => {})
    },
    [brancherPpi],
  )

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
    ppi,
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
    activerPpi,
  }
}

/**
 * Écrit sur une caractéristique, avec accusé de réception quand c'est possible.
 *
 * Le point de contrôle PMD répond, donc l'écriture doit être « avec réponse » —
 * une écriture sans accusé peut être perdue sans que rien ne le dise, et la
 * mesure ne démarrerait jamais. `writeValueWithResponse` n'existe pas sur les
 * piles les plus anciennes, d'où le repli.
 */
async function ecrire(
  caract: { writeValueWithResponse?(v: BufferSource): Promise<void>; writeValue(v: BufferSource): Promise<void> },
  octets: Uint8Array<ArrayBuffer>,
): Promise<void> {
  if (caract.writeValueWithResponse) return caract.writeValueWithResponse(octets)
  return caract.writeValue(octets)
}
