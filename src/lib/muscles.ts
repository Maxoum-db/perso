// Couche domaine des muscles : quels muscles existent, comment ils s'appellent,
// et quel libellé de groupe couvre lesquels.
//
// Vit à part du mannequin : le générateur de séance, les priorités béhourd et
// le calcul de récupération s'appuient tous dessus, et un composant n'a pas à
// être la source de vérité du domaine.

export type MuscleRegion =
  | 'neck'
  | 'trapsUpper'
  | 'trapsMid'
  | 'trapsLow'
  | 'deltAnt'
  | 'deltLat'
  | 'deltPost'
  | 'pecUpper'
  | 'pecLower'
  | 'serratus'
  | 'lats'
  | 'teres'
  | 'erectors'
  | 'biceps'
  | 'brachialis'
  | 'tricepsLong'
  | 'tricepsLat'
  | 'forearmFlex'
  | 'forearmExt'
  | 'rectus'
  | 'obliques'
  | 'gluteMax'
  | 'gluteMed'
  | 'rectusFemoris'
  | 'vastusLat'
  | 'vastusMed'
  | 'adductors'
  | 'bicepsFemoris'
  | 'hamsInner'
  | 'gastroc'
  | 'soleus'
  | 'tibialis'

/** Nom affiché quand on touche un muscle sur le schéma. */
export const MUSCLE_LABELS: Record<MuscleRegion, string> = {
  neck: 'Cou (sterno-cléido-mastoïdien)',
  trapsUpper: 'Trapèze supérieur',
  trapsMid: 'Trapèze moyen',
  trapsLow: 'Trapèze inférieur',
  deltAnt: 'Deltoïde antérieur',
  deltLat: 'Deltoïde latéral',
  deltPost: 'Deltoïde postérieur',
  pecUpper: 'Pectoral supérieur (faisceau claviculaire)',
  pecLower: 'Grand pectoral',
  serratus: 'Dentelé antérieur',
  lats: 'Grand dorsal',
  teres: 'Grand rond',
  erectors: 'Érecteurs du rachis',
  biceps: 'Biceps brachial',
  brachialis: 'Brachial antérieur',
  tricepsLong: 'Triceps — longue portion',
  tricepsLat: 'Triceps — portion latérale',
  forearmFlex: 'Fléchisseurs de l’avant-bras',
  forearmExt: 'Extenseurs de l’avant-bras',
  rectus: 'Grand droit de l’abdomen',
  obliques: 'Obliques',
  gluteMax: 'Grand fessier',
  gluteMed: 'Moyen fessier',
  rectusFemoris: 'Droit fémoral',
  vastusLat: 'Vaste latéral',
  vastusMed: 'Vaste médial',
  adductors: 'Adducteurs',
  bicepsFemoris: 'Biceps fémoral',
  hamsInner: 'Ischios internes',
  gastroc: 'Gastrocnémiens (jumeaux)',
  soleus: 'Soléaire',
  tibialis: 'Tibial antérieur',
}

/** Trois degrés de sollicitation, pour la légende et les pastilles. */
export type Sollicitation = 'principal' | 'secondaire' | 'leger'

export function sollicitation(intensity: number): Sollicitation {
  if (intensity >= 0.8) return 'principal'
  if (intensity >= 0.5) return 'secondaire'
  return 'leger'
}

