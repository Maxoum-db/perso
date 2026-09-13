// La fréquence cardiaque : lire le capteur, en tirer quelque chose.
//
// Tout ce fichier est PUR — pas de Bluetooth, pas de React, pas de réseau. Le
// décodage d'une trame et le calcul d'une zone sont exactement le genre de
// choses qu'on croit justes et qu'on ne vérifie jamais, parce qu'un chiffre
// faux ressemble à un chiffre. Ici ils se vérifient sans capteur.

// ── La trame du capteur ─────────────────────────────────────────────────────
//
// Caractéristique standard « Heart Rate Measurement » (0x2A37) du service
// « Heart Rate » (0x180D). Standard veut dire : tout cardiofréquencemètre
// Bluetooth la parle, le Polar Verity Sense comme un autre. On ne dépend donc
// d'aucun SDK propriétaire, et le jour où le capteur change, rien à réécrire.
//
// Octet 0, les drapeaux :
//   bit 0 — format de la valeur : 0 = un octet, 1 = deux octets (petit-boutien)
//   bit 1 — contact avec la peau détecté
//   bit 2 — le capteur SAIT dire s'il y a contact (sans ce bit, le précédent
//           ne veut rien dire, et c'est le piège classique : un capteur qui ne
//           gère pas la détection envoie bit 1 à 0 et ferait croire au brassard
//           décroché en permanence)
//   bit 3 — dépense énergétique présente (deux octets, kJ)
//   bit 4 — intervalles RR présents (deux octets chacun, en 1/1024 s)

export interface MesureFC {
  /** Battements par minute. */
  bpm: number
  /** `null` quand le capteur ne sait pas le dire — à ne pas confondre avec « décroché ». */
  contact: boolean | null
  /** Intervalles entre deux battements, en millisecondes. Vide si le capteur n'en envoie pas. */
  rr: number[]
}

/** Un intervalle RR plausible chez un humain : de 300 ms (200 bpm) à 2 s (30 bpm). */
const RR_MIN = 300
const RR_MAX = 2000

export function parseMesureFC(vue: DataView): MesureFC {
  if (vue.byteLength < 2) throw new Error('Trame de fréquence cardiaque trop courte')
  const drapeaux = vue.getUint8(0)
  const surDeuxOctets = (drapeaux & 0b1) !== 0
  const bpm = surDeuxOctets ? vue.getUint16(1, true) : vue.getUint8(1)
  let i = surDeuxOctets ? 3 : 2
  if ((drapeaux & 0b1000) !== 0) i += 2 // dépense énergétique : présente, mais on ne s'en sert pas
  const rr: number[] = []
  if ((drapeaux & 0b10000) !== 0) {
    for (; i + 1 < vue.byteLength; i += 2) {
      // L'unité est le 1/1024 de seconde, pas la milliseconde : oublier la
      // conversion donne des RR ~2,4 % trop courts, donc une FC trop haute et
      // une HRV fausse — assez juste pour ne pas se voir.
      rr.push((vue.getUint16(i, true) * 1000) / 1024)
    }
  }
  return {
    bpm,
    contact: (drapeaux & 0b100) !== 0 ? (drapeaux & 0b10) !== 0 : null,
    rr: rr.filter((x) => x >= RR_MIN && x <= RR_MAX),
  }
}

// ── Les zones ───────────────────────────────────────────────────────────────
//
// Les cinq zones de Polar, par pourcentage de la fréquence maximale. Les mêmes
// que celles de sa montre et de Polar Flow : afficher « zone 3 » ici et « zone
// 4 » là pour le même battement serait pire que de ne rien afficher.
//
// En dessous de 50 %, on n'est dans aucune zone d'entraînement — c'est le
// repos, et c'est une information à part entière entre deux séries.

export type IdZone = 0 | 1 | 2 | 3 | 4 | 5

