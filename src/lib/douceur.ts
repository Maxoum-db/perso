import { declarationParLigne } from './parLigne'
import { EXERCISE_LIBRARY } from '../data/exercises'

// « Je l'ai fait en version douce. »
//
// Entre l'étirement pur et la série lourde, il y a tout ce qu'on fait à vide
// pour se remettre en route : le glissé au mur, la rotation externe à
// l'élastique, la suspension à la barre, le deadbug. Ces gestes-là ne fatiguent
// rien — ils rendent de l'amplitude et relancent la circulation —, mais
// enregistrés comme des exercices ordinaires ils COÛTAIENT de la récupération :
// le mannequin voyait une séance d'épaules là où il y avait eu dix minutes de
// mobilité, et le générateur écartait ensuite l'épaule pendant trois jours.
//
// La bibliothèque dit lesquels ont une version douce (`adaptable`), et cette
// déclaration-ci dit lesquels ont ÉTÉ faits comme ça. Les deux sont nécessaires :
// la première est une propriété du mouvement, la seconde une propriété de ta
// séance.
//
// Stockage : `lib/parLigne`, qui tient la mécanique commune aux déclarations
// posées sur une ligne de séance — clé composée, purge des séances disparues.

/** Les exercices dont la bibliothèque dit qu'ils ont une version douce. */
export const ADAPTABLE_NAMES = new Set(
  EXERCISE_LIBRARY.filter((e) => e.adaptable).map((e) => e.name.trim().toLowerCase()),
)

export function estAdaptable(nom: string): boolean {
  return ADAPTABLE_NAMES.has(nom.trim().toLowerCase())
}

export type Douceurs = Record<string, true>

const DOUCEUR = declarationParLigne<true>('muscu_douceur')

/** La clé KV de cette déclaration — distincte de celle des autres, cf. `lib/parLigne`. */
export const CLE_DOUCEUR = DOUCEUR.cleKv
export const clefDouceur = DOUCEUR.clef
export const loadDouceurs = DOUCEUR.load
export const nettoyerDouceurs = DOUCEUR.nettoyer

/** Réécrit les lignes déclarées douces d'UNE séance. Celles qui n'y sont plus disparaissent. */
export function saveDouceurs(
  userId: string,
  sessionId: string,
  nomsDoux: string[],
  connues: Douceurs,
): Promise<Douceurs> {
  return DOUCEUR.save(userId, sessionId, nomsDoux.map((nom) => ({ nom, valeur: true as const })), connues)
}
