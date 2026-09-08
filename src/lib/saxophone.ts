import { ecrireCache, lireCache } from './cache'
import { LECONS } from './solfege'

// Doigtés du saxophone.
//
// Le doigté d'une note écrite est LE MÊME sur tous les saxophones (alto,
// ténor, soprano, baryton…) : c'est un instrument transpositeur, mais le
// mécanisme des clés ne change pas avec la transposition. Une seule table
// sert donc pour tous.
//
// Registre couvert : du Sib grave au Fa aigu — le registre standard, celui
// de la quasi-totalité du répertoire. Au-delà (suraigu), les doigtés sont
// des alternatives selon la méthode et le modèle d'instrument, pas un
// standard unique.

export type SaxKey =
  | 'octave'
  | 'palmD'
  | 'palmEb'
  | 'palmF'
  | 'sideE'
  | 'bis'
  | 'gauche1'
  | 'gauche2'
  | 'gauche3'
  | 'gsharp'
  | 'droite1'
  | 'droite2'
  | 'droite3'
  | 'lowC'
  | 'lowEb'
  | 'lowCsharp'
  | 'lowB'
  | 'lowBb'

// Rangées de haut en bas de l'instrument : c'est l'ordre dans lequel le schéma
// les dessine, et celui dans lequel on les lit sur le saxophone.
export const SAX_KEYS: Array<{ id: SaxKey; nom: string; aide: string }> = [
  { id: 'palmF', nom: 'Palme Fa', aide: 'Clé de paume Fa : paume gauche, la plus haute des trois.' },
  { id: 'palmEb', nom: 'Palme Mi♭', aide: 'Clé de paume Mi♭ : paume gauche, celle du milieu.' },
  { id: 'palmD', nom: 'Palme Ré', aide: 'Clé de paume Ré : paume gauche, la plus basse des trois.' },
  { id: 'octave', nom: 'Octave (pouce)', aide: "Clé d'octave : pouce gauche, au dos du saxophone." },
  // La « bis » est dessinée avant les deux nacres qui l'encadrent : sur
  // l'instrument elle est nichée entre elles, donc ce sont elles qui la
  // chevauchent, et pas l'inverse.
  { id: 'bis', nom: 'Bis (Si♭)', aide: 'Clé « bis » : la petite nacre collée sous l’index gauche.' },
  { id: 'gauche1', nom: 'Index gauche', aide: 'Première nacre de la main gauche (clé de Si).' },
  { id: 'gauche2', nom: 'Majeur gauche', aide: 'Deuxième nacre de la main gauche (clé de La).' },
  { id: 'gauche3', nom: 'Annulaire gauche', aide: 'Troisième nacre de la main gauche (clé de Sol).' },
  { id: 'gsharp', nom: 'Sol♯', aide: 'Spatule de Sol♯ : auriculaire gauche, au-dessus des trois autres.' },
  { id: 'lowB', nom: 'Si grave', aide: 'Spatule de Si grave : auriculaire gauche.' },
  { id: 'lowCsharp', nom: 'Do♯ grave', aide: 'Spatule de Do♯ grave : auriculaire gauche.' },
  { id: 'lowBb', nom: 'Si♭ grave', aide: 'Spatule de Si♭ grave : auriculaire gauche.' },
  { id: 'sideE', nom: 'Latérale Mi', aide: 'Clé latérale de Mi : tranche de l’index droit.' },
  { id: 'droite1', nom: 'Index droit', aide: 'Première nacre de la main droite (clé de Fa).' },
  { id: 'droite2', nom: 'Majeur droit', aide: 'Deuxième nacre de la main droite (clé de Mi).' },
  { id: 'droite3', nom: 'Annulaire droit', aide: 'Troisième nacre de la main droite (clé de Ré).' },
  { id: 'lowC', nom: 'Do grave', aide: 'Spatule de Do grave : auriculaire droit.' },
  { id: 'lowEb', nom: 'Mi♭ grave', aide: 'Spatule de Mi♭ grave : auriculaire droit.' },
]

export type Registre = 'grave' | 'médium' | 'aigu'

