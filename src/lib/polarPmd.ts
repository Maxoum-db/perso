// Le protocole PROPRE À POLAR, porté depuis leur SDK officiel.
//
//   https://github.com/polarofficial/polar-ble-sdk
//
// ── Pourquoi porter le protocole et non « intégrer le SDK » ─────────────────
//
// Le SDK de Polar existe en Kotlin (Android) et en Swift (iOS), et nulle part
// ailleurs. Il ne s'installe pas dans une page web : l'« intégrer » au sens
// propre demanderait d'écrire une application Android, c'est-à-dire de
// renoncer à tout ce que Couanac est.
//
// Mais un SDK n'est que du code qui parle un protocole, et le protocole, lui,
// est dans le dépôt. Les octets ci-dessous sont repris de :
//
//   · BlePMDClient.kt          — les identifiants du service et la commande de
//                                démarrage ;
//   · PmdDataFrame.kt          — l'en-tête de dix octets ;
//   · PpiData.kt               — les échantillons de six octets ;
//   · PmdMeasurementType.kt    — PPI = 3 ;
//   · PmdRecordingType.kt      — « en direct » = bit de poids fort à 0.
//
// C'est le SDK qui est la source, pas un article de blog ni ma mémoire.
//
// ── Ce que ça apporte par rapport au service standard ───────────────────────
//
// Le service normalisé (0x180D) donne les battements par minute, et parfois
// les intervalles RR — mais le Verity Sense est un capteur OPTIQUE, et les
// capteurs optiques ne publient généralement pas de RR sur le service
// standard. Sans ce fichier, la variabilité ne marcherait donc jamais avec ce
// brassard-là : l'écran resterait à « ce capteur n'envoie pas d'intervalles ».
//
// Le PPI de Polar (Peak-to-Peak Interval) est leur intervalle entre battements,
// déjà filtré, et surtout ACCOMPAGNÉ DE SA QUALITÉ : une marge d'erreur en
// millisecondes et un bit qui dit « celui-ci ne vaut rien ». Sur un capteur
// optique, où un mouvement du bras suffit à fabriquer un intervalle absurde,
// c'est la différence entre une variabilité mesurée et une variabilité
// inventée.

/** Service Polar Measurement Data. Les trois identifiants viennent de BlePMDClient.kt. */
export const PMD_SERVICE = 'fb005c80-02e7-f387-1cad-8acd2d8df0c8'
export const PMD_CONTROL = 'fb005c81-02e7-f387-1cad-8acd2d8df0c8'
export const PMD_DATA = 'fb005c82-02e7-f387-1cad-8acd2d8df0c8'

/** PmdMeasurementType.kt : PPI vaut 3. */
const TYPE_PPI = 0x03
/** PmdControlPointCommand.kt : démarrer = 2, arrêter = 3. */
const CMD_DEMARRER = 0x02
const CMD_ARRETER = 0x03

/**
 * « Démarre le PPI, en direct. »
 *
 * Le second octet porte le type de mesure ET le mode : PmdRecordingType décale
 * le mode de sept bits, et « en direct » vaut 0 — donc le type tout seul. Le
 * PPI n'a aucun réglage (pas de fréquence d'échantillonnage à choisir), la
 * commande s'arrête donc là.
 */
export const COMMANDE_DEMARRER_PPI: Uint8Array<ArrayBuffer> = new Uint8Array([CMD_DEMARRER, TYPE_PPI])
export const COMMANDE_ARRETER_PPI: Uint8Array<ArrayBuffer> = new Uint8Array([CMD_ARRETER, TYPE_PPI])

/** L'en-tête d'une trame PMD, d'après PmdDataFrame.kt. */
const ENTETE = 10

export interface TramePmd {
  type: number
  /** Horodatage du capteur, en nanosecondes. 0 quand le capteur ne le fournit pas. */
  horodatageNs: bigint
  typeTrame: number
  compressee: boolean
  contenu: DataView
}

