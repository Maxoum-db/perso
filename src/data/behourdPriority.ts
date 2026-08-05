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
  // Le heaume tire la tête EN AVANT toute la journée : ce sont les extenseurs
  // de la nuque qui la retiennent, pas le sterno-cléido-mastoïdien, qui fait
  // l'inverse. Ils passent donc devant lui.
  neckExt: { rang: 1, pourquoi: 'retient la tête que le heaume tire en avant, heure après heure' },
  neck: { rang: 2, pourquoi: 'encaisse les frappes sous heaume — prévention commotion' },
  // La prise de force, c'est le fléchisseur des DOIGTS. Le fléchisseur du
  // poignet l'assiste ; c'est le premier qui lâche en corps à corps.
  fingerFlex: {
    rang: 3,
    pourquoi: 'serre l’arme et le bouclier : le vrai facteur limitant en corps à corps',
    exo: 'Anneau de préhension 40 kg',
  },
  forearmFlex: { rang: 4, pourquoi: 'tient l’arme et le bouclier avec les doigts' },
  trapsUpper: { rang: 5, pourquoi: 'porte les 33 kg du harnois' },
  levator: { rang: 6, pourquoi: 'porte le heaume avec le trapèze — la nuque qui tire le lendemain' },
  erectors: { rang: 7, pourquoi: 'soutient la brigantine et protège les lombaires' },
  // Les multifides tiennent le rachis vertèbre par vertèbre là où les érecteurs
  // tirent en bloc : sous une charge asymétrique, c'est eux qui empêchent le
  // segment de céder.
  multifidus: { rang: 8, pourquoi: 'verrouille le rachis segment par segment sous charge asymétrique' },
  obliques: { rang: 9, pourquoi: 'porte les frappes en rotation' },
  // Le grand droit était quatorzième, juste avant les extenseurs de l'avant-bras
  // — ce qui contredisait la raison même pour laquelle la ceinture abdominale est
  // le point faible par défaut : sans elle, la force des jambes ne remonte pas
  // aux bras. Un tronc qui plie sous la frappe, c'est de la puissance perdue en
  // route, et c'est vrai à chaque coup donné.
  rectus: { rang: 10, pourquoi: 'transmet la force des jambes aux bras — le tronc ne doit pas plier' },
  transversus: { rang: 11, pourquoi: 'la sangle profonde : c’est elle qui serre avant que le grand droit tire' },
  gluteMax: { rang: 12, pourquoi: 'puissance de poussée en mêlée' },
  // Juste avant le deltoïde postérieur, qui traite la même épaule : c'est le
  // tendon qui lâche, pas le muscle. Et c'est la zone la plus lente à revenir
  // de tout le barème — sans elle au classement, le générateur ne la proposait
  // jamais de lui-même, sur une épaule qui a déjà lâché une fois.
  rotatorCuff: {
    rang: 13,
    pourquoi: 'verrouille l’épaule sous les frappes — l’AC droite est déjà passée par là',
    exo: 'Rotation externe couché (élastique)',
  },
  // Le sous-scapulaire retient la tête humérale VERS L'AVANT : exactement la
  // direction dans laquelle une acromio-claviculaire lâche.
  subscapularis: { rang: 14, pourquoi: 'retient la tête humérale vers l’avant — la direction où l’AC lâche' },
  supraspinatus: { rang: 15, pourquoi: 'amorce chaque levée de bras et s’use le premier sous l’acromion' },
  deltPost: { rang: 16, pourquoi: 'contre l’épaule tombante (AC droite)' },
  // Le dentelé antérieur plaque l'omoplate contre la cage. C'est lui qui tient
  // l'épaule quand le bouclier encaisse.
  serratus: { rang: 17, pourquoi: 'plaque l’omoplate quand le bouclier encaisse' },
  lats: { rang: 18, pourquoi: 'contrôle de l’adversaire et rappel du bras' },
  // Le port du bouclier est asymétrique par nature : le carré des lombes est ce
  // qui empêche le bassin de partir du côté chargé, des heures durant.
  quadratusLumborum: { rang: 19, pourquoi: 'tient le bassin de niveau sous un port asymétrique' },
  vastusMed: { rang: 20, pourquoi: 'stabilise la rotule (dysplasie)' },
  gluteMed: { rang: 21, pourquoi: 'stabilité latérale du genou' },
  // L'élongation des adducteurs est la blessure la plus fréquente des sports de
  // contact et de changement d'appui. Elle n'était pas au classement.
  adductors: { rang: 22, pourquoi: 'la blessure la plus fréquente du contact : changement d’appui en armure' },
  hipRotators: { rang: 23, pourquoi: 'la coiffe de la hanche : tient le fémur à chaque pivot en armure' },
  vastusLat: { rang: 24, pourquoi: 'déplacement sous charge' },
  soleus: { rang: 25, pourquoi: 'endurance de déplacement en armure' },
  // Sous 35 kg, c'est lui qui empêche la voûte de s'affaisser à chaque appui.
  tibPost: { rang: 26, pourquoi: 'soutient la voûte plantaire sous 35 kg d’armure' },
  scalenes: { rang: 27, pourquoi: 'inclinent la tête et ouvrent la cage en apnée d’effort' },
  teresMinor: { rang: 28, pourquoi: 'complète la rotation externe avec l’infra-épineux' },
  gracilis: { rang: 29, pourquoi: 'seul adducteur bi-articulaire : encaisse aussi le genou' },
  forearmExt: { rang: 30, pourquoi: 'équilibre la préhension — prévention épicondylite' },
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
