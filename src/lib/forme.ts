import { KCAL_PAR_KG, tendancePoids } from './profil'
import { bilanCharge, type BilanCharge } from './trainingLoad'
import type { MuscuSession } from './muscu'
import type { Weighin } from './workouts'

// État de forme : le pont entre l'onglet Poids et la séance proposée.
//
// Trois signaux, tous déjà mesurés ailleurs dans l'app :
//   1. la charge d'entraînement récente (ratio aigu/chronique) ;
//   2. la balance énergétique, déduite de la pente de la courbe de poids ;
//   3. la vitesse de perte de poids.
//
// Deux leviers distincts, et c'est la nuance qui compte :
//   • un PIC DE CHARGE se corrige en baissant volume ET intensité ;
//   • un DÉFICIT ALIMENTAIRE se corrige en baissant le volume SEULEMENT.
//     Baisser les charges en déficit, c'est le meilleur moyen de perdre du
//     muscle en même temps que du gras — exactement ce qu'on cherche à éviter.

export type NiveauForme = 'pousser' | 'normal' | 'allege' | 'deload'

export interface Forme {
  niveau: NiveauForme
  label: string
  couleur: string
  /** Nombre d'exercices conseillé pour la séance générée. */
  exos: number
  /** Multiplicateur appliqué aux charges conseillées (1 = inchangé). */
  intensite: number
  /** Ce qui a motivé l'ajustement, dans l'ordre d'importance. */
  raisons: string[]
  charge: BilanCharge
  /** Écart énergétique quotidien déduit du poids : négatif = déficit. */
  balanceKcal: number | null
  /** Pente de la courbe de poids, en kg/semaine. */
  pente: number | null
}

const NIVEAUX: Record<NiveauForme, { label: string; couleur: string }> = {
  pousser: { label: 'Tu peux charger', couleur: '#10B981' },
  normal: { label: 'Rythme normal', couleur: '#B87333' },
  allege: { label: 'Séance allégée', couleur: '#F59E0B' },
  deload: { label: 'Décharge conseillée', couleur: '#EF4444' },
}

export function evaluerForme(sessions: MuscuSession[], weighins: Weighin[]): Forme {
  const charge = bilanCharge(sessions)
  const pente = tendancePoids(weighins, 28)
  const balanceKcal = pente !== null ? Math.round((pente * KCAL_PAR_KG) / 7) : null

  let exos = 6
  let intensite = 1
  const raisons: string[] = []

  // 1. Charge d'entraînement — le signal le plus fiable pour la blessure.
  const r = charge.ratio
  if (r !== null && r > 1.5) {
    exos = 4
    intensite = 0.85
    raisons.push(`Charge en pic (${r.toFixed(2)}× ton habitude) : volume et charges réduits.`)
  } else if (r !== null && r > 1.3) {
    exos = 5
    intensite = 0.95
    raisons.push(`Semaine en montée rapide (${r.toFixed(2)}×) : un cran en dessous.`)
  }

  // 2. Perte de poids rapide : au-delà d'1 kg/semaine, la récupération décroche
  // pour de bon — là, on baisse aussi les charges. Ce cas prend le pas sur le
  // simple déficit, sinon les deux messages se contrediraient.
  const perteRapide = pente !== null && pente <= -1
  if (perteRapide) {
    exos = Math.min(exos, 4)
    intensite = Math.min(intensite, 0.9)
    raisons.push(
      `Tu perds ${Math.abs(pente!).toFixed(1)} kg/semaine : trop vite pour récupérer normalement, tout est réduit.`,
    )
  } else if (balanceKcal !== null && balanceKcal <= -500) {
    // 3. Déficit alimentaire seul — on coupe le volume, jamais les charges.
    exos = Math.min(exos, 5)
    raisons.push(
      `Déficit marqué (~${Math.abs(balanceKcal)} kcal/j) : moins de volume, mêmes charges — c'est ce qui protège le muscle.`,
    )
  }

  // 4. Rien ne freine et la charge est basse : c'est le moment de pousser.
  if (
    raisons.length === 0 &&
    charge.aigue > 0 &&
    r !== null &&
    r < 0.8 &&
    (balanceKcal === null || balanceKcal >= -250)
  ) {
    exos = 7
    raisons.push(`Semaine légère (${r.toFixed(2)}×) et énergie disponible : tu peux ajouter du volume.`)
  }

  if (charge.aigue === 0) {
    raisons.push('Aucune séance sur 7 jours : reprends progressivement, sans chercher le volume.')
    exos = Math.min(exos, 5)
  }

  const niveau: NiveauForme =
    intensite <= 0.9 ? 'deload' : exos <= 5 ? 'allege' : exos >= 7 ? 'pousser' : 'normal'

  return {
    niveau,
    ...NIVEAUX[niveau],
    exos,
    intensite,
    raisons: raisons.length ? raisons : ['Charge et poids stables : rien à ajuster.'],
    charge,
    balanceKcal,
    pente,
  }
}
