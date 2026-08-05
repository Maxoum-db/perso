// Couche domaine des muscles : quels muscles existent, comment ils s'appellent,
// et quel libellé de groupe couvre lesquels.
//
// Vit à part du mannequin : le générateur de séance, les priorités béhourd et
// le calcul de récupération s'appuient tous dessus, et un composant n'a pas à
// être la source de vérité du domaine.

export type MuscleRegion =
  | 'neck'
  // Les extenseurs du cou (splénius, semi-épineux) : la nuque proprement dite.
  // Ils n'existaient pas, et « Cou » ne désignait que le sterno-cléido-
  // mastoïdien — un FLÉCHISSEUR. Une extension cervicale à l'élastique peignait
  // donc son antagoniste, et sous le heaume c'est exactement l'inverse qui
  // travaille : la tête bascule en avant, la nuque la retient toute la journée.
  | 'neckExt'
  // Scalènes : les trois haubans latéraux du cou. Ils inclinent la tête ET
  // soulèvent les premières côtes à chaque inspiration forcée — sous le heaume
  // et en apnée d'effort, ils travaillent des deux façons à la fois.
  | 'scalenes'
  // Élévateur de la scapula : de l'atlas à l'angle supérieur de l'omoplate.
  // Le muscle qui porte le poids d'un heaume ou d'un sac, aux côtés du trapèze
  // supérieur, et la douleur de nuque la plus banale après un portage.
  | 'levator'
  | 'trapsUpper'
  | 'trapsMid'
  | 'trapsLow'
  | 'deltAnt'
  | 'deltLat'
  | 'deltPost'
  | 'pecUpper'
  | 'pecLower'
  | 'serratus'
  // Petit pectoral : de la coracoïde aux 3e-5e côtes. Il bascule l'omoplate
  // vers l'avant, et raccourci il ferme le défilé sous-acromial — le mécanisme
  // même de l'accrochage d'épaule. Invisible, jamais étiqueté, et pourtant au
  // cœur de la posture d'épaule.
  | 'pecMinor'
  | 'lats'
  | 'teres'
  | 'rhomboids'
  | 'rotatorCuff'
  // Petit rond : le second rotateur externe, juste sous l'infra-épineux. Avec
  // le supra-épineux et le sous-scapulaire, la coiffe est enfin complète — on
  // n'en représentait qu'un quart.
  | 'teresMinor'
  // Sous-scapulaire : plaqué sur la face antérieure de l'omoplate, seul
  // rotateur INTERNE de la coiffe, et le plus puissant des quatre. C'est lui
  // qui retient la tête humérale vers l'avant — exactement la direction dans
  // laquelle une acromio-claviculaire lâche.
  | 'subscapularis'
  // Supra-épineux : il amorce les quinze premiers degrés d'abduction et centre
  // la tête humérale sous l'acromion. C'est LE tendon qui s'use en premier sur
  // une épaule qui a déjà lâché, et « Coiffe des rotateurs » ne désignait que
  // l'infra-épineux.
  | 'supraspinatus'
  | 'erectors'
  // Multifides : les faisceaux courts qui relient chaque vertèbre à la
  // suivante. Ils stabilisent segment par segment là où les érecteurs tirent
  // en bloc — c'est eux que travaillent un bird-dog ou un Pallof, et eux qui
  // s'atrophient les premiers après un lumbago.
  | 'multifidus'
  // Carré des lombes : de la dernière côte à la crête iliaque. C'est lui qui
  // empêche le bassin de partir de côté sous un port valise, et lui qui tient
  // la flexion latérale — travail que les érecteurs et les obliques
  // s'attribuaient faute de mieux.
  | 'quadratusLumborum'
  | 'biceps'
  | 'brachialis'
  // Coraco-brachial : de la coracoïde à l'humérus, le seul fléchisseur pur de
  // l'épaule du compartiment antérieur du bras.
  | 'coracobrachialis'
  | 'brachioradialis'
  | 'tricepsLong'
  | 'tricepsLat'
  | 'forearmFlex'
  | 'forearmExt'
  // Fléchisseurs profonds des doigts : la prise de force proprement dite.
  // Distincts des fléchisseurs du poignet, avec lesquels ils étaient confondus
  // — or serrer un anneau à 40 kg et fléchir le poignet contre charge ne sont
  // pas le même geste, et c'est le premier qui décide d'un corps à corps.
  | 'fingerFlex'
  // Rond pronateur et supinateur : la rotation de l'avant-bras. Un exercice de
  // la bibliothèque s'appelle « Pronation-supination » et n'étiquetait aucun
  // des deux muscles qui la produisent.
  | 'pronators'
  | 'rectus'
  | 'obliques'
  // Transverse de l'abdomen : la ceinture profonde, horizontale, qui serre la
  // taille comme un corset. Le libellé « Transverse » pointait sur le GRAND
  // DROIT — la plaque de chocolat, qui fléchit le tronc et ne serre rien. Un
  // vacuum abdominal, dont la note dit « transverse profond », peignait donc
  // les abdominaux de surface.
  | 'transversus'
  | 'gluteMax'
  | 'gluteMed'
  | 'tfl'
  // Rotateurs profonds de hanche (piriforme, obturateurs, jumeaux, carré
  // fémoral) : la coiffe de la hanche, exactement comme la coiffe des
  // rotateurs pour l'épaule. Le 90/90 est une rotation profonde de hanche et
  // n'étiquetait aucun des muscles qui la produisent.
  | 'hipRotators'
  | 'hipFlexors'
  | 'rectusFemoris'
  | 'vastusLat'
  | 'vastusMed'
  | 'adductors'
  // Gracile : le seul adducteur BI-ARTICULAIRE — il croise la hanche et le
  // genou. Les autres s'arrêtent au fémur ; lui encaisse en plus chaque
  // changement d'appui genou fléchi, c'est-à-dire tout le béhourd.
  | 'gracilis'
  | 'bicepsFemoris'
  | 'hamsInner'
  | 'gastroc'
  | 'soleus'
  | 'tibialis'
  // Tibial postérieur : il soutient la voûte plantaire et retient le pied de
  // s'affaisser en dedans à chaque appui. Sous 35 kg d'armure c'est lui qui
  // tient l'arche — et « Tibial » ne désignait que l'antérieur, qui fait
  // l'inverse.
  | 'tibPost'
  | 'fibularis'

