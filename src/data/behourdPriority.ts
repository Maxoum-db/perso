import type { MuscleRegion } from '../lib/muscles'

// Ce qui compte réellement en combat en armure, dans l'ordre, avec les points
// faibles connus du profil (épaule AC droite, dysplasie rotulienne).
//
// Sert à deux endroits : la carte « Points faibles béhourd » (ce qui est
// oublié) et le générateur de séance (ce qu'il faut viser en priorité quand
// plusieurs muscles sont également reposés).

export interface Priorite {
  rang: number
  pourquoi: string
  /** Exercice conseillé imposé, quand du matériel perso fait mieux que la salle. */
  exo?: string
}

export const PRIORITE_BEHOURD: Partial<Record<MuscleRegion, Priorite>> = {
  neck: { rang: 1, pourquoi: 'encaisse les frappes sous heaume — prévention commotion' },
  forearmFlex: {
    rang: 2,
    pourquoi: 'tient l’arme et le bouclier : souvent le vrai facteur limitant',
    exo: 'Anneau de préhension 40 kg',
  },
  trapsUpper: { rang: 3, pourquoi: 'porte les 33 kg du harnois' },
  erectors: { rang: 4, pourquoi: 'soutient la brigantine et protège les lombaires' },
  obliques: { rang: 5, pourquoi: 'porte les frappes en rotation' },
  gluteMax: { rang: 6, pourquoi: 'puissance de poussée en mêlée' },
  deltPost: { rang: 7, pourquoi: 'contre l’épaule tombante (AC droite)' },
  lats: { rang: 8, pourquoi: 'contrôle de l’adversaire et rappel du bras' },
  vastusMed: { rang: 9, pourquoi: 'stabilise la rotule (dysplasie)' },
  gluteMed: { rang: 10, pourquoi: 'stabilité latérale du genou' },
  vastusLat: { rang: 11, pourquoi: 'déplacement sous charge' },
  soleus: { rang: 12, pourquoi: 'endurance de déplacement en armure' },
  rectus: { rang: 13, pourquoi: 'transmet la force entre haut et bas du corps' },
  forearmExt: { rang: 14, pourquoi: 'équilibre la préhension — prévention épicondylite' },
}

/** Multiplicateur de priorité béhourd : 1,93 pour le cou, 1 hors classement. */
export function poidsBehourd(region: MuscleRegion): number {
  const p = PRIORITE_BEHOURD[region]
  return p ? 1 + (15 - p.rang) / 15 : 1
}
