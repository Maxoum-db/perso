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
}

/**
 * Doigtés standards, du Sib grave au Fa aigu — la référence la plus courante
 * (pas les alternatives). Établie à partir d'une table de doigtés open-source
 * largement recoupée ; à vérifier avec ton prof pour les cas particuliers.
 */
export const SAX_NOTES: SaxNote[] = [
  { id: 'sib1', label: 'Sib grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowEb', 'lowBb'], degre: -3, alteration: 'bemol' },
  { id: 'si1', label: 'Si grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowB', 'lowC'], degre: -3, alteration: null },
  { id: 'do1', label: 'Do grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowC'], degre: -2, alteration: null },
  { id: 'do1d', label: 'Do# grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowC', 'lowCsharp'], degre: -2, alteration: 'diese' },
  { id: 're1', label: 'Ré grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3'], degre: -1, alteration: null },
  { id: 'mib1', label: 'Mib grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowEb'], degre: 0, alteration: 'bemol' },
  { id: 'mi1', label: 'Mi grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2'], degre: 0, alteration: null },
  { id: 'fa1', label: 'Fa grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1'], degre: 1, alteration: null },
  { id: 'fa1d', label: 'Fa# grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite2'], degre: 1, alteration: 'diese' },
  { id: 'sol1', label: 'Sol grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3'], degre: 2, alteration: null },
  { id: 'sol1d', label: 'Sol# grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'gsharp'], degre: 2, alteration: 'diese' },
  { id: 'la1', label: 'La grave', registre: 'grave', keys: ['gauche1', 'gauche2'], degre: 3, alteration: null },
  { id: 'sib2', label: 'Sib médium (bis)', registre: 'médium', keys: ['gauche1', 'bis'], degre: 4, alteration: 'bemol' },
  { id: 'si2', label: 'Si médium', registre: 'médium', keys: ['gauche1'], degre: 4, alteration: null },
  { id: 'do2', label: 'Do médium', registre: 'médium', keys: ['gauche2'], degre: 5, alteration: null },
  { id: 'do2d', label: 'Do# médium', registre: 'médium', keys: [], degre: 5, alteration: 'diese' },
  { id: 're2', label: 'Ré médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3'], degre: 6, alteration: null },
  { id: 'mib2', label: 'Mib médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowEb'], degre: 7, alteration: 'bemol' },
  { id: 'mi2', label: 'Mi médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2'], degre: 7, alteration: null },
  { id: 'fa2', label: 'Fa médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1'], degre: 8, alteration: null },
  { id: 'fa2d', label: 'Fa# médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite2'], degre: 8, alteration: 'diese' },
  { id: 'sol2', label: 'Sol médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3'], degre: 9, alteration: null },
  { id: 'sol2d', label: 'Sol# médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'gsharp'], degre: 9, alteration: 'diese' },
  { id: 'la2', label: 'La médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2'], degre: 10, alteration: null },
  { id: 'sib3', label: 'Sib aigu (bis)', registre: 'aigu', keys: ['octave', 'gauche1', 'bis'], degre: 11, alteration: 'bemol' },
  { id: 'si3', label: 'Si aigu', registre: 'aigu', keys: ['octave', 'gauche1'], degre: 11, alteration: null },
  { id: 'do3', label: 'Do aigu', registre: 'aigu', keys: ['octave', 'gauche2'], degre: 12, alteration: null },
  { id: 'do3d', label: 'Do# aigu', registre: 'aigu', keys: ['octave'], degre: 12, alteration: 'diese' },
  { id: 're3', label: 'Ré aigu', registre: 'aigu', keys: ['octave', 'palmD'], degre: 13, alteration: null },
  { id: 'mib3', label: 'Mib aigu', registre: 'aigu', keys: ['octave', 'palmD', 'palmEb'], degre: 14, alteration: 'bemol' },
  { id: 'mi3', label: 'Mi aigu', registre: 'aigu', keys: ['octave', 'palmD', 'palmEb', 'sideE'], degre: 14, alteration: null },
  { id: 'fa3', label: 'Fa aigu', registre: 'aigu', keys: ['octave', 'palmD', 'palmEb', 'palmF', 'sideE'], degre: 15, alteration: null },
]

export function saxKey(id: SaxKey) {
  return SAX_KEYS.find((k) => k.id === id)!
}
