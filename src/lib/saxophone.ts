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

export const SAX_KEYS: Array<{ id: SaxKey; label: string; aide: string }> = [
  { id: 'octave', label: '8ve', aide: "Clé d'octave — pouce gauche, au dos du saxophone." },
  { id: 'palmD', label: 'Ré', aide: 'Clé de paume Ré — main gauche, près du col.' },
  { id: 'palmEb', label: 'Mib', aide: 'Clé de paume Mib — main gauche, près du col.' },
  { id: 'palmF', label: 'Fa', aide: 'Clé de paume Fa — main gauche, près du col.' },
  { id: 'sideE', label: 'Mi lat.', aide: 'Clé latérale Mi — main droite, pour le registre aigu.' },
  { id: 'bis', label: 'Bis', aide: 'Clé de Sib « bis » — près de la clé 1 de la main gauche.' },
  { id: 'gauche1', label: '1', aide: 'Main gauche, index (clé « Si »).' },
  { id: 'gauche2', label: '2', aide: 'Main gauche, majeur (clé « La »).' },
  { id: 'gauche3', label: '3', aide: 'Main gauche, annulaire (clé « Sol »).' },
  { id: 'gsharp', label: 'Sol#', aide: 'Clé de Sol# — auriculaire gauche.' },
  { id: 'droite1', label: '1', aide: 'Main droite, index (clé « Fa »).' },
  { id: 'droite2', label: '2', aide: 'Main droite, majeur (clé « Mi »).' },
  { id: 'droite3', label: '3', aide: 'Main droite, annulaire (clé « Ré »).' },
  { id: 'lowC', label: 'Do', aide: 'Clé de Do grave — auriculaire droit.' },
  { id: 'lowEb', label: 'Mib', aide: 'Clé de Mib grave — auriculaire droit.' },
  { id: 'lowCsharp', label: 'Do#', aide: 'Clé de Do# grave — auriculaire gauche.' },
  { id: 'lowB', label: 'Si', aide: 'Clé de Si grave — auriculaire gauche.' },
  { id: 'lowBb', label: 'Sib', aide: 'Clé de Sib grave — auriculaire gauche.' },
]

export type Registre = 'grave' | 'médium' | 'aigu'

export interface SaxNote {
  id: string
  label: string
  registre: Registre
  keys: SaxKey[]
}

/**
 * Doigtés standards, du Sib grave au Fa aigu — la référence la plus courante
 * (pas les alternatives). Établie à partir d'une table de doigtés open-source
 * largement recoupée ; à vérifier avec ton prof pour les cas particuliers.
 */
export const SAX_NOTES: SaxNote[] = [
  { id: 'sib1', label: 'Sib grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowEb', 'lowBb'] },
  { id: 'si1', label: 'Si grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowB', 'lowC'] },
  { id: 'do1', label: 'Do grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowC'] },
  { id: 'do1d', label: 'Do# grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowC', 'lowCsharp'] },
  { id: 're1', label: 'Ré grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3'] },
  { id: 'mib1', label: 'Mib grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowEb'] },
  { id: 'mi1', label: 'Mi grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2'] },
  { id: 'fa1', label: 'Fa grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite1'] },
  { id: 'fa1d', label: 'Fa# grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'droite2'] },
  { id: 'sol1', label: 'Sol grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3'] },
  { id: 'sol1d', label: 'Sol# grave', registre: 'grave', keys: ['gauche1', 'gauche2', 'gauche3', 'gsharp'] },
  { id: 'la1', label: 'La grave', registre: 'grave', keys: ['gauche1', 'gauche2'] },
  { id: 'sib2', label: 'Sib médium (bis)', registre: 'médium', keys: ['gauche1', 'bis'] },
  { id: 'si2', label: 'Si médium', registre: 'médium', keys: ['gauche1'] },
  { id: 'do2', label: 'Do médium', registre: 'médium', keys: ['gauche2'] },
  { id: 'do2d', label: 'Do# médium', registre: 'médium', keys: [] },
  { id: 're2', label: 'Ré médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3'] },
  { id: 'mib2', label: 'Mib médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2', 'droite3', 'lowEb'] },
  { id: 'mi2', label: 'Mi médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1', 'droite2'] },
  { id: 'fa2', label: 'Fa médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite1'] },
  { id: 'fa2d', label: 'Fa# médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'droite2'] },
  { id: 'sol2', label: 'Sol médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3'] },
  { id: 'sol2d', label: 'Sol# médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2', 'gauche3', 'gsharp'] },
  { id: 'la2', label: 'La médium', registre: 'médium', keys: ['octave', 'gauche1', 'gauche2'] },
  { id: 'sib3', label: 'Sib aigu (bis)', registre: 'aigu', keys: ['octave', 'gauche1', 'bis'] },
  { id: 'si3', label: 'Si aigu', registre: 'aigu', keys: ['octave', 'gauche1'] },
  { id: 'do3', label: 'Do aigu', registre: 'aigu', keys: ['octave', 'gauche2'] },
  { id: 'do3d', label: 'Do# aigu', registre: 'aigu', keys: ['octave'] },
  { id: 're3', label: 'Ré aigu', registre: 'aigu', keys: ['octave', 'palmD'] },
  { id: 'mib3', label: 'Mib aigu', registre: 'aigu', keys: ['octave', 'palmD', 'palmEb'] },
  { id: 'mi3', label: 'Mi aigu', registre: 'aigu', keys: ['octave', 'palmD', 'palmEb', 'sideE'] },
  { id: 'fa3', label: 'Fa aigu', registre: 'aigu', keys: ['octave', 'palmD', 'palmEb', 'palmF', 'sideE'] },
]

export function saxKey(id: SaxKey) {
  return SAX_KEYS.find((k) => k.id === id)!
}