/** Nom affiché quand on touche un muscle sur le schéma. */
export const MUSCLE_LABELS: Record<MuscleRegion, string> = {
  neck: 'Cou — fléchisseurs (sterno-cléido-mastoïdien)',
  neckExt: 'Nuque — extenseurs (splénius, semi-épineux)',
  scalenes: 'Scalènes',
  levator: 'Élévateur de la scapula',
  trapsUpper: 'Trapèze supérieur',
  trapsMid: 'Trapèze moyen',
  trapsLow: 'Trapèze inférieur',
  deltAnt: 'Deltoïde antérieur',
  deltLat: 'Deltoïde latéral',
  deltPost: 'Deltoïde postérieur',
  pecUpper: 'Pectoral supérieur (faisceau claviculaire)',
  pecLower: 'Grand pectoral',
  serratus: 'Dentelé antérieur',
  pecMinor: 'Petit pectoral',
  lats: 'Grand dorsal',
  teres: 'Grand rond',
  rhomboids: 'Rhomboïdes',
  rotatorCuff: 'Coiffe des rotateurs (infra-épineux)',
  teresMinor: 'Petit rond',
  subscapularis: 'Sous-scapulaire',
  supraspinatus: 'Supra-épineux',
  erectors: 'Érecteurs du rachis',
  multifidus: 'Multifides (stabilisateurs segmentaires)',
  quadratusLumborum: 'Carré des lombes',
  biceps: 'Biceps brachial',
  brachialis: 'Brachial antérieur',
  coracobrachialis: 'Coraco-brachial',
  brachioradialis: 'Brachio-radial (long supinateur)',
  tricepsLong: 'Triceps — longue portion',
  tricepsLat: 'Triceps — portion latérale',
  forearmFlex: 'Fléchisseurs de l’avant-bras',
  forearmExt: 'Extenseurs de l’avant-bras',
  fingerFlex: 'Fléchisseurs des doigts (prise de force)',
  pronators: 'Rond pronateur et supinateur',
  rectus: 'Grand droit de l’abdomen',
  obliques: 'Obliques',
  transversus: 'Transverse de l’abdomen',
  gluteMax: 'Grand fessier',
  gluteMed: 'Moyen fessier',
  tfl: 'Tenseur du fascia lata',
  hipRotators: 'Rotateurs profonds de hanche (piriforme)',
  hipFlexors: 'Psoas-iliaque (fléchisseurs de hanche)',
  rectusFemoris: 'Droit fémoral',
  vastusLat: 'Vaste latéral',
  vastusMed: 'Vaste médial',
  adductors: 'Adducteurs',
  gracilis: 'Gracile (droit interne)',
  bicepsFemoris: 'Biceps fémoral',
  hamsInner: 'Ischios internes',
  gastroc: 'Gastrocnémiens (jumeaux)',
  soleus: 'Soléaire',
  tibialis: 'Tibial antérieur',
  tibPost: 'Tibial postérieur',
  fibularis: 'Fibulaires (péroniers)',
}