/**
 * L'ordre dans lequel on apprend, qui n'est pas celui des hauteurs.
 *
 * Le registre range les notes comme elles sonnent ; le niveau les range comme
 * on les rencontre. Les deux sont utiles et ne se déduisent pas l'un de
 * l'autre : le Si♭ grave et le Do♯ grave sont voisins sur l'instrument mais
 * arrivent bien après le Sol du milieu, et le Do aigu se joue d'un doigt quand
 * le Mi♭ grave en demande huit.
 *
 * ⚠️ C'est un classement raisonné, pas une norme : les méthodes ne s'accordent
 * pas au détail près sur l'ordre d'introduction. Il suit ce qu'elles font
 * toutes — le trio Si-La-Sol d'abord, les auriculaires et les altérations
 * ensuite, les clés de paume en dernier.
 */
export type Niveau = 1 | 2 | 3

export const NIVEAUX: Array<{ id: Niveau; label: string; aide: string }> = [
  { id: 1, label: 'Premières notes', aide: 'Le milieu de la portée, deux ou trois doigts, aucune spatule.' },
  { id: 2, label: 'Ensuite', aide: 'Les auriculaires, la clé « bis », les dièses et les bémols.' },
  { id: 3, label: 'Pour finir', aide: 'Le haut du registre : clés de paume et clé latérale.' },
]

export interface SaxNote {
  id: string
  label: string
  registre: Registre
  keys: SaxKey[]
  /**
   * Place sur la portée, en degrés depuis la ligne du bas de la clé de sol
   * (le Mi = 0). Un degré = un demi-interligne, et deux degrés = une ligne.
   *
   * C'est un degré DIATONIQUE et non un demi-ton : le Mi♭ et le Mi partagent
   * la même place (0), c'est le bémol qui les distingue — comme sur le papier.
   */
  degre: number
  alteration: 'diese' | 'bemol' | null
  niveau: Niveau
}

/**
 * Doigtés standards, du Sib grave au Fa aigu — la référence la plus courante
 * (pas les alternatives). Établie à partir d'une table de doigtés open-source
 * largement recoupée ; à vérifier avec ton prof pour les cas particuliers.
 */
