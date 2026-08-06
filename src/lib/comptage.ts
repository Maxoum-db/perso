import { fetchKv, saveKv } from './kv'
import type { MuscuSession } from './muscu'

// « Est-ce que cette séance compte dans le mannequin ? »
//
// Une case à cocher sur une séance déjà enregistrée, qui la retire du calcul de
// récupération sans la supprimer du journal. Deux usages, et le second est le
// vrai :
//
//   · la séance a été mal saisie, ou pas vraiment faite — on ne veut pas
//     qu'elle bloque un groupe pendant trois jours, mais on ne veut pas non
//     plus l'effacer de l'historique ;
//   · et surtout : VOIR ce que cette séance-là fait au mannequin. Décocher,
//     regarder ce qui repasse au vert, recocher. C'est la seule façon de
//     répondre à « qu'est-ce que ma séance d'hier m'a réellement coûté »,
//     autrement qu'en comparant deux images de mémoire.
//
// Ce n'est PAS un moyen d'alléger le barème. Une séance décochée disparaît
// entièrement du calcul — elle ne compte pas « moins », elle ne compte plus.
// Pour dire « c'était tranquille », l'intensité déclarée existe déjà et c'est
// elle qu'il faut employer.
//
// ⚠️ Le risque de cette case est l'oubli : décocher pour regarder, passer à
// autre chose, et laisser le mannequin mentir en silence pendant des jours.
// C'est pour ça que l'exclusion se voit à trois endroits — sur la ligne repliée
// du journal, dans le panneau déplié, et en bandeau sur le mannequin lui-même.
// Une donnée retirée du calcul doit être visible depuis le calcul.
//
// Stockage : une entrée KV par utilisateur, indexée par identifiant de séance,
// comme l'intensité et les versions douces. Pas de colonne dédiée, pas de
// migration.

export type Exclues = Record<string, true>

const KEY = 'muscu_exclues'

export async function loadExclues(userId: string): Promise<Exclues> {
  const v = await fetchKv<Exclues>(userId, KEY, {})
  return v && typeof v === 'object' ? v : {}
}

/**
 * Coche ou décoche une séance.
 *
 * `compte = true` RETIRE la clé au lieu d'écrire `false` : sans ça le KV
 * finirait par contenir une ligne pour chaque séance jamais ouverte, et on ne
 * pourrait plus lire d'un coup d'œil ce qui est réellement exclu.
 */
export async function saveExclue(
  userId: string,
  sessionId: string,
  compte: boolean,
  connues: Exclues,
): Promise<Exclues> {
  const next = { ...connues }
  if (compte) delete next[sessionId]
  else next[sessionId] = true
  await saveKv(userId, KEY, next)
  return next
}

/** Purge les séances disparues : sans ça le KV grossit sans jamais se vider. */
export function nettoyerExclues(connues: Exclues, idsVivants: Set<string>): Exclues {
  const out: Exclues = {}
  for (const [k, v] of Object.entries(connues)) if (idsVivants.has(k)) out[k] = v
  return out
}

/**
 * Recolle la déclaration sur les séances, comme l'intensité et les versions
 * douces le sont au chargement.
 *
 * Une seule définition, appelée à deux moments pour deux raisons : au
 * chargement, pour que le mannequin de l'accueil, l'export et le générateur
 * voient tous la même chose sans rien savoir de ce module ; et à chaque clic,
 * pour que la case réponde tout de suite au lieu d'attendre un aller-retour
 * réseau. Le même calcul aux deux endroits, donc pas deux vérités.
 */
export function appliquerComptage<T extends MuscuSession>(seances: T[], exclues: Exclues): T[] {
  // Réversible dans les DEUX sens, et pas seulement poseur de drapeau.
  //
  // La première version se contentait d'ajouter `horsMannequin` et sortait tôt
  // quand la table était vide. Appliquée à une liste déjà marquée — ce qui
  // arrive dès qu'on recoche —, elle laissait donc le marquage en place : le
  // corps ne revenait jamais à ce qu'il était. Une case qu'on décoche pour
  // observer doit rendre exactement l'état d'avant, sinon elle détruit ce
  // qu'elle sert à observer.
  const change = seances.some((s) => (exclues[s.id] === true) !== (s.horsMannequin === true))
  // Rien à faire : on rend la liste elle-même, pour ne pas casser inutilement
  // l'identité sur laquelle React se repose.
  if (!change) return seances
  return seances.map((s) => {
    const hors = exclues[s.id] === true
    if (hors === (s.horsMannequin === true)) return s
    if (hors) return { ...s, horsMannequin: true }
    // Retirée, et pas mise à `false` : la séance redevient identique à celle
    // qui sort du chargement, au champ près.
    const { horsMannequin: _retire, ...reste } = s
    return reste as T
  })
}

/**
 * Une séance déjà passée peut-elle être décochée ?
 *
 * Non pour une séance datée dans le futur : le moteur l'ignore déjà, la case ne
 * changerait donc rien et afficherait un réglage sans effet. Une case à cocher
 * qui ne fait rien est pire qu'une case absente — on croit avoir réglé quelque
 * chose.
 */
export function comptageReglable(s: { date: string }, maintenant = Date.now()): boolean {
  return s.date <= new Date(maintenant).toLocaleDateString('en-CA')
}
