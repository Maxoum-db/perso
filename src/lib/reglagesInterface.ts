import { fetchKv, readKvCache, saveKv } from './kv'

// Les réglages d'affichage : ce qu'on montre ou non, par compte.
//
// ── Pourquoi une fabrique et pas un fichier par réglage ─────────────────────
//
// Le premier — le bouton « + » flottant — tenait en trente lignes. Le second
// serait né par copie du premier, et c'est comme ça que `negatif` est né de
// `douceur` ailleurs dans ce dépôt : en oubliant de changer la clé au passage.
// Deux réglages écrivant dans le MÊME sac, et chacun relisant la valeur de
// l'autre, sans un mot.
//
// `parLigne.ts` a déjà tiré la leçon et refuse les clés en double à la
// construction. On fait pareil : la fabrique est le seul endroit qui sache
// écrire, et elle sait ce qui est déjà pris.
//
// ── Pourquoi le cache d'abord ───────────────────────────────────────────────
//
// Ces réglages décident si un élément est à l'écran. Attendre le réseau les
// ferait apparaître puis disparaître à chaque navigation — un clignotement, pour
// une valeur qui ne change jamais. On rend la dernière connue tout de suite, et
// la lecture réseau ne sert qu'à rattraper un changement fait ailleurs.

const CLES_PRISES = new Set<string>()

export interface ReglageBooleen {
  cle: string
  /** La dernière valeur connue, sans attendre le réseau. */
  enCache: () => boolean
  load: (userId: string) => Promise<boolean>
  save: (userId: string, on: boolean) => Promise<boolean>
}

export function reglageBooleen(cle: string, defaut: boolean): ReglageBooleen {
  if (CLES_PRISES.has(cle)) {
    throw new Error(`Réglage d'interface : la clé « ${cle} » est déjà prise.`)
  }
  CLES_PRISES.add(cle)
  return {
    cle,
    enCache: () => readKvCache<boolean>(cle, defaut) !== false,
    load: async (userId) => (await fetchKv<boolean>(userId, cle, defaut)) !== false,
    save: async (userId, on) => {
      await saveKv(userId, cle, on)
      return on
    },
  }
}

/**
 * Le bouton « + » flottant : note, tâche ou événement en deux touchers.
 *
 * Allumé par défaut, et ça compte : « je ne m'en sers jamais » est vrai pour
 * celui qui le dit. Il sert surtout à qui vit dans l'agenda et les notes.
 */
export const CAPTURE_RAPIDE = reglageBooleen('interface_capture_rapide', true)

/**
 * La barre du bas, repliée jusqu'à une simple poignée.
 *
 * Éteinte par défaut — la barre est le moyen normal de naviguer, et quelqu'un
 * qui la trouverait repliée sans l'avoir demandé chercherait longtemps.
 *
 * Repliée, il reste une poignée qui ouvre le menu complet : celui-ci contient
 * TOUTES les sections, l'accueil compris. On ne perd donc aucune destination,
 * seulement les quatre raccourcis — et une soixantaine de pixels, qui comptent
 * dans une fenêtre haute comme trois lignes.
 */
export const BARRE_REPLIEE = reglageBooleen('interface_barre_repliee', false)