export const SAX_NOTES: SaxNote[] = [
  { id: 'sib1', label: 'Sib grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowEb', 'lowBb'], degre: -3, alteration: 'bemol', niveau: 2 },
  { id: 'si1', label: 'Si grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowB', 'lowC'], degre: -3, alteration: null, niveau: 2 },
  { id: 'do1', label: 'Do grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowC'], degre: -2, alteration: null, niveau: 2 },
  { id: 'do1d', label: 'Do# grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowC', 'lowCsharp'], degre: -2, alteration: 'diese', niveau: 2 },
  { id: 're1', label: 'Ré grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3'], degre: -1, alteration: null, niveau: 1 },
  { id: 'mib1', label: 'Mib grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowEb'], degre: 0, alteration: 'bemol', niveau: 2 },
  { id: 'mi1', label: 'Mi grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2'], degre: 0, alteration: null, niveau: 1 },
  { id: 'fa1', label: 'Fa grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1'], degre: 1, alteration: null, niveau: 1 },
  { id: 'fa1d', label: 'Fa# grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite2'], degre: 1, alteration: 'diese', niveau: 1 },
  { id: 'sol1', label: 'Sol grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3'], degre: 2, alteration: null, niveau: 1 },
  { id: 'sol1d', label: 'Sol# grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'gsharp'], degre: 2, alteration: 'diese', niveau: 2 },
  { id: 'la1', label: 'La grave', registre: 'grave', keys: ['gauche1', 'gauche2'], degre: 3, alteration: null, niveau: 1 },
  { id: 'sib2', label: 'Sib médium (bis)', registre: 'médium', keys: ['gauche1', 'bis'], degre: 4, alteration: 'bemol', niveau: 2 },
  { id: 'si2', label: 'Si médium', registre: 'médium', keys: ['gauche1'], degre: 4, alteration: null, niveau: 1 },
  { id: 'do2', label: 'Do médium', registre: 'médium', keys: ['gauche2'], degre: 5, alteration: null, niveau: 1 },
  { id: 'do2d', label: 'Do# médium', registre: 'médium', keys: [], degre: 5, alteration: 'diese', niveau: 2 },
  { id: 're2', label: 'Ré médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3'], degre: 6, alteration: null, niveau: 1 },
  { id: 'mib2', label: 'Mib médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowEb'], degre: 7, alteration: 'bemol', niveau: 2 },
  { id: 'mi2', label: 'Mi médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2'], degre: 7, alteration: null, niveau: 1 },
  { id: 'fa2', label: 'Fa médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1'], degre: 8, alteration: null, niveau: 1 },
  { id: 'fa2d', label: 'Fa# médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite2'], degre: 8, alteration: 'diese', niveau: 2 },
  { id: 'sol2', label: 'Sol médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3'], degre: 9, alteration: null, niveau: 1 },
  { id: 'sol2d', label: 'Sol# médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'gsharp'], degre: 9, alteration: 'diese', niveau: 2 },
  { id: 'la2', label: 'La médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2'], degre: 10, alteration: null, niveau: 2 },
  { id: 'sib3', label: 'Sib aigu (bis)', registre: 'aigu', keys: ['octave', 'gauche1', 'bis'], degre: 11, alteration: 'bemol', niveau: 3 },
  { id: 'si3', label: 'Si aigu', registre: 'aigu', keys: ['octave', 'gauche1'], degre: 11, alteration: null, niveau: 2 },
  { id: 'do3', label: 'Do aigu', registre: 'aigu', keys: ['octave', 'gauche2'], degre: 12, alteration: null, niveau: 2 },
  { id: 'do3d', label: 'Do# aigu', registre: 'aigu', keys: ['octave'], degre: 12, alteration: 'diese', niveau: 3 },
  { id: 're3', label: 'Ré aigu', registre: 'aigu', keys: ['octave', 'palmD'], degre: 13, alteration: null, niveau: 3 },
  { id: 'mib3', label: 'Mib aigu', registre: 'aigu', keys: ['octave', 'palmD', 'palmEb'], degre: 14, alteration: 'bemol', niveau: 3 },
  { id: 'mi3', label: 'Mi aigu', registre: 'aigu', keys: ['octave', 'palmD', 'palmEb', 'sideE'], degre: 14, alteration: null, niveau: 3 },
  { id: 'fa3', label: 'Fa aigu', registre: 'aigu', keys: ['octave', 'palmD', 'palmEb', 'palmF', 'sideE'], degre: 15, alteration: null, niveau: 3 },
]

export function saxKey(id: SaxKey) {
  return SAX_KEYS.find((k) => k.id === id)!
}

// ── Ranger les notes ────────────────────────────────────────────────────────

/**
 * Les trois façons de ranger les mêmes trente-deux notes.
 *
 * Elles ne se déduisent pas les unes des autres et aucune ne remplace les
 * autres : on ne cherche pas la même chose selon qu'on lit une partition,
 * qu'on prépare son travail, ou qu'on compare les doigtés d'une même note.
 */
export type Classement = 'simple' | 'niveau' | 'note'

export const CLASSEMENTS: Array<{ id: Classement; label: string; aide: string }> = [
  {
    id: 'simple',
    label: 'Sans altération',
    aide: 'Les sept notes naturelles, registre par registre — ni dièse ni bémol, pour commencer.',
  },
  {
    id: 'niveau',
    label: 'Par niveau',
    aide: 'L’ordre où on les apprend — pour savoir quoi travailler ensuite.',
  },
  {
    id: 'note',
    label: 'Par note',
    aide: 'Toutes les octaves d’une même note ensemble — pour voir d’un coup tous les doigtés du Ré, ou du Fa.',
  },
]

export interface GroupeNotes {
  cle: string
  label: string
  aide: string
  notes: SaxNote[]
}

/** Les degrés de la portée, en partant du Mi de la ligne du bas. */
const DEGRES = ['Mi', 'Fa', 'Sol', 'La', 'Si', 'Do', 'Ré']