/**
 * Zone d'appartenance : le mot qu'on emploie en parlant, pas le nom anatomique.
 * Sert à nommer une séance et à résumer l'état du corps sans énumérer
 * trente-huit muscles.
 *
 * Complet, et non partiel : une zone manquante voulait dire un muscle qui
 * n'apparaît nulle part dès qu'on résume. La coiffe a la sienne — c'est la plus
 * lente à revenir et celle qu'il faut voir venir de loin.
 *
 * ── Pourquoi ce découpage-là ────────────────────────────────────────────────
 *
 * La version précédente comptait douze zones, dont « Jambes » qui en couvrait
 * dix : quadriceps, ischios, fessiers, adducteurs et psoas dans le même mot.
 * Une zone n'affiche que son muscle le plus en retard, donc un squat rendait
 * « Jambes » rouge et les ischios frais devenaient invisibles — l'écran
 * annonçait qu'il n'y avait rien à faire alors qu'il restait une demi-jambe
 * disponible. Même problème avec « Bras », qui mettait biceps et triceps
 * ensemble alors qu'une séance de tirage n'en fatigue qu'un.
 *
 * La règle de découpage : deux muscles partagent une zone quand on ne peut pas
 * travailler l'un sans l'autre. Les trois vastes du quadriceps, oui. Le
 * quadriceps et l'ischio, non — ce sont deux séances différentes.
 *
 * Deux regroupements survivent malgré tout, et pour la même raison inverse :
 * les trois faisceaux du deltoïde, qui ne se dissocient pas dans un
 * entraînement réel, et les trois muscles de l'avant-bras, qui travaillent dès
 * qu'on tient quelque chose.
 */