export const ZONES: Array<{ id: IdZone; label: string; bas: number; haut: number; couleur: string; aide: string }> = [
  { id: 0, label: 'Repos', bas: 0, haut: 0.5, couleur: '#6b7db3', aide: 'Sous 50 % : récupération entre deux séries.' },
  { id: 1, label: 'Très léger', bas: 0.5, haut: 0.6, couleur: '#4aa3df', aide: 'Échauffement, retour au calme.' },
  { id: 2, label: 'Léger', bas: 0.6, haut: 0.7, couleur: '#5bbf6a', aide: 'Endurance de base — on tient longtemps.' },
  { id: 3, label: 'Modéré', bas: 0.7, haut: 0.8, couleur: '#d9c34a', aide: 'Le cœur du travail aérobie.' },
  { id: 4, label: 'Difficile', bas: 0.8, haut: 0.9, couleur: '#e08a3c', aide: 'Seuil : ça coûte, et ça se paie en récupération.' },
  { id: 5, label: 'Maximal', bas: 0.9, haut: 1.1, couleur: '#c9483a', aide: 'Très court, très cher. Rare en musculation.' },
]

export function zoneDe(bpm: number, fcMax: number): IdZone {
  if (!(fcMax > 0)) return 0
  const part = bpm / fcMax
  // Parcouru à l'envers, et en ne regardant que la borne BASSE : la première
  // zone atteinte en descendant est la bonne. Une recherche encadrée
  // (`bas <= part < haut`) rendrait 195 bpm introuvable dès que l'estimation de
  // la max est trop basse — et elle l'est souvent, l'écart-type de Tanaka étant
  // de ±10 bpm. Sans zone trouvée, la fonction retomberait sur 0 : « au repos »
  // affiché en plein sprint.
  //
  // `haut` ne sert donc qu'à écrire les fourchettes en bpm à l'écran.
  for (let i = ZONES.length - 1; i >= 0; i--) if (part >= ZONES[i].bas) return ZONES[i].id
  return 0
}

export function zone(id: IdZone) {
  return ZONES.find((z) => z.id === id)!
}

/**
 * Fréquence maximale estimée — formule de Tanaka (2001) : 208 − 0,7 × âge.
 *
 * Et non « 220 − âge », qui vient d'un ajustement à vue sur un graphique de
 * 1971 et se trompe de dix battements passé quarante ans. Tanaka est issue
 * d'une méta-analyse de 351 études ; l'écart-type reste de ±10 bpm, ce qui veut
 * dire que cette estimation est un point de départ, pas une mesure. D'où la
 * possibilité de la remplacer par une valeur relevée sur le terrain.
 */
export function fcMaxEstimee(age: number | null): number | null {
  if (age === null || age < 5 || age > 110) return null
  return Math.round(208 - 0.7 * age)
}

// ── Le temps passé dans chaque zone ─────────────────────────────────────────

export type TempsParZone = Record<IdZone, number>