/**
 * Le nom d'une note, sans son registre.
 *
 * DÉDUIT de sa place sur la portée plutôt que recopié dans la table : c'est
 * la même information dite deux fois, et deux copies finissent toujours par
 * diverger d'une correction. Le degré donne le nom, l'altération le signe.
 */
export function nomDeNote(n: SaxNote): string {
  const base = DEGRES[((n.degre % 7) + 7) % 7]
  return base + (n.alteration === 'diese' ? '#' : n.alteration === 'bemol' ? 'b' : '')
}

/** Les douze noms, dans l'ordre chromatique habituel — celui qui part du Do. */
const ORDRE_NOMS = ['Do', 'Do#', 'Ré', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Sib', 'Si']

// Les naturelles seules, registre par registre : sept notes en bas, sept au
// milieu, cinq en haut — dix-neuf au lieu de trente-deux. Les treize altérées
// ne disparaissent pas de l'application, elles restent dans les deux autres
// classements et sous les flèches ; elles quittent seulement la liste par
// laquelle on commence.
const PAR_SIMPLE: GroupeNotes[] = [
  { id: 'grave' as Registre, label: 'Graves', aide: 'Les naturelles du bas, sans clé d’octave.' },
  { id: 'médium' as Registre, label: 'Médiums', aide: 'Les mêmes une octave au-dessus, clé d’octave au pouce.' },
  { id: 'aigu' as Registre, label: 'Aigus', aide: 'Le haut du registre standard, jusqu’au Fa.' },
].map((r) => ({
  cle: r.id,
  label: r.label,
  aide: r.aide,
  notes: SAX_NOTES.filter((n) => n.registre === r.id && n.alteration === null),
}))

const PAR_NIVEAU: GroupeNotes[] = NIVEAUX.map((nv) => ({
  cle: String(nv.id),
  label: nv.label,
  aide: nv.aide,
  notes: SAX_NOTES.filter((n) => n.niveau === nv.id),
}))

// Deux ou trois octaves par nom : l'aide les énumère plutôt que de répéter
// douze fois la même phrase, qui n'apprendrait rien à la douzième.
const PAR_NOTE: GroupeNotes[] = ORDRE_NOMS.map((nom) => {
  const notes = SAX_NOTES.filter((n) => nomDeNote(n) === nom)
  return { cle: nom, label: nom, aide: notes.map((n) => n.registre).join(' · '), notes }
}).filter((g) => g.notes.length > 0)

export function groupesDeNotes(classement: Classement): GroupeNotes[] {
  if (classement === 'niveau') return PAR_NIVEAU
  if (classement === 'note') return PAR_NOTE
  return PAR_SIMPLE
}

/**
 * La note voisine ATTEINTE PAR LES FLÈCHES, dans le classement courant.
 *
 * On avance toujours dans l'ordre chromatique de la table — c'est ce que les
 * flèches ont toujours fait —, mais on saute ce que le classement ne montre
 * pas : sans altération, ▶ mène du Mi au Fa et non à un Fa♯ introuvable dans
 * la liste sous les yeux. Les deux autres classements montrant tout, rien n'y
 * change.
 */
export function noteVoisine(id: string, pas: number, classement: Classement): SaxNote | null {
  const visibles = new Set(groupesDeNotes(classement).flatMap((g) => g.notes.map((n) => n.id)))
  const depart = SAX_NOTES.findIndex((n) => n.id === id)
  for (let i = depart + pas; i >= 0 && i < SAX_NOTES.length; i += pas) {
    if (visibles.has(SAX_NOTES[i].id)) return SAX_NOTES[i]
  }
  return null
}

// ── L'état de la page, gardé en local ───────────────────────────────────────
//
// Il vit ICI et non dans la page parce que deux écrans y touchent : la page
// des doigtés s'en sert pour s'afficher, l'écran des réglages en change le
// classement et l'affichage des doigts. Une seule définition de la forme
// rangée, une seule lecture, une seule écriture — sinon les deux écrans
// finissent par ne plus s'entendre sur ce qu'il y a dans le cache.

/** Les deux volets repliables de la page. */
export type IdVolet = 'notes' | 'doigte'
export const VOLETS: IdVolet[] = ['notes', 'doigte']

export interface EtatSax {
  /** Doigtés ou cours : deux usages, deux écrans, un seul onglet à retenir. */
  onglet: 'doigtes' | 'solfege'
  /** La leçon ouverte, ou aucune — l'accordéon n'en montre qu'une à la fois. */
  lecon: string | null
  note: string
  classement: Classement
  ouverts: Record<IdVolet, boolean>
  /**
   * Les paquets de notes repliés, par leur clé.
   *
   * Repliés et non dépliés : c'est la liste des exceptions, et elle est vide
   * au départ. L'inverse aurait demandé d'y inscrire chaque paquet existant,
   * et un paquet ajouté plus tard serait né fermé sans que personne l'ait
   * demandé.
   *
   * Les clés des trois classements ne se confondent pas — des mots, des
   * chiffres, des noms de notes — donc une seule liste suffit pour les trois.
   */
  groupesReplies: string[]
  /**
   * Les noms des clés sous la portée, affichés ou non.
   *
   * Ils servent tant qu'on apprend quel doigt porte quel nom ; passé ce moment,
   * ils répètent en mots ce que le schéma dit déjà en vert. Les effacer ne
   * RACCOURCIT PAS la page — c'est le saxophone qui en fixe la hauteur, et il
   * ne bouge pas — ça la calme, ce qui n'est pas la même chose et ne doit pas
   * être vendu pour telle.
   */
  doigtsVisibles: boolean
}

export const ETAT_SAX_DEFAUT: EtatSax = {
  onglet: 'doigtes',
  lecon: null,
  // La première NATURELLE et non la première note de la table : celle-là est
  // un Si♭, et le classement d'ouverture ne montre pas les altérées — on
  // arrivait sur une note absente de la liste juste en dessous.
  note: SAX_NOTES.find((n) => n.alteration === null)!.id,
  classement: 'simple',
  ouverts: { notes: true, doigte: true },
  groupesReplies: [],
  doigtsVisibles: true,
}

/**
 * L'état relu du cache, remis d'aplomb champ par champ.
 *
 * Champ par champ et non par étalement : ce qui est en mémoire vient d'une
 * version antérieure de la page — une note retirée du répertoire, un volet qui
 * n'existe plus — et l'étaler tel quel ouvrirait l'écran sur un doigté
 * introuvable ou ressusciterait une clé morte.
 */
export function lireEtatSax(): EtatSax {
  const brut = lireCache<Partial<EtatSax>>('saxophone', ETAT_SAX_DEFAUT)
  return {
    onglet: brut.onglet === 'solfege' ? 'solfege' : 'doigtes',
    lecon: LECONS.some((l) => l.id === brut.lecon) ? (brut.lecon as string) : null,
    note: SAX_NOTES.some((n) => n.id === brut.note) ? (brut.note as string) : ETAT_SAX_DEFAUT.note,
    classement: CLASSEMENTS.some((c) => c.id === brut.classement)
      ? (brut.classement as Classement)
      : ETAT_SAX_DEFAUT.classement,
    ouverts: {
      notes: brut.ouverts?.notes ?? ETAT_SAX_DEFAUT.ouverts.notes,
      doigte: brut.ouverts?.doigte ?? ETAT_SAX_DEFAUT.ouverts.doigte,
    },
    groupesReplies: Array.isArray(brut.groupesReplies) ? brut.groupesReplies : [],
    doigtsVisibles: brut.doigtsVisibles ?? ETAT_SAX_DEFAUT.doigtsVisibles,
  }
}

export function ecrireEtatSax(etat: EtatSax): void {
  ecrireCache('saxophone', etat)
}

/**
 * Change quelques champs sans toucher aux autres.
 *
 * Pour l'écran des réglages, qui ne connaît que le classement et l'affichage
 * des doigts : écrire son seul couple de valeurs effacerait la note en cours
 * et les paquets repliés de l'autre écran.
 */
export function majEtatSax(patch: Partial<EtatSax>): EtatSax {
  const etat = { ...lireEtatSax(), ...patch }
  ecrireEtatSax(etat)
  return etat
}
