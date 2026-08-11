// L'OUTIL que chaque exercice demande.
//
// Deux usages, et un seul endroit où la question est tranchée :
//
//   • la NOTE — un exercice qu'on ne peut pas faire ne vaut rien, quelle que
//     soit sa qualité (cf. lib/scoreExercice) ;
//   • l'ORDRE de la séance — enchaîner barre, poulie, barre, haltères, poulie,
//     c'est traverser la salle cinq fois, reprendre une file d'attente à chaque
//     fois, et remonter une charge qu'on venait de poser. Les exercices qui
//     partagent un outil se suivent.
//
// La détection se fait sur le NOM, en cascade : la première règle qui
// correspond gagne. L'ordre des règles est donc la règle. Il est écrit pour que
// le cas le plus précis passe devant : « rotation externe d'épaule (poulie ou
// élastique) » est une poulie, pas un élastique, parce que la poulie existe
// partout et que c'est elle qu'on prendra.

/** Sans accents, en minuscules : les règles ci-dessous s'y comparent. */
function normaliser(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .toLowerCase()
}

export type OutilId =
  | 'corps'
  | 'barre'
  | 'haltere'
  | 'kettlebell'
  | 'poulie'
  | 'machine'
  | 'traction'
  | 'dips'
  | 'banc'
  | 'elastique'
  | 'suspension'
  | 'ballon'
  | 'trapbar'
  | 'traineau'
  | 'harnais'
  | 'anneau'
  | 'rouleau'
  | 'roulette'
  | 'coussin'
  | 'divers'

/** Ce qu'une salle basique a sous la main. */
export type Disponibilite = 'toujours' | 'parfois' | 'jamais'

export interface Outil {
  label: string
  emoji: string
  dispo: Disponibilite
}

/**
 * Le socle d'une salle : barres, haltères, kettlebells, poulies, machines,
 * bancs, barre de traction, barres à dips, tapis. Tout le reste s'apporte.
 */
export const OUTILS: Record<OutilId, Outil> = {
  corps: { label: 'Poids du corps', emoji: '🧍', dispo: 'toujours' },
  barre: { label: 'Barre', emoji: '🏋️', dispo: 'toujours' },
  haltere: { label: 'Haltères', emoji: '💪', dispo: 'toujours' },
  kettlebell: { label: 'Kettlebell', emoji: '🔔', dispo: 'toujours' },
  poulie: { label: 'Poulie', emoji: '🪢', dispo: 'toujours' },
  machine: { label: 'Machine', emoji: '⚙️', dispo: 'toujours' },
  traction: { label: 'Barre de traction', emoji: '🧗', dispo: 'toujours' },
  dips: { label: 'Barres à dips', emoji: '🤸', dispo: 'toujours' },
  banc: { label: 'Banc', emoji: '🛏️', dispo: 'toujours' },
  elastique: { label: 'Élastique', emoji: '〰️', dispo: 'parfois' },
  suspension: { label: 'Sangles de suspension', emoji: '🪝', dispo: 'parfois' },
  ballon: { label: 'Ballon lesté', emoji: '⚽', dispo: 'parfois' },
  trapbar: { label: 'Barre hexagonale', emoji: '🔷', dispo: 'parfois' },
  traineau: { label: 'Traîneau', emoji: '🛷', dispo: 'jamais' },
  harnais: { label: 'Harnais de nuque', emoji: '⛓️', dispo: 'jamais' },
  anneau: { label: 'Anneau de préhension', emoji: '💍', dispo: 'jamais' },
  rouleau: { label: 'Rouleau à poignet', emoji: '🌀', dispo: 'jamais' },
  roulette: { label: 'Roulette abdominale', emoji: '⭕', dispo: 'jamais' },
  coussin: { label: 'Coussin d’équilibre', emoji: '🛟', dispo: 'jamais' },
  divers: { label: 'Matériel à apporter', emoji: '🧰', dispo: 'jamais' },
}

/**
 * La cascade. PREMIÈRE règle qui correspond, et l'ordre est délibéré :
 *
 *   1. le matériel rare et reconnaissable, qui ne se confond avec rien ;
 *   2. les postes fixes de la salle (poulie, machine, traction, dips) — la
 *      poulie AVANT l'élastique, parce qu'un nom qui offre les deux se fait à
 *      la poulie ;
 *   3. les charges libres (kettlebell, haltères, barre) ;
 *   4. le banc seul, puis le corps par défaut.
 */
