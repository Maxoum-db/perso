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
  // Le grand droit était quatorzième, juste avant les extenseurs de l'avant-bras
  // — ce qui contredisait la raison même pour laquelle la ceinture abdominale est
  // le point faible par défaut : sans elle, la force des jambes ne remonte pas
  // aux bras. Un tronc qui plie sous la frappe, c'est de la puissance perdue en
  // route, et c'est vrai à chaque coup donné.
  rectus: { rang: 6, pourquoi: 'transmet la force des jambes aux bras — le tronc ne doit pas plier' },
  gluteMax: { rang: 7, pourquoi: 'puissance de poussée en mêlée' },
  // Juste avant le deltoïde postérieur, qui traite la même épaule : c'est le
  // tendon qui lâche, pas le muscle. Et c'est la zone la plus lente à revenir
  // de tout le barème (7,5 j) — sans elle au classement, le générateur ne la
  // proposait jamais de lui-même, sur une épaule qui a déjà lâché une fois.
  rotatorCuff: {
    rang: 8,
    pourquoi: 'verrouille l’épaule sous les frappes — l’AC droite est déjà passée par là',
    exo: 'Rotation externe couché (élastique)',
  },
  deltPost: { rang: 9, pourquoi: 'contre l’épaule tombante (AC droite)' },
  // Le dentelé antérieur plaque l'omoplate contre la cage. C'est lui qui tient
  // l'épaule quand le bouclier encaisse, et il manquait au classement alors
  // qu'il fait partie de la ceinture au même titre que les obliques.
  serratus: { rang: 10, pourquoi: 'plaque l’omoplate quand le bouclier encaisse' },
  lats: { rang: 11, pourquoi: 'contrôle de l’adversaire et rappel du bras' },
  vastusMed: { rang: 12, pourquoi: 'stabilise la rotule (dysplasie)' },
  gluteMed: { rang: 13, pourquoi: 'stabilité latérale du genou' },
  vastusLat: { rang: 14, pourquoi: 'déplacement sous charge' },
  soleus: { rang: 15, pourquoi: 'endurance de déplacement en armure' },
  forearmExt: { rang: 16, pourquoi: 'équilibre la préhension — prévention épicondylite' },
}

/**
 * Multiplicateur de priorité béhourd : 1,93 pour le cou, 1 hors classement.
 *
 * Le diviseur se déduit de la table et n'est pas écrit en dur : figé à 15 alors
 * que la coiffe faisait la quinzième entrée, le dernier du classement se
 * retrouvait à 1 — soit exactement le poids d'un muscle non classé.
 */
const RANGS = Object.keys(PRIORITE_BEHOURD).length + 1

/**
 * Amplification en mode « spécial béhourd ».
 *
 * On double l'écart au neutre plutôt que de doubler le poids : un muscle hors
 * classement doit rester à 1 quoi qu'il arrive, sinon cocher la case rendrait
 * TOUT plus lourd et ne trierait plus rien. Le cou passe ainsi de ×1,94 à ×2,88,
 * le grand droit de ×1,65 à ×2,29, et un biceps reste à ×1.
 */
const AMPLI_BEHOURD = 2

export function poidsBehourd(region: MuscleRegion, special = false): number {
  const p = PRIORITE_BEHOURD[region]
  if (!p) return 1
  const poids = 1 + (RANGS - p.rang) / RANGS
  return special ? 1 + (poids - 1) * AMPLI_BEHOURD : poids
}

/** Les muscles classés, du plus prioritaire au moins. */
export function rangsBehourd(): MuscleRegion[] {
  return (Object.keys(PRIORITE_BEHOURD) as MuscleRegion[]).sort(
    (a, b) => PRIORITE_BEHOURD[a]!.rang - PRIORITE_BEHOURD[b]!.rang,
  )
}