export const SOLLICITATION_MARQUEUR: Record<Sollicitation, string> = {
  principal: '●',
  secondaire: '◐',
  leger: '○',
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// ── Correspondance libellé → muscles ────────────────────────────────────────
// La recherche se fait par égalité sur le libellé normalisé : plus de piège de
// sous-chaîne (« Abdos » contient « dos »).

const DELTS: MuscleRegion[] = ['deltAnt', 'deltLat', 'deltPost']
const TRAPS: MuscleRegion[] = ['trapsUpper', 'trapsMid', 'trapsLow']
const PECS: MuscleRegion[] = ['pecUpper', 'pecLower']
const TRICEPS: MuscleRegion[] = ['tricepsLong', 'tricepsLat']
const FOREARMS: MuscleRegion[] = ['forearmFlex', 'forearmExt']
const BACK: MuscleRegion[] = ['lats', 'teres', 'trapsMid', 'trapsLow']
const ABS: MuscleRegion[] = ['rectus', 'obliques']
const GLUTES: MuscleRegion[] = ['gluteMax', 'gluteMed']
const QUADS: MuscleRegion[] = ['rectusFemoris', 'vastusLat', 'vastusMed']
const HAMS: MuscleRegion[] = ['bicepsFemoris', 'hamsInner']
const CALVES: MuscleRegion[] = ['gastroc', 'soleus']
const LEGS: MuscleRegion[] = [...QUADS, ...HAMS, ...CALVES, ...GLUTES, 'adductors', 'tibialis']
const UPPER: MuscleRegion[] = [...PECS, ...BACK, ...DELTS, ...TRICEPS, ...TRAPS, 'biceps', 'brachialis']

const MUSCLE_MAP: Record<string, MuscleRegion[]> = {
  // Groupes larges
  epaules: DELTS,
  pectoraux: PECS,
  dos: BACK,
  trapezes: TRAPS,
  triceps: TRICEPS,
  'avant-bras': FOREARMS,
  'abdos/core': ABS,
  fessiers: GLUTES,
  quadriceps: QUADS,
  ischios: HAMS,
  mollets: CALVES,
  lombaires: ['erectors'],
  cou: ['neck'],
  biceps: ['biceps', 'brachialis'],
  obliques: ['obliques'],
  adducteurs: ['adductors'],
  // Muscles précis
  'deltoide anterieur': ['deltAnt'],
  'deltoide lateral': ['deltLat'],
  'deltoide posterieur': ['deltPost'],
  'trapeze superieur': ['trapsUpper'],
  'trapeze moyen': ['trapsMid'],
  'trapeze inferieur': ['trapsLow'],
  rhomboides: ['trapsMid'],
  'pectoral superieur': ['pecUpper'],
  'grand pectoral': PECS,
  'grand dorsal': ['lats'],
  'grand rond': ['teres'],
  'dentele anterieur': ['serratus'],
  'erecteurs du rachis': ['erectors'],
  brachial: ['brachialis'],
  'brachio-radial': ['forearmFlex'],
  'triceps longue portion': ['tricepsLong'],
  'triceps lateral': ['tricepsLat'],
  'flechisseurs avant-bras': ['forearmFlex'],
  'extenseurs avant-bras': ['forearmExt'],
  'grand droit': ['rectus'],
  transverse: ['rectus'],
  'grand fessier': ['gluteMax'],
  'moyen fessier': ['gluteMed'],
  'droit femoral': ['rectusFemoris'],
  'vaste lateral': ['vastusLat'],
  'vaste medial': ['vastusMed'],
  'biceps femoral': ['bicepsFemoris'],
  'ischios internes': ['hamsInner'],
  gastrocnemiens: ['gastroc'],
  soleaire: ['soleus'],
  'tibial anterieur': ['tibialis'],
}

/** Les muscles couverts par un libellé de groupe ou de muscle. */
export function regionsForGroup(label: string): MuscleRegion[] {
  const n = norm(label)
  if (!n) return []
  const exact = MUSCLE_MAP[n]
  if (exact) return exact
  if (n.includes('full body') || n.includes('corps entier')) return [...LEGS, ...UPPER, ...ABS, 'neck', ...FOREARMS]
  if (n.includes('jambes')) return LEGS
  if (n.includes('haut du corps')) return UPPER
  // Repli tolérant pour les libellés personnalisés.
  for (const [key, regions] of Object.entries(MUSCLE_MAP)) {
    if (n.includes(key)) return regions
  }
  return [] // ex. « Cardio » : aucun muscle dédié
}