const REGLES: Array<[OutilId, RegExp]> = [
  // ── 0. Ce qui n'a l'air d'un outil que par son nom ──
  // « Torsion excentrique (barre souple ou serviette roulée) » n'est pas une
  // barre : c'est une serviette, et il y en a dans tous les sacs.
  ['corps', /serviette/],

  // ── 1. Ce qu'il faut apporter ──
  ['harnais', /harnais|neck harness|sangle cervicale/],
  ['anneau', /anneau de prehension/],
  ['roulette', /roulette abdominale/],
  ['rouleau', /rouleau a poignet|wrist roller/],
  ['traineau', /traineau/],
  ['coussin', /coussin|proprioception sur/],
  // Le curl nordique demande un partenaire ou un cale-pieds : ni l'un ni
  // l'autre en salle, et c'est bien un manque de matériel, pas de volonté.
  ['divers', /pneu|plaquettes|sac leste|bulgarian bag|gripper|nordique|nordic/],
  ['ballon', /ballon|medicine|swiss/],
  ['suspension', /sangles de suspension|\btrx\b/],
  ['trapbar', /trap bar|barre hexagonale/],

  // ── 2. Les postes de la salle ──
  // La poulie devant l'élastique : « (poulie ou élastique) » est une poulie.
  ['poulie', /poulie|a la corde|tirage (vertical|horizontal|bras tendus|buste appuye)|bucheron|face pull|tirage visage/],
  ['machine', /a la machine|\(machine\)|presse a cuisses|a la presse|hack|barre guidee|smith|pec deck|machine a|assistee|leg extension|leg curl|rameur/],
  ['traction', /\btraction|suspendu|suspension a la barre|barre fixe|chaise romaine/],
  ['dips', /\bdips\b|barres paralleles/],
  ['elastique', /elastique|mini-band|bande de resistance/],

  // ── 3. Les charges libres ──
  // Le relevé turc se fait à la kettlebell : c'est la poignée haute qui rend le
  // passage au sol tenable, et personne ne le monte à l'haltère long.
  ['kettlebell', /kettlebell|balancier|releve turc/],
  [
    'haltere',
    /haltere|gobelet|marche du fermier|port valise|arnold|farmer|renegade|\brack\b|elevation[s]? (laterale|frontale)|pleine canette|curl (concentration|zottman|marteau)|extension triceps buste penche|flexions? de poignets|extensions? de poignets/,
  ],
  [
    'barre',
    /barre|souleve de terre|squat(?! (au poids|sur box))|developpe (couche|militaire|incline|decline)|rowing|zercher|floor press|good ?morning|roumain|rdl|shrug|hauss|epaule-jete|arrache|t-bar|pupitre|curl inverse/,
  ],

  // ── 4. Ce qui ne demande qu'un banc, ou rien ──
  // Le banc est le poste : la fente bulgare et le saut sur box l'occupent
  // autant qu'un développé, même quand la charge, elle, ne vient pas de lui.
  ['banc', /banc|montee sur banc|step-up|hyperextension|inclinaison laterale sur|bulgare|sur box/],
]

/** L'outil qu'un exercice demande. Le corps, à défaut : c'est le cas le plus courant. */
export function outilDe(nom: string): OutilId {
  const n = normaliser(nom)
  for (const [outil, re] of REGLES) if (re.test(n)) return outil
  return 'corps'
}

/** Ce que le matériel coûte à la note d'un exercice : 0, 0,75 ou 2 points. */
export function malusMateriel(nom: string): number {
  const dispo = OUTILS[outilDe(nom)].dispo
  return dispo === 'jamais' ? 2 : dispo === 'parfois' ? 0.75 : 0
}

/** « 🏋️ Barre », pour l'écran. */
export function fmtOutil(id: OutilId): string {
  return `${OUTILS[id].emoji} ${OUTILS[id].label}`
}

/**
 * Regroupe une liste par outil, SANS défaire les priorités.
 *
 * Le premier bloc ne bouge jamais : c'est lui qui porte la règle « le point
 * faible d'abord, les gros mouvements d'abord ». Ensuite, à chaque étape, on
 * prend le prochain bloc qui partage l'outil du précédent ; à défaut, le
 * suivant dans l'ordre d'origine. Un tri par outil aurait mis les haltères en
 * tête d'une séance de jambes sous prétexte qu'il y en a trois.
 *
 * `blocs` et non `exercices` : un superset est indissociable, ses deux lignes
 * doivent rester collées et peuvent demander deux outils différents — c'est
 * même souvent le cas, un superset relie des antagonistes.
 */
export function grouperParOutil<T>(blocs: T[], outilsDe: (bloc: T) => OutilId[]): T[] {
  const restants = [...blocs]
  const sortie: T[] = []
  while (restants.length) {
    const precedent = sortie.length ? outilsDe(sortie[sortie.length - 1]) : null
    let i = 0
    if (precedent) {
      const j = restants.findIndex((b) => outilsDe(b).some((o) => precedent.includes(o)))
      if (j !== -1) i = j
    }
    sortie.push(...restants.splice(i, 1))
  }
  return sortie
}
