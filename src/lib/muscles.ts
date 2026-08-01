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
  | 'rhomboids'
  | 'rotatorCuff'
  | 'erectors'
  | 'biceps'
  | 'brachialis'
  | 'brachioradialis'
  | 'tricepsLong'
  | 'tricepsLat'
  | 'forearmFlex'
  | 'forearmExt'
  | 'rectus'
  | 'obliques'
  | 'gluteMax'
  | 'gluteMed'
  | 'tfl'
  | 'hipFlexors'
  | 'rectusFemoris'
  | 'vastusLat'
  | 'vastusMed'
  | 'adductors'
  | 'bicepsFemoris'
  | 'hamsInner'
  | 'gastroc'
  | 'soleus'
  | 'tibialis'
  | 'fibularis'

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
  rhomboids: 'Rhomboïdes',
  rotatorCuff: 'Coiffe des rotateurs (infra-épineux)',
  erectors: 'Érecteurs du rachis',
  biceps: 'Biceps brachial',
  brachialis: 'Brachial antérieur',
  brachioradialis: 'Brachio-radial (long supinateur)',
  tricepsLong: 'Triceps — longue portion',
  tricepsLat: 'Triceps — portion latérale',
  forearmFlex: 'Fléchisseurs de l’avant-bras',
  forearmExt: 'Extenseurs de l’avant-bras',
  rectus: 'Grand droit de l’abdomen',
  obliques: 'Obliques',
  gluteMax: 'Grand fessier',
  gluteMed: 'Moyen fessier',
  tfl: 'Tenseur du fascia lata',
  hipFlexors: 'Psoas-iliaque (fléchisseurs de hanche)',
  rectusFemoris: 'Droit fémoral',
  vastusLat: 'Vaste latéral',
  vastusMed: 'Vaste médial',
  adductors: 'Adducteurs',
  bicepsFemoris: 'Biceps fémoral',
  hamsInner: 'Ischios internes',
  gastroc: 'Gastrocnémiens (jumeaux)',
  soleus: 'Soléaire',
  tibialis: 'Tibial antérieur',
  fibularis: 'Fibulaires (péroniers)',
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
//
// Un libellé PRÉCIS ne doit pas recouvrir un autre libellé précis. Quand deux
// libellés d'un même exercice retombent sur le même muscle, c'est la part la
// PLUS FORTE qui est retenue partout — donc écrire « Grand pectoral:1, Pectoral
// supérieur:0.5 » pour dire que le faisceau claviculaire ne prend que la moitié
// n'avait aucun effet : il en prenait 1. La précision était écrite dans la
// bibliothèque et appliquée nulle part.
//
// Deux libellés étaient dans ce cas, et tous deux contredisaient MUSCLE_LABELS,
// qui nomme « Grand pectoral » le seul faisceau sternal et « Biceps brachial »
// le seul biceps. Ils ne couvrent donc plus que leur propre muscle, et les
// exercices qui travaillent aussi le voisin le DISENT désormais, avec leur part.
// Le groupe large « Pectoraux » reste là pour viser les deux faisceaux d'un coup.

const DELTS: MuscleRegion[] = ['deltAnt', 'deltLat', 'deltPost']
const TRAPS: MuscleRegion[] = ['trapsUpper', 'trapsMid', 'trapsLow']
const PECS: MuscleRegion[] = ['pecUpper', 'pecLower']
const TRICEPS: MuscleRegion[] = ['tricepsLong', 'tricepsLat']
const FOREARMS: MuscleRegion[] = ['forearmFlex', 'forearmExt', 'brachioradialis']
const BACK: MuscleRegion[] = ['lats', 'teres', 'rhomboids', 'trapsMid', 'trapsLow']
const ABS: MuscleRegion[] = ['rectus', 'obliques']
const GLUTES: MuscleRegion[] = ['gluteMax', 'gluteMed']
const QUADS: MuscleRegion[] = ['rectusFemoris', 'vastusLat', 'vastusMed']
const HAMS: MuscleRegion[] = ['bicepsFemoris', 'hamsInner']
const CALVES: MuscleRegion[] = ['gastroc', 'soleus']
const LEGS: MuscleRegion[] = [...QUADS, ...HAMS, ...CALVES, ...GLUTES, 'adductors', 'tibialis', 'fibularis', 'tfl', 'hipFlexors']
const UPPER: MuscleRegion[] = [...PECS, ...BACK, ...DELTS, ...TRICEPS, ...TRAPS, 'biceps', 'brachialis', 'brachioradialis', 'rotatorCuff']

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
  // « Biceps » ne couvre plus le brachial, et « Grand pectoral » plus le
  // faisceau claviculaire (cf. le commentaire au-dessus de MUSCLE_MAP).
  biceps: ['biceps'],
  obliques: ['obliques'],
  adducteurs: ['adductors'],
  // Muscles précis
  'deltoide anterieur': ['deltAnt'],
  'deltoide lateral': ['deltLat'],
  'deltoide posterieur': ['deltPost'],
  'trapeze superieur': ['trapsUpper'],
  'trapeze moyen': ['trapsMid'],
  'trapeze inferieur': ['trapsLow'],
  rhomboides: ['rhomboids'],
  'pectoral superieur': ['pecUpper'],
  'grand pectoral': ['pecLower'],
  'grand dorsal': ['lats'],
  'grand rond': ['teres'],
  'dentele anterieur': ['serratus'],
  'erecteurs du rachis': ['erectors'],
  brachial: ['brachialis'],
  'brachio-radial': ['brachioradialis'],
  'long supinateur': ['brachioradialis'],
  'coiffe des rotateurs': ['rotatorCuff'],
  'infra-epineux': ['rotatorCuff'],
  rotateurs: ['rotatorCuff'],
  'psoas-iliaque': ['hipFlexors'],
  psoas: ['hipFlexors'],
  'flechisseurs de hanche': ['hipFlexors'],
  'tenseur du fascia lata': ['tfl'],
  tfl: ['tfl'],
  fibulaires: ['fibularis'],
  peroniers: ['fibularis'],
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

const CLES_PAR_LONGUEUR = Object.keys(MUSCLE_MAP).sort((a, b) => b.length - a.length)

/** Les muscles couverts par un libellé de groupe ou de muscle. */
export function regionsForGroup(label: string): MuscleRegion[] {
  const n = norm(label)
  if (!n) return []
  const exact = MUSCLE_MAP[n]
  if (exact) return exact
  if (n.includes('full body') || n.includes('corps entier')) return [...LEGS, ...UPPER, ...ABS, 'neck', ...FOREARMS]
  if (n.includes('jambes')) return LEGS
  if (n.includes('haut du corps')) return UPPER
  // Repli tolérant pour les libellés personnalisés — mais sur des MOTS entiers,
  // et en essayant les clés les plus longues d'abord. « Couturier » contenait
  // « cou » et colorait donc la nuque ; « Biceps fémoral gauche » aurait pris le
  // biceps du bras avant d'atteindre sa propre clé.
  for (const key of CLES_PAR_LONGUEUR) {
    if (new RegExp(`(^|[^a-z])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(n)) {
      return MUSCLE_MAP[key]
    }
  }
  return [] // ex. « Cardio » : aucun muscle dédié
}