export const ZONE_LARGE: Record<MuscleRegion, string> = {
  // ── Tronc ────────────────────────────────────────────────────────────────
  neck: 'Cou',
  neckExt: 'Nuque',
  scalenes: 'Nuque',
  levator: 'Nuque',
  // Abdos et obliques séparés : une planche n'est pas un bûcheron à la poulie,
  // et en béhourd c'est l'oblique qui prend, pas le grand droit.
  rectus: 'Abdominaux',
  obliques: 'Obliques',
  transversus: 'Sangle profonde',
  serratus: 'Dentelé',
  pecMinor: 'Dentelé',
  erectors: 'Lombaires',
  quadratusLumborum: 'Lombaires',
  multifidus: 'Lombaires',

  // ── Dos et épaules ───────────────────────────────────────────────────────
  // Grand dorsal (tirage vertical) et milieu du dos (tirage horizontal) : deux
  // mouvements distincts, donc deux zones.
  lats: 'Grand dorsal',
  teres: 'Grand dorsal',
  rhomboids: 'Milieu du dos',
  trapsMid: 'Milieu du dos',
  trapsLow: 'Milieu du dos',
  trapsUpper: 'Trapèzes',
  // Les trois faisceaux du deltoïde restent ensemble : aucune séance réelle
  // n'en travaille un sans solliciter les deux autres.
  deltAnt: 'Épaules',
  deltLat: 'Épaules',
  deltPost: 'Épaules',
  rotatorCuff: 'Coiffe',
  teresMinor: 'Coiffe',
  subscapularis: 'Sous-scapulaire',
  supraspinatus: 'Coiffe',

  // ── Bras ─────────────────────────────────────────────────────────────────
  biceps: 'Biceps',
  brachialis: 'Biceps',
  coracobrachialis: 'Biceps',
  tricepsLong: 'Triceps',
  tricepsLat: 'Triceps',
  // L'avant-bras travaille dès qu'on tient quelque chose : le dissocier
  // afficherait trois zones qui bougent toujours ensemble.
  brachioradialis: 'Avant-bras',
  forearmFlex: 'Avant-bras',
  forearmExt: 'Avant-bras',
  fingerFlex: 'Préhension',
  pronators: 'Pronation',

  // ── Poitrine ─────────────────────────────────────────────────────────────
  pecUpper: 'Pectoraux',
  pecLower: 'Pectoraux',

  // ── Jambes ───────────────────────────────────────────────────────────────
  gluteMax: 'Fessiers',
  gluteMed: 'Fessiers',
  tfl: 'Fessiers',
  hipRotators: 'Rotateurs de hanche',
  hipFlexors: 'Fléchisseurs de hanche',
  rectusFemoris: 'Quadriceps',
  vastusLat: 'Quadriceps',
  vastusMed: 'Quadriceps',
  adductors: 'Adducteurs',
  gracilis: 'Adducteurs',
  bicepsFemoris: 'Ischios',
  hamsInner: 'Ischios',
  gastroc: 'Mollets',
  soleus: 'Mollets',
  // Tibial antérieur et fibulaires : ce ne sont pas des mollets, ils font
  // l'inverse. Ce sont eux qui tiennent la cheville en armure sur terrain
  // défoncé, et rien ne les travaille par accident.
  tibialis: 'Chevilles',
  tibPost: 'Chevilles',
  fibularis: 'Chevilles',
}

/** Toutes les zones existantes, sans doublon. */
export const ZONES = [...new Set(Object.values(ZONE_LARGE))]

/**
 * Combien de zones on énumère avant de compter le reste.
 *
 * Le découpage fin a un revers : au réveil d'une semaine calme, une quinzaine de
 * zones sont prêtes en même temps, et une ligne de quinze pastilles ne se lit
 * plus — elle occupe l'écran pour dire « tout va bien ». Cinq nommées et un
 * compteur disent la même chose en une ligne.
 */
export const MAX_ZONES_LISTEES = 5

