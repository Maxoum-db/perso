import type { EtatCapteur } from './capteurCardio'

// Ce que l'en-tête montre du capteur, décidé à part.
//
// ── Pourquoi une fonction et pas trois `if` dans le composant ───────────────
//
// Parce qu'il y en avait quatre, et que l'un d'eux rendait RIEN.
//
// « Connecté mais pas encore de battement » retombait sur un `return null` :
// pas de pastille, et surtout pas le bouton pour rebrancher, qui vivait dans
// l'autre branche. L'en-tête devenait vide, sans rien pour en sortir. Ça durait
// le temps du premier battement — deux secondes en général, indéfiniment quand
// le brassard était mal placé et n'envoyait rien.
//
// Une cascade de conditions dans du JSX ne se teste pas : il faut monter le
// composant, simuler le Bluetooth, et on ne le fait jamais. Sortie d'ici, elle
// s'énumère — et un état sans affichage se voit au premier contrôle.

export type EtatPastille =
  /** Rien à montrer : option éteinte, ou pas de Bluetooth sur cet appareil. */
  | 'rien'
  /** Aucun capteur : le bouton qui ouvre le sélecteur. */
  | 'brancher'
  /** La liaison a été perdue en route. */
  | 'perdu'
  /** Appairage ou connexion en cours. */
  | 'connexion'
  /** Branché, en attente du premier battement. */
  | 'attente'
  /** Branché et mesurant. */
  | 'mesure'

/**
 * Chaque combinaison rend quelque chose, sauf les deux cas où il n'y a
 * légitimement rien à dire : le compte n'a pas le capteur, ou l'appareil ne sait
 * pas parler Bluetooth. Partout ailleurs, l'en-tête montre au moins de quoi
 * agir.
 */
export function etatPastille(args: {
  cardioActif: boolean
  bluetooth: boolean
  etat: EtatCapteur
  bpm: number | null
}): EtatPastille {
  const { cardioActif, bluetooth, etat, bpm } = args
  if (!cardioActif) return 'rien'
  // `absent` veut dire que le navigateur n'a pas l'interface : le bouton
  // ouvrirait un sélecteur qui n'existe pas.
  if (!bluetooth || etat === 'absent') return 'rien'
  if (etat === 'recherche' || etat === 'connexion') return 'connexion'
  if (etat === 'perdu') return 'perdu'
  if (etat !== 'connecté') return 'brancher'
  return bpm === null ? 'attente' : 'mesure'
}

/** Les états où le brassard est branché — ceux qui donnent accès au voile. */
export function estBranche(e: EtatPastille): boolean {
  return e === 'attente' || e === 'mesure'
}

/** Les états où toucher la pastille doit (re)lancer une connexion. */
export function peutBrancher(e: EtatPastille): boolean {
  return e === 'brancher' || e === 'perdu'
}