export function zonesVides(): TempsParZone {
  return { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
}

/**
 * Ajoute le temps écoulé depuis la mesure précédente à la zone où l'on était.
 *
 * On crédite la zone de DÉPART et non celle d'arrivée : entre deux battements,
 * le cœur était à l'ancienne valeur, pas à la nouvelle. Et on plafonne l'écart :
 * un téléphone qui s'endort ou un brassard qui décroche laisse un trou de
 * plusieurs minutes, qui serait entièrement porté au crédit de la dernière zone
 * vue — trois minutes en zone 4 pendant lesquelles on était au vestiaire.
 */
export const TROU_MAX_S = 10

/**
 * Le plafond est appliqué UNE fois, là où l'écart est calculé (`accumuler`), et
 * pas ici. Il l'était aux deux endroits : une redondance qui ne protège de rien
 * — les deux copies disaient la même chose — mais qui rendait le contrôle
 * aveugle, puisque supprimer l'une ne changeait aucun résultat.
 */
export function accumulerZone(
  zones: TempsParZone,
  zonePrecedente: IdZone | null,
  secondesEcoulees: number,
): TempsParZone {
  if (zonePrecedente === null || !(secondesEcoulees > 0)) return zones
  return { ...zones, [zonePrecedente]: zones[zonePrecedente] + secondesEcoulees }
}

export function totalZones(zones: TempsParZone): number {
  return (Object.values(zones) as number[]).reduce((a, b) => a + b, 0)
}

// ── La variabilité (HRV) ────────────────────────────────────────────────────

/**
 * RMSSD : racine de la moyenne des carrés des écarts entre battements
 * successifs, en millisecondes. La mesure de variabilité la plus robuste sur
 * une fenêtre courte, et celle que Polar emploie pour sa Nightly Recharge.
 *
 * ⚠️ Elle ne veut dire quelque chose QU'AU REPOS. À l'effort la variabilité
 * s'effondre — c'est normal, le cœur se cale —, et une RMSSD relevée au milieu
 * d'une série ne dit rien de la récupération. C'est pourquoi l'écran ne la
 * propose que dans une mesure au calme, et jamais pendant la séance.
 *
 * Les battements aberrants sont écartés : un saut de plus de 20 % d'un
 * intervalle au suivant est presque toujours un artefact du capteur optique
 * (brassard qui glisse, contraction du bras), et un seul artefact suffit à
 * tripler la RMSSD.
 */
export const SAUT_MAX = 0.2

export function rmssd(rr: number[]): number | null {
  const carres: number[] = []
  for (let i = 1; i < rr.length; i++) {
    const a = rr[i - 1]
    const b = rr[i]
    if (Math.abs(b - a) / a > SAUT_MAX) continue
    carres.push((b - a) ** 2)
  }
  if (carres.length < 2) return null
  return Math.round(Math.sqrt(carres.reduce((s, x) => s + x, 0) / carres.length))
}

/** Battements par minute moyens portés par une série d'intervalles RR. */
export function bpmDesRr(rr: number[]): number | null {
  if (!rr.length) return null
  return Math.round(60000 / (rr.reduce((s, x) => s + x, 0) / rr.length))
}

// ── Le résumé gardé avec la séance ──────────────────────────────────────────

export interface BilanCardio {
  /** Moyenne des battements, pondérée par le temps réel entre mesures. */
  moyenne: number
  max: number
  zones: TempsParZone
  /** Nombre de mesures reçues : sans lui, on ne sait pas si la moyenne vaut quelque chose. */
  mesures: number
}

/** Une moyenne pondérée par le temps, et non par le nombre de trames. */
export interface AccumulateurCardio {
  sommePonderee: number
  secondes: number
  max: number
  zones: TempsParZone
  mesures: number
  dernierBpm: number | null
  dernierInstant: number | null
}

export function accumulateurVide(): AccumulateurCardio {
  return { sommePonderee: 0, secondes: 0, max: 0, zones: zonesVides(), mesures: 0, dernierBpm: null, dernierInstant: null }
}

/**
 * Range une mesure.
 *
 * La moyenne est pondérée par le TEMPS et non par le nombre de trames : un
 * capteur envoie une trame par battement, donc plus souvent quand le cœur bat
 * vite. Une moyenne arithmétique des trames surestime donc systématiquement —
 * elle compte davantage les moments où l'on était haut.
 */
export function accumuler(
  acc: AccumulateurCardio,
  bpm: number,
  fcMax: number | null,
  instant: number,
): AccumulateurCardio {
  const ecart = acc.dernierInstant === null ? 0 : Math.min((instant - acc.dernierInstant) / 1000, TROU_MAX_S)
  const zonePrecedente = acc.dernierBpm !== null && fcMax ? zoneDe(acc.dernierBpm, fcMax) : null
  return {
    sommePonderee: acc.sommePonderee + (acc.dernierBpm ?? 0) * ecart,
    secondes: acc.secondes + ecart,
    max: Math.max(acc.max, bpm),
    zones: accumulerZone(acc.zones, zonePrecedente, ecart),
    mesures: acc.mesures + 1,
    dernierBpm: bpm,
    dernierInstant: instant,
  }
}

export function bilan(acc: AccumulateurCardio): BilanCardio | null {
  if (!acc.mesures) return null
  return {
    // Aucune seconde écoulée (une seule mesure) : la moyenne est ce battement-là.
    moyenne: Math.round(acc.secondes > 0 ? acc.sommePonderee / acc.secondes : (acc.dernierBpm ?? 0)),
    max: acc.max,
    zones: acc.zones,
    mesures: acc.mesures,
  }
}

/** « 12 min 30 s » — lisible d'un coup d'œil sous une barre de zone. */
export function fmtSecondes(s: number): string {
  const t = Math.round(s)
  if (t < 60) return `${t} s`
  const min = Math.floor(t / 60)
  const reste = t % 60
  return reste ? `${min} min ${reste} s` : `${min} min`
}