/** Les N premières d'une liste de zones, et combien il en reste derrière. */
export function tronquerZones<T>(liste: T[], max = MAX_ZONES_LISTEES): { visibles: T[]; reste: number } {
  return { visibles: liste.slice(0, max), reste: Math.max(0, liste.length - max) }
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
const TRAPS: MuscleRegion[] = ['trapsUpper', 'trapsMid', 'trapsLow', 'levator']
const PECS: MuscleRegion[] = ['pecUpper', 'pecLower', 'pecMinor']
const TRICEPS: MuscleRegion[] = ['tricepsLong', 'tricepsLat']
// Ni « Cou » ni « Coiffe des rotateurs » ne s'élargissent à leurs nouveaux
// voisins : MUSCLE_LABELS les nomme « sterno-cléido-mastoïdien » et
// « infra-épineux », et un libellé précis ne couvre que son propre muscle —
// même règle que pour « Biceps » et « Grand pectoral » plus haut. La nuque et
// le supra-épineux ont donc leur propre libellé, et un exercice qui travaille
// les deux le DIT, chacun avec sa part.
//
// Le sélecteur de ressenti gagne en échange une zone « Nuque » : déclarer une
// courbature à l'arrière du cou après un béhourd ne colore plus le devant.
/** Les fléchisseurs du coude. Distinct de la clé « biceps », qui ne désigne que
 *  le biceps brachial depuis qu'un libellé précis doit pouvoir en abaisser un
 *  seul — ici on parle du BRAS, brachial compris. */
const BICEPS_BRAS: MuscleRegion[] = ['biceps', 'brachialis', 'coracobrachialis']
const FOREARMS: MuscleRegion[] = ['forearmFlex', 'forearmExt', 'brachioradialis', 'fingerFlex', 'pronators']
const BACK: MuscleRegion[] = ['lats', 'teres', 'rhomboids', 'trapsMid', 'trapsLow']
const ABS: MuscleRegion[] = ['rectus', 'obliques', 'transversus']
const GLUTES: MuscleRegion[] = ['gluteMax', 'gluteMed']
const QUADS: MuscleRegion[] = ['rectusFemoris', 'vastusLat', 'vastusMed']
const HAMS: MuscleRegion[] = ['bicepsFemoris', 'hamsInner']
const CALVES: MuscleRegion[] = ['gastroc', 'soleus']
const LEGS: MuscleRegion[] = [...QUADS, ...HAMS, ...CALVES, ...GLUTES, 'adductors', 'gracilis', 'tibialis', 'tibPost', 'fibularis', 'tfl', 'hipFlexors', 'hipRotators']
// Dédoublonné : BACK et TRAPS contiennent tous deux les trapèzes moyen et
// inférieur, et le dentelé n'était dans aucune des deux listes — « Haut du
// corps » l'oubliait donc en silence, alors qu'il plaque l'omoplate sur à peu
// près tout ce qui pousse.
const UPPER: MuscleRegion[] = [
  ...new Set<MuscleRegion>([...PECS, ...BACK, ...DELTS, ...TRICEPS, ...TRAPS, 'serratus', 'biceps', 'brachialis', 'brachioradialis', 'rotatorCuff', 'supraspinatus', 'teresMinor', 'subscapularis', 'pecMinor']),
]

/**
 * Tout le corps — la liste des muscles eux-mêmes, et non une somme de blocs.
 *
 * Recomposé à la main, « corps entier » couvrait 36 muscles sur 38 avec trois
 * doublons, et les deux oubliés étaient le dentelé et LES ÉRECTEURS DU RACHIS —
 * alors que les exercices qui portaient ce libellé sont tous des charnières de
 * hanche ou des portages, c'est-à-dire précisément du travail d'érecteurs. Un
 * libellé qui dit « tout » doit être dérivé de la liste des muscles, pas
 * réassemblé à côté d'elle.
 */
const CORPS_ENTIER = Object.keys(MUSCLE_LABELS) as MuscleRegion[]

/**
 * Part retenue quand un libellé PARAPLUIE est écrit sans coefficient.
 *
 * Un libellé qui couvre un bloc entier ne peut pas prétendre que chacun de ses
 * muscles est moteur. « Full body » sans coefficient, c'était 36 muscles à 100 %
 * — là où le vrai étiquetage des exercices qui le portaient donne cinq à neuf
 * muscles à 0,6-1,0. Quarante-cinq minutes de bêchage valaient donc, pour la
 * coiffe des rotateurs comme pour les mollets, une séance maximale.
 *
 * Les valeurs disent ce que le libellé signifie vraiment : « tout, mais rien en
 * particulier » pour le corps entier, « un demi-corps, sans moteur désigné »
 * pour les deux blocs. Un coefficient ÉCRIT l'emporte toujours — les séances de
 * récupération, qui déclarent « Haut du corps:1 » à dessein, ne changent pas.
 */
const PART_PARAPLUIE: Array<[cle: string, part: number]> = [
  ['full body', 0.5],
  ['corps entier', 0.5],
  ['haut du corps', 0.7],
  ['jambes', 0.7],
]

export function partParDefaut(label: string): number {
  const n = norm(label)
  for (const [cle, part] of PART_PARAPLUIE) if (n.includes(cle)) return part
  return 1
}

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
  lombaires: ['erectors', 'quadratusLumborum', 'multifidus'],
  cou: ['neck'],
  // « Bras », « Hanches » et « Chevilles » : trois mots qu'on emploie en
  // parlant et qui n'existaient pas ici. Le sélecteur de ressenti proposait
  // pourtant « Bras » — et le déclarer à 90 % après un béhourd ne colorait
  // strictement rien, en silence. Un libellé proposé qui ne mappe sur aucun
  // muscle est pire qu'un libellé absent : on croit avoir renseigné.
  bras: [...BICEPS_BRAS, ...TRICEPS],
  hanches: ['tfl', 'hipFlexors', 'hipRotators'],
  chevilles: ['tibialis', 'tibPost', 'fibularis'],
  // « Biceps » ne couvre plus le brachial, et « Grand pectoral » plus le
  // faisceau claviculaire (cf. le commentaire au-dessus de MUSCLE_MAP).
  biceps: ['biceps'],
  obliques: ['obliques'],
  // Zone contre libellé, une fois de plus : « Intérieur de cuisse » est le mot
  // qu'on emploie en montrant l'endroit, et il couvre le gracile ; le libellé
  // « Adducteurs » ne désigne que les adducteurs proprement dits.
  'interieur de cuisse': ['adductors', 'gracilis'],
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
  multifides: ['multifidus'],
  scalenes: ['scalenes'],
  'coraco-brachial': ['coracobrachialis'],
  gracile: ['gracilis'],
  'droit interne': ['gracilis'],
  'rotateurs de hanche': ['hipRotators'],
  piriforme: ['hipRotators'],
  'tibial posterieur': ['tibPost'],
  'carre des lombes': ['quadratusLumborum'],
  'extenseurs du cou': ['neckExt'],
  nuque: ['neckExt', 'levator', 'scalenes'],
  splenius: ['neckExt'],
  'elevateur de la scapula': ['levator'],
  angulaire: ['levator'],
  'supra-epineux': ['supraspinatus'],
  supraspinatus: ['supraspinatus'],
  brachial: ['brachialis'],
  'brachio-radial': ['brachioradialis'],
  'long supinateur': ['brachioradialis'],
  coiffe: ['rotatorCuff', 'supraspinatus', 'teresMinor'],
  'coiffe des rotateurs': ['rotatorCuff'],
  'petit rond': ['teresMinor'],
  'sous-scapulaire': ['subscapularis'],
  'petit pectoral': ['pecMinor'],
  'flechisseurs des doigts': ['fingerFlex'],
  prehension: ['fingerFlex'],
  'rond pronateur': ['pronators'],
  pronateurs: ['pronators'],
  supinateur: ['pronators'],
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
  transverse: ['transversus'],
  'transverse de l’abdomen': ['transversus'],
  'sangle profonde': ['transversus'],
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
  if (n.includes('full body') || n.includes('corps entier')) return CORPS_ENTIER
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