export function parseTramePmd(vue: DataView): TramePmd {
  if (vue.byteLength < ENTETE) throw new Error('Trame PMD trop courte')
  const octetType = vue.getUint8(9)
  return {
    type: vue.getUint8(0),
    horodatageNs: vue.getBigUint64(1, true),
    // Le bit de poids fort marque une trame « delta » (compressée) ; les sept
    // autres portent le type. Les confondre ferait lire une trame compressée
    // comme une trame brute, donc des intervalles pris dans des octets de
    // différences.
    typeTrame: octetType & 0x7f,
    compressee: (octetType & 0x80) !== 0,
    contenu: new DataView(vue.buffer, vue.byteOffset + ENTETE, vue.byteLength - ENTETE),
  }
}

export interface EchantillonPpi {
  /** Battements par minute, tels que le capteur les calcule. */
  bpm: number
  /** Intervalle entre deux battements, en millisecondes. */
  ppMs: number
  /** Marge d'erreur estimée par le capteur, en millisecondes. Plus c'est bas, mieux c'est. */
  erreurMs: number
  /** Le capteur lui-même déclare cet intervalle inutilisable. */
  bloque: boolean
  /** `null` quand le capteur ne sait pas dire s'il touche la peau. */
  contact: boolean | null
}

const TAILLE_ECHANTILLON = 6

/**
 * Les échantillons d'une trame PPI brute (type 0).
 *
 * Six octets chacun, d'après PpiData.kt :
 *   0    — battements par minute
 *   1-2  — intervalle en ms (16 bits, petit-boutien)
 *   3-4  — marge d'erreur en ms
 *   5    — bit 0 : « inutilisable », bit 1 : contact, bit 2 : contact géré
 *
 * Le SDK refuse les trames compressées pour le PPI, et une taille qui n'est pas
 * un multiple de six. On fait pareil : mieux vaut rejeter une trame que la lire
 * de travers — un décalage d'un octet donne des intervalles plausibles et faux.
 */
export function parsePpi(trame: TramePmd): EchantillonPpi[] {
  if (trame.type !== TYPE_PPI) throw new Error(`Trame PMD de type ${trame.type}, attendu PPI (${TYPE_PPI})`)
  if (trame.compressee) throw new Error('Trame PPI compressée : non prévue par le protocole')
  if (trame.typeTrame !== 0) throw new Error(`Trame PPI de sous-type ${trame.typeTrame}, seul 0 existe`)
  const n = trame.contenu.byteLength
  if (n === 0 || n % TAILLE_ECHANTILLON !== 0) {
    throw new Error(`Trame PPI de ${n} octets : pas un multiple de ${TAILLE_ECHANTILLON}`)
  }
  const out: EchantillonPpi[] = []
  for (let i = 0; i < n; i += TAILLE_ECHANTILLON) {
    const drapeaux = trame.contenu.getUint8(i + 5)
    out.push({
      bpm: trame.contenu.getUint8(i),
      ppMs: trame.contenu.getUint16(i + 1, true),
      erreurMs: trame.contenu.getUint16(i + 3, true),
      bloque: (drapeaux & 0x01) !== 0,
      contact: (drapeaux & 0x04) !== 0 ? (drapeaux & 0x02) !== 0 : null,
    })
  }
  return out
}

/**
 * Marge d'erreur au-delà de laquelle on jette l'intervalle.
 *
 * Dix millisecondes. La RMSSD d'un adulte au repos se compte en dizaines de
 * millisecondes : un intervalle dont le capteur annonce lui-même ±30 ms ne
 * mesure plus la variabilité, il la fabrique. Polar ne fixe pas de seuil dans
 * son SDK — il expose la marge et laisse l'application décider —, celui-ci est
 * donc un choix, et il est ici pour pouvoir être discuté.
 */
export const ERREUR_MAX_MS = 10

/**
 * Les intervalles utilisables d'une trame, en millisecondes.
 *
 * Trois filtres, du plus autoritaire au plus prudent : ce que le capteur
 * déclare inutilisable, ce dont il annonce une marge trop large, et ce qui
 * n'est physiologiquement pas un battement. Le premier vient de Polar, les deux
 * autres sont les mêmes bornes que pour les RR du service standard.
 */
export function intervallesUtilisables(echantillons: EchantillonPpi[]): number[] {
  return echantillons
    .filter((e) => !e.bloque && e.erreurMs <= ERREUR_MAX_MS && e.ppMs >= 300 && e.ppMs <= 2000)
    .map((e) => e.ppMs)
}
