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
 * Marge d'erreur au-delà de laquelle un intervalle ne veut plus rien dire.
 *
 * ⚠️ Cent millisecondes, et c'est une CORRECTION. J'avais d'abord mis dix, par
 * raisonnement : « la RMSSD au repos se compte en dizaines de millisecondes,
 * donc ±30 ms fabrique la variabilité au lieu de la mesurer ». Le raisonnement
 * se tient et le résultat était absurde — sur une mesure réelle de deux
 * minutes à 80 bpm, il restait SIX intervalles sur environ cent vingt. Une
 * RMSSD sur six intervalles ne vaut rien, et le chiffre s'affichait quand même.
 *
 * La documentation de Polar (documentation/PPIData.md) ne fixe aucun seuil
 * d'erreur. Elle dit ce qu'il faut jeter, et c'est autre chose :
 *
 *   « If skin contact flag is 0 or blocker flag is 1, the sample should not be
 *     treated as valid and discarded. »
 *
 * Le bit « mouvement détecté » est donc le vrai filtre. La marge d'erreur, elle,
 * est une INFORMATION sur la qualité — bonne à afficher, mauvaise comme
 * couperet. Ce seuil-ci ne sert plus qu'à écarter l'aberrant.
 */
export const ERREUR_MAX_MS = 100

/**
 * Faut-il se fier au drapeau de contact avec la peau ?
 *
 * Non sur le Verity Sense, et Polar le dit lui-même :
 *
 *   « Some older generation optical sensors such as Verity Sense and OH1 might
 *     expose that skin contact is supported, but that cannot be trusted. »
 *
 * On ne s'en sert donc pas pour jeter des échantillons. L'écran continue de
 * l'afficher — il est souvent juste — mais il ne décide de rien.
 */
export const CONTACT_FIABLE = false

/**
 * Les intervalles utilisables d'une trame, en millisecondes.
 *
 * Le seul filtre qui fait autorité est celui de Polar : le bit de mouvement.
 * Les deux autres bornes n'écartent que l'absurde — un intervalle hors des
 * limites humaines, ou une marge d'erreur si large que la valeur ne dit plus
 * rien.
 */
export function intervallesUtilisables(echantillons: EchantillonPpi[]): number[] {
  return echantillons
    .filter((e) => !e.bloque && e.erreurMs <= ERREUR_MAX_MS && e.ppMs >= 300 && e.ppMs <= 2000)
    .map((e) => e.ppMs)
}

/**
 * Ce que la qualité d'un lot dit, pour le montrer plutôt que le taire.
 *
 * Polar conseille explicitement de prévenir l'utilisateur quand les
 * échantillons bloqués s'enchaînent : « If the SDK application sees several
 * samples with blocker = 1 in a row, it could use that to inform the user that
 * they should try to be more still. » Un écran qui jette en silence laisse
 * croire à une panne du capteur alors qu'il suffit de ne plus bouger.
 */
export interface QualitePpi {
  recus: number
  gardes: number
  bloques: number
  /** Marge d'erreur médiane des intervalles gardés, en millisecondes. */
  erreurMediane: number | null
}

export function qualitePpi(echantillons: EchantillonPpi[]): QualitePpi {
  const gardes = echantillons.filter((e) => !e.bloque && e.erreurMs <= ERREUR_MAX_MS && e.ppMs >= 300 && e.ppMs <= 2000)
  const erreurs = gardes.map((e) => e.erreurMs).sort((a, b) => a - b)
  return {
    recus: echantillons.length,
    gardes: gardes.length,
    bloques: echantillons.filter((e) => e.bloque).length,
    erreurMediane: erreurs.length ? erreurs[Math.floor(erreurs.length / 2)] : null,
  }
}
